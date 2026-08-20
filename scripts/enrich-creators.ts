import { loadCatalog, saveCatalog } from "../src/lib/catalog";

async function main() {
  const catalog = await loadCatalog();
  await saveCatalog(catalog, { replace: true });
  const samples = catalog.items
    .filter((item) => /klimt|monet|gogh|vermeer|hokusai|poster/i.test(item.title))
    .slice(0, 6)
    .map((item) => `${item.kind} | ${item.photographer} | ${item.title.slice(0, 60)}`);
  console.log(`enriched ${catalog.items.length}`);
  console.log(samples.join("\n"));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
