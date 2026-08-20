import { loadCatalog, saveCatalog } from "../src/lib/catalog";
import { lookupFilm, parseFilmTitle } from "../src/lib/filmMeta";

async function main() {
  const catalog = await loadCatalog();
  for (const item of catalog.items) {
    const query = parseFilmTitle(item.fileKey || item.titleEn || item.title);
    const credits = await lookupFilm(query);
    item.titleEn = credits.titleEn;
    item.titleZh = credits.titleZh;
    item.director = credits.director;
    console.log(`${query} -> ${item.titleEn} / ${item.titleZh} / ${item.director}`);
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  await saveCatalog(catalog);
  console.log(`enriched ${catalog.items.length} items`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
