import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { analyzeImageBuffer } from "../src/lib/analyze";
import { loadCatalog, saveCatalog } from "../src/lib/catalog";
import type { CatalogItem } from "../src/lib/types";

async function main() {
  const catalog = await loadCatalog();
  const stillDir = path.join(process.cwd(), "public", "stills");
  const files = (await readdir(stillDir)).filter((name) => name.endsWith(".jpg"));
  const byFile = new Map<string, CatalogItem>();
  for (const item of catalog.items) {
    const name = (item.imageUrl || item.thumbUrl || "").split("/").pop();
    if (name) byFile.set(name, item);
  }

  const items: CatalogItem[] = [];
  for (const file of files) {
    const existing = byFile.get(file);
    if (existing) {
      items.push(existing);
      continue;
    }
    const buffer = await readFile(path.join(stillDir, file));
    if (buffer.byteLength < 4000) continue;
    const analysis = await analyzeImageBuffer(buffer);
    const id = file.replace(/\.jpg$/i, "");
    items.push({
      id,
      title: "Untitled still",
      titleEn: "Untitled still",
      titleZh: "未注明",
      director: "未注明",
      source: "commons",
      imageUrl: `/stills/${file}`,
      thumbUrl: `/stills/${file}`,
      license: "Public domain / free license",
      buckets: analysis.buckets,
      palette: analysis.palette,
      addedAt: new Date().toISOString(),
      fileKey: `stills:${file}`,
      kind: "film",
      photographer: "未注明",
      sourceLabel: "公共领域图库",
    });
    console.log(`indexed orphan ${file}`);
  }

  catalog.items = items;
  catalog.seenFileKeys = [...new Set([...catalog.seenFileKeys, ...items.map((item) => item.fileKey ?? item.id)])];
  await saveCatalog(catalog, { replace: true });
  console.log(`catalog rebuilt: ${items.length} items from ${files.length} stills`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
