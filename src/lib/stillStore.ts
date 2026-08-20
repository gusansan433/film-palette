import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { analyzeImageBuffer, isColorful } from "./analyze";
import { looksLikeMeme } from "./classify";
import { knownCredits, parseFilmTitle } from "./filmMeta";
import { guessKind, isTitleCard, sourceLabel } from "./mediaKind";
import { parseCreator } from "./creator";
import { imageFingerprint, isUnsafeItem } from "./fingerprint";
import type { CatalogItem } from "./types";

export async function persistStillJpeg(buffer: Buffer, id: string) {
  const jpeg = await sharp(buffer)
    .rotate()
    .resize({ width: 1280, withoutEnlargement: true })
    .jpeg({ quality: 78 })
    .toBuffer();
  const dir = path.join(process.cwd(), "public", "stills");
  await mkdir(dir, { recursive: true });
  const filename = `${id}.jpg`;
  await writeFile(path.join(dir, filename), jpeg);
  return `/stills/${filename}`;
}

export async function stillFromBuffer(input: {
  buffer: Buffer;
  title: string;
  source: CatalogItem["source"];
  pageUrl?: string;
  author?: string;
  license: string;
  licenseUrl?: string;
  fileKey: string;
  kind?: CatalogItem["kind"];
  sourceLabel?: string;
}): Promise<CatalogItem | null> {
  if (input.buffer.byteLength < 4000) return null;
  if (isTitleCard(input.title) || isTitleCard(input.fileKey)) return null;
  if (isUnsafeItem(input)) return null;
  const analysis = await analyzeImageBuffer(input.buffer);
  const allowGray = looksLikeMeme(`${input.title} ${input.fileKey ?? ""}`);
  if (!isColorful(analysis) && !allowGray) return null;
  const id = crypto.randomUUID();
  let localUrl = "";
  try {
    localUrl = await persistStillJpeg(input.buffer, id);
  } catch {
    return null;
  }
  const query = parseFilmTitle(input.title);
  const kind = input.kind ?? guessKind({
    title: input.title,
    source: input.source,
    fileKey: input.fileKey,
  });
  const credits =
    kind === "film"
      ? knownCredits(query) ?? {
          titleEn: query || input.title,
          titleZh: "未注明",
          director: "未注明",
        }
      : {
          titleEn: input.title,
          titleZh: "",
          director: "",
        };
  return {
    id,
    title: input.title,
    titleEn: credits.titleEn,
    titleZh: credits.titleZh,
    director: credits.director,
    source: input.source,
    imageUrl: localUrl,
    thumbUrl: localUrl,
    pageUrl: input.pageUrl,
    author: input.author,
    license: input.license,
    licenseUrl: input.licenseUrl || input.pageUrl,
    buckets: analysis.buckets,
    palette: analysis.palette,
    addedAt: new Date().toISOString(),
    fileKey: input.fileKey,
    kind,
    photographer: parseCreator(input.title, input.author) || input.author || "未注明",
    sourceLabel: input.sourceLabel || sourceLabel(input.source),
    contentHash: await imageFingerprint(input.buffer),
  };
}
