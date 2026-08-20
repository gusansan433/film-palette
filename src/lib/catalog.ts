import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Catalog, CatalogItem } from "./types";
import { withMediaMeta } from "./mediaKind";
import { isUnsafeItem } from "./fingerprint";

const DATA_DIR = path.join(process.cwd(), "data");
const CATALOG_PATH = path.join(DATA_DIR, "catalog.json");

const emptyCatalog = (): Catalog => ({
  items: [],
  lastIngestDate: null,
  seenFileKeys: [],
  seenContentHashes: [],
});

export async function loadCatalog(): Promise<Catalog> {
  try {
    const raw = await readFile(CATALOG_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<Catalog>;
    return {
      items: (parsed.items ?? []).filter((item) => !isUnsafeItem(item)).map(withMediaMeta),
      lastIngestDate: parsed.lastIngestDate ?? null,
      seenFileKeys: parsed.seenFileKeys ?? [],
      seenContentHashes: parsed.seenContentHashes ?? [],
    };
  } catch (error) {
    console.error("catalog.json unreadable, showing empty gallery:", error);
    return emptyCatalog();
  }
}

export async function saveCatalog(catalog: Catalog, options?: { replace?: boolean }) {
  await mkdir(DATA_DIR, { recursive: true });
  if (!options?.replace) {
    try {
      const existing = JSON.parse(await readFile(CATALOG_PATH, "utf8")) as Partial<Catalog>;
      const byId = new Map<string, CatalogItem>();
      for (const item of existing.items ?? []) byId.set(item.id, item);
      for (const item of catalog.items) byId.set(item.id, item);
      catalog.items = [...byId.values()];
      catalog.seenFileKeys = [...new Set([...(existing.seenFileKeys ?? []), ...catalog.seenFileKeys])];
      catalog.seenContentHashes = [
        ...new Set([...(existing.seenContentHashes ?? []), ...(catalog.seenContentHashes ?? [])]),
      ];
      catalog.lastIngestDate = catalog.lastIngestDate ?? existing.lastIngestDate ?? null;
    } catch {
      // no existing catalog to merge
    }
  }
  const payload = JSON.stringify(catalog, null, 2);
  const tmp = `${CATALOG_PATH}.tmp`;
  await writeFile(tmp, payload, "utf8");
  try {
    await rename(tmp, CATALOG_PATH);
  } catch {
    await unlink(CATALOG_PATH).catch(() => undefined);
    await rename(tmp, CATALOG_PATH);
  }
}

export function todayStamp(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function hashString(input: string) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickToday(items: CatalogItem[], count = 10, date = todayStamp()) {
  if (items.length <= count) return [...items];
  const random = mulberry32(hashString(date));
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}
