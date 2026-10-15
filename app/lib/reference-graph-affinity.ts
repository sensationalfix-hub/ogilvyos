/**
 * Local graph proximity heuristics. These scores measure overlap in stored
 * metadata, not neural embeddings or an interpretation of the media itself.
 * Confirmed user connections always take priority.
 */
export type AffinityRef = {
  auto_tags: string[];
  collection_id: string | null;
};

const normalize = (tag: string) =>
  tag.toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

const genericTags = new Set([
  "publicidad", "video", "videos", "reference", "referencia",
  "spot", "campaign", "campa", "imagen", "image", "visual",
]);

function tags(ref: AffinityRef) {
  const visual = new Set<string>();
  const concepts = new Set<string>();
  for (const raw of ref.auto_tags || []) {
    const tag = normalize(raw);
    if (!tag || genericTags.has(tag)) continue;
    if (tag.startsWith("visual:")) visual.add(tag.slice(7));
    else if (tag.length >= 4) concepts.add(tag);
  }
  return { visual, concepts };
}

function overlap(a: Set<string>, b: Set<string>) {
  let matches = 0;
  for (const tag of a) if (b.has(tag)) matches++;
  const union = a.size + b.size - matches;
  return { matches, jaccard: union ? matches / union : 0 };
}

export function referenceAffinity(a: AffinityRef, b: AffinityRef, confirmed = false): number {
  if (confirmed) return 0.96;
  const first = tags(a), second = tags(b);
  const visual = overlap(first.visual, second.visual);
  const semantic = overlap(first.concepts, second.concepts);
  const visualWeight = visual.matches ? Math.min(0.68, visual.matches * 0.21 + visual.jaccard * 0.13) : 0;
  const semanticWeight = semantic.matches ? Math.min(0.47, semantic.matches * 0.12 + semantic.jaccard * 0.12) : 0;
  const collectionWeight = a.collection_id && a.collection_id === b.collection_id ? 0.14 : 0;
  return Math.min(0.84, visualWeight + semanticWeight + collectionWeight);
}

export function affinityDistance(weight: number): number {
  return 360 - Math.max(0, Math.min(1, weight)) * 220;
}

export function affinityLevel(weight: number) {
  if (weight >= 0.73) return "Muy alta";
  if (weight >= 0.46) return "Alta";
  if (weight >= 0.23) return "Media";
  if (weight >= 0.12) return "Baja";
  return "Sin afinidad detectada";
}
