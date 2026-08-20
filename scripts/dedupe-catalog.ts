import { readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { loadCatalog, saveCatalog } from "../src/lib/catalog";
import { imageFingerprint, isNearDuplicate, isSpecificTitle, normalizeTitle } from "../src/lib/fingerprint";

async function main() {
  const catalog = await loadCatalog();
  const keep = [];
  const hashes: string[] = [];
  const titles = new Set<string>();
  let removed = 0;

  for (const item of catalog.items) {
    const file = (item.imageUrl || item.thumbUrl || "").split("/").pop();
    let hash = item.contentHash;
    if (!hash && file && item.imageUrl?.startsWith("/stills/")) {
      try {
        const buffer = await readFile(path.join(process.cwd(), "public", "stills", file));
        hash = await imageFingerprint(buffer);
      } catch {
        hash = undefined;
      }
    }
    const titleKey = isSpecificTitle(item.title) ? normalizeTitle(item.title) : "";
    if ((hash && isNearDuplicate(hash, hashes)) || (titleKey && titles.has(titleKey))) {
      removed += 1;
      if (file && item.imageUrl?.startsWith("/stills/")) {
        await unlink(path.join(process.cwd(), "public", "stills", file)).catch(() => undefined);
      }
      continue;
    }
    if (hash) {
      item.contentHash = hash;
      hashes.push(hash);
    }
    if (titleKey) titles.add(titleKey);
    keep.push(item);
  }

  catalog.items = keep;
  catalog.seenContentHashes = hashes;
  await saveCatalog(catalog, { replace: true });
  console.log(`kept ${keep.length}; removed ${removed} duplicates`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
