const NOTION_VERSION = "2026-03-11";

export const DATA_SOURCES = {
  accounts: "2b94f145-f5cf-8086-b7d3-000b725420ca",
  projects: "2b94f145-f5cf-8056-8374-000ba6ff7805",
  tasks: "2b94f145-f5cf-8047-ae8f-000b0d9c228c",
  team: "2b94f145-f5cf-80d2-9b2d-000ba0a4f1b5",
  holidays: "2b94f145-f5cf-8036-9bea-000bcf72925b",
  evaluations: "dfc07eed-0df1-4ace-87eb-ac682213ee58",
} as const;

type NotionOption = {
  id?: string;
  name: string;
  color?: string;
  description?: string | null;
};

type SchemaProperty = {
  id?: string;
  name?: string;
  type?: string;
  select?: { options?: NotionOption[] };
  multi_select?: { options?: NotionOption[] };
  status?: {
    options?: NotionOption[];
    groups?: Array<{ id?: string; name?: string; option_ids?: string[] }>;
  };
  options?: NotionOption[];
  groups?: Record<string, NotionOption[]> | Array<{ id?: string; name?: string; option_ids?: string[] }>;
};

export type LiveOption = {
  id: string;
  name: string;
  color: string;
  group?: string;
};

function token() {
  const value = process.env.NOTION_TOKEN || process.env.NOTION_API_KEY || process.env.NOTION_KEY;
  if (!value) throw new Error("NOTION_TOKEN_MISSING");
  return value;
}

export async function notionRequest(path: string, init: RequestInit = {}) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(`https://api.notion.com/v1${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token()}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
        ...(init.headers || {}),
      },
      cache: "no-store",
    });

    if (response.ok) return response.json();

    const detail = await response.text();
    if (response.status !== 429 || attempt === 2) {
      throw new Error(`Notion ${response.status}: ${detail}`);
    }

    const retryAfter = Number(response.headers.get("retry-after") || "1");
    await new Promise((resolve) => setTimeout(resolve, Math.max(250, retryAfter * 1000)));
  }

  throw new Error("Notion request failed");
}

export async function retrieveDataSource(id: string) {
  return notionRequest(`/data_sources/${id}`);
}

export async function queryDataSource(id: string, body: Record<string, unknown>) {
  return notionRequest(`/data_sources/${id}/query`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function resolvePageIdByTitle(dataSourceId: string, titleProperty: string, value: string) {
  const response = await queryDataSource(dataSourceId, {
    page_size: 2,
    filter: {
      property: titleProperty,
      title: { equals: value },
    },
  });
  const results = Array.isArray(response?.results) ? response.results : [];
  const exact = results.find((item: any) => {
    const title = item?.properties?.[titleProperty]?.title;
    const text = Array.isArray(title) ? title.map((part: any) => part?.plain_text || part?.text?.content || "").join("") : "";
    return text === value;
  });
  return exact?.id || results[0]?.id || null;
}

export async function resolveRelation(
  dataSourceId: string,
  titleProperty: string,
  values: string[]
) {
  const ids: string[] = [];
  for (const value of values.filter(Boolean)) {
    const id = await resolvePageIdByTitle(dataSourceId, titleProperty, value);
    if (id) ids.push(id);
  }
  return ids.map((id) => ({ id }));
}

function optionKey(option: NotionOption) {
  return option.id || option.name;
}

export function extractOptions(property: SchemaProperty | undefined): LiveOption[] {
  if (!property) return [];

  const direct =
    property.select?.options ||
    property.multi_select?.options ||
    property.status?.options ||
    property.options ||
    [];

  const groupByOption = new Map<string, string>();

  if (Array.isArray(property.status?.groups)) {
    for (const group of property.status.groups) {
      for (const id of group.option_ids || []) groupByOption.set(id, group.name || "");
    }
  }

  if (Array.isArray(property.groups)) {
    for (const group of property.groups) {
      for (const id of group.option_ids || []) groupByOption.set(id, group.name || "");
    }
  } else if (property.groups && typeof property.groups === "object") {
    for (const [group, options] of Object.entries(property.groups)) {
      for (const option of options || []) groupByOption.set(optionKey(option), group);
    }
  }

  return direct.map((option) => ({
    id: option.id || option.name,
    name: option.name,
    color: option.color || "default",
    ...(groupByOption.get(optionKey(option)) ? { group: groupByOption.get(optionKey(option)) } : {}),
  }));
}

export function schemaProperty(source: any, name: string): SchemaProperty | undefined {
  return source?.properties?.[name] || source?.schema?.[name];
}

export function schemaHealth(source: any, required: string[]) {
  const properties = source?.properties || source?.schema || {};
  return required.map((name) => ({
    name,
    ok: Boolean(properties[name]),
    type: properties[name]?.type || null,
  }));
}

export async function createPage(dataSourceId: string, properties: Record<string, unknown>) {
  return notionRequest("/pages", {
    method: "POST",
    body: JSON.stringify({
      parent: { data_source_id: dataSourceId },
      properties,
    }),
  });
}

export async function updatePage(pageId: string, properties: Record<string, unknown>) {
  return notionRequest(`/pages/${pageId}`, {
    method: "PATCH",
    body: JSON.stringify({ properties }),
  });
}
