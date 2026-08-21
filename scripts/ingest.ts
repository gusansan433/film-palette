import { ingestDaily, ingestPhotos } from "../src/lib/ingest";

async function main() {
  const memes = process.argv.includes("--memes");
  const art = process.argv.includes("--art");
  const cats = process.argv.includes("--cats");
  const photos = process.argv.includes("--photos") || memes || art || cats;
  const force = process.argv.includes("--force") || process.argv.includes("--seed");
  const countArg = process.argv.find((arg) => arg.startsWith("--count="));
  const count = countArg
    ? Number(countArg.split("=")[1])
    : photos || process.argv.includes("--seed")
      ? 40
      : 10;
  const result = photos
    ? await ingestPhotos({
        count: Number.isFinite(count) ? Math.min(Math.max(count, 1), 400) : 40,
        persist: true,
        memes,
        art,
        cats,
        prefer: memes
          ? /meme/i
          : art
            ? /painting|botticelli|caravaggio|vermeer|rembrandt|monet|van gogh|klimt|matisse|sargent|leyendecker|beardsley|fresco|mural|nianhua|embroidery|textile|porcelain/i
            : cats
              ? /cat|kitten|tabby|feline|kitty/i
              : undefined,
      })
    : await ingestDaily({
        count: Number.isFinite(count) ? Math.min(Math.max(count, 1), 120) : 10,
        force,
        persist: true,
      });
  console.log(result.message);
  console.log(`catalog size: ${result.catalog.items.length}`);
  console.log(`added: ${result.added.length}; persisted: ${result.persisted}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
