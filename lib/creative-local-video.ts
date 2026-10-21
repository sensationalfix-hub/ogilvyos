"use client";

/** Raw clips stay in this browser. Only their IDs and descriptive metadata go to Supabase. */
const DB_NAME = "creative-lab-local-videos";
const STORE = "videos";

type StoredVideo = { id: string; blob: Blob; name: string; updatedAt: number };

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("Este navegador no permite guardar vídeos locales."));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE)) database.createObjectStore(STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("No se pudo abrir el almacenamiento local."));
    request.onblocked = () => reject(new Error("Cierra las otras pestañas de Creative Lab y vuelve a intentarlo."));
  });
}

export async function storeLocalVideo(id: string, file: File): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE, "readwrite");
      transaction.objectStore(STORE).put({ id, blob: file, name: file.name, updatedAt: Date.now() } satisfies StoredVideo);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error("No se pudo guardar el vídeo."));
      transaction.onabort = () => reject(transaction.error || new Error("Espacio local insuficiente para este vídeo."));
    });
  } finally {
    database.close();
  }
}

export async function readLocalVideo(id: string): Promise<Blob | null> {
  const database = await openDatabase();
  try {
    return await new Promise<Blob | null>((resolve, reject) => {
      const request = database.transaction(STORE, "readonly").objectStore(STORE).get(id);
      request.onsuccess = () => resolve((request.result as StoredVideo | undefined)?.blob || null);
      request.onerror = () => reject(request.error || new Error("No se pudo leer el vídeo local."));
    });
  } finally {
    database.close();
  }
}
