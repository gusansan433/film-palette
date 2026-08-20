import "./proxy";
import { unlink, writeFile, stat } from "node:fs/promises";
import path from "node:path";
import { ingestCommonsStill, collectCommonsCandidates, collectCommonsMemeCandidates, collectCommonsArtCandidates } from "./commons";
import { collectOpenCandidates, collectPhotoCandidates, collectMemeCandidates, collectArtCandidates, ingestOpenStill } from "./openSources";
import { loadCatalog, saveCatalog, todayStamp } from "./catalog";
import { isPlacePhoto, isTitleCard, withMediaMeta } from "./mediaKind";
import { isRepeatItem, isJunkTitle, isUnsafeItem } from "./fingerprint";
import type { CatalogItem } from "./types";

const INGEST_LOCK = path.join(process.cwd(), "data", "ingest.lock");

async function acquireIngestLock() {
  try {
    await writeFile(INGEST_LOCK, String(process.pid), { flag: "wx" });
    return true;
  } catch {
    try {
      const info = await stat(INGEST_LOCK);
      if (Date.now() - info.mtimeMs > 120 * 60 * 1000) {
        await unlink(INGEST_LOCK);
        await writeFile(INGEST_LOCK, String(process.pid), { flag: "wx" });
        return true;
      }
    } catch {
      return false;
    }
    return false;
  }
}

async function releaseIngestLock() {
  await unlink(INGEST_LOCK).catch(() => undefined);
}

function shuffle<T>(list: T[]) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export async function ingestDaily(options?: {
  count?: number;
  force?: boolean;
  persist?: boolean;
}) {
  const count = options?.count ?? 10;
  const catalog = await loadCatalog();
  const today = todayStamp();

  if (
    !options?.force &&
    catalog.lastIngestDate === today &&
    catalog.items.some((item) => item.addedAt.slice(0, 10) === today)
  ) {
    return {
      added: [] as CatalogItem[],
      persisted: true,
      catalog,
      message: "今天已经抓取过公共领域截图。",
    };
  }

  if (!(await acquireIngestLock())) {
    return {
      added: [] as CatalogItem[],
      persisted: false,
      catalog,
      message: "图库正在收录中，稍后再看。",
    };
  }

  try {
    return await runIngest(catalog, today, count, options);
  } finally {
    await releaseIngestLock();
  }
}

async function runIngest(
  catalog: Awaited<ReturnType<typeof loadCatalog>>,
  today: string,
  count: number,
  options?: { persist?: boolean },
) {
  const seen = new Set(catalog.seenFileKeys);
  catalog.items = catalog.items.map(withMediaMeta);
  const added: CatalogItem[] = [];
  let skipped = 0;
  const persisted = options?.persist !== false;

  async function keep(item: CatalogItem, key: string) {
    const latest = await loadCatalog();
    if (isRepeatItem(item, latest)) {
      skipped += 1;
      seen.add(key);
      console.log("  skip (duplicate)");
      return false;
    }
    added.push(item);
    seen.add(key);
    if (item.fileKey) seen.add(item.fileKey);
    catalog.items = [item, ...latest.items.filter((row) => row.id !== item.id && row.fileKey !== item.fileKey)];
    catalog.seenFileKeys = [...new Set([...latest.seenFileKeys, ...seen])];
    catalog.seenContentHashes = [
      ...new Set([...(latest.seenContentHashes ?? []), ...(item.contentHash ? [item.contentHash] : [])]),
    ];
    catalog.lastIngestDate = today;
    if (options?.persist !== false) await saveCatalog(catalog);
    return true;
  }

  const openRaw = await collectOpenCandidates(seen);
  const preferred = /sintel|blender|bunny|tears of steel|elephants dream|caminandes|charade|living dead|chaplin|keaton|pickford|神女|马路|小城|king of jazz|caligari|nosferatu|metropolis/i;
  const openCandidates = [
    ...shuffle(openRaw.filter((item) => preferred.test(item.title))),
    ...shuffle(openRaw.filter((item) => !preferred.test(item.title))),
  ];
  console.log(`open candidates: ${openCandidates.length}`);
  for (const candidate of openCandidates) {
    if (added.length >= count) break;
      if (isTitleCard(candidate.title) || isPlacePhoto(candidate.title) || isJunkTitle(candidate.title) || isUnsafeItem(candidate)) {
      skipped += 1;
      seen.add(candidate.key);
      continue;
    }
    try {
      console.log(`ingest ${added.length + 1}/${count} [${candidate.source}]: ${candidate.title}`);
      const item = await ingestOpenStill(candidate);
      if (!item) {
        skipped += 1;
        seen.add(candidate.key);
        console.log("  skip");
      } else {
        if (await keep(item, candidate.key)) {
          console.log(`  saved ${item.id} (${added.length} new)`);
        }
      }
    } catch (error) {
      skipped += 1;
      console.log(`  error: ${String(error).slice(0, 180)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  if (added.length < count) {
    const commons = shuffle(await collectCommonsCandidates(seen));
    console.log(`commons candidates: ${commons.length}`);
    for (const title of commons) {
      if (added.length >= count) break;
      if (isTitleCard(title)) {
        skipped += 1;
        seen.add(title);
        continue;
      }
      let ok = false;
      for (let attempt = 0; attempt < 3 && !ok; attempt++) {
        try {
          console.log(`ingest ${added.length + 1}/${count} [commons]: ${title}`);
          const item = await ingestCommonsStill(title, { lookupCredits: false });
          if (!item) {
            skipped += 1;
            seen.add(title);
            console.log("  skip (license/format)");
          } else {
            await keep(item, title);
            console.log(`  saved ${item.id} (${added.length} new)`);
          }
          ok = true;
        } catch (error) {
          const message = String(error);
          console.log(`  error: ${message.slice(0, 180)}`);
          if (message.includes("429") || message.includes("503")) {
            await new Promise((resolve) => setTimeout(resolve, 4000 * (attempt + 1)));
            continue;
          }
          skipped += 1;
          ok = true;
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 700));
    }
  }

  return {
    added,
    persisted,
    catalog,
    message: added.length
      ? `新收入 ${added.length} 张公共领域画面。`
      : `暂时没有抓到新的可授权画面（跳过 ${skipped}），将展示已有图库。`,
  };
}

export async function ingestPhotos(options?: {
  count?: number;
  persist?: boolean;
  prefer?: RegExp;
  memes?: boolean;
  art?: boolean;
}) {
  const count = options?.count ?? 30;
  const catalog = await loadCatalog();
  if (!(await acquireIngestLock())) {
    return {
      added: [] as CatalogItem[],
      persisted: false,
      catalog,
      message: "图库正在收录中，稍后再看。",
    };
  }

  try {
    const today = todayStamp();
    const seen = new Set(catalog.seenFileKeys);
    const added: CatalogItem[] = [];
    let skipped = 0;
    const persisted = options?.persist !== false;
    const memesOnly = options?.memes === true;
    const artOnly = options?.art === true;
    const raw = memesOnly
      ? await collectMemeCandidates(seen)
      : artOnly
        ? await collectArtCandidates(seen)
        : await collectPhotoCandidates(seen);
    const graphic = options?.prefer
      ?? /poster|runway|fashion|wpa|couture|art deco|theatrical|painting|meme|van gogh|monet|vermeer|hokusai|klimt|ukiyo|rembrandt|botticelli|fresco|pompeii|lascaux|furniture|morris|thonet|chippendale/i;
    const candidates = memesOnly || artOnly
      ? shuffle(raw)
      : [
          ...shuffle(raw.filter((item) => graphic.test(item.title))),
          ...shuffle(raw.filter((item) => !graphic.test(item.title))),
        ];
    console.log(`${memesOnly ? "meme" : artOnly ? "art" : "photo"} candidates: ${candidates.length}`);

    async function keep(item: CatalogItem, key: string) {
      const latest = await loadCatalog();
      if (isRepeatItem(item, latest)) {
        skipped += 1;
        seen.add(key);
        console.log("  skip (duplicate)");
        return false;
      }
      added.push(item);
      seen.add(key);
      if (item.fileKey) seen.add(item.fileKey);
      catalog.items = [item, ...latest.items.filter((row) => row.id !== item.id && row.fileKey !== item.fileKey)];
      catalog.seenFileKeys = [...new Set([...latest.seenFileKeys, ...seen])];
      catalog.seenContentHashes = [
        ...new Set([...(latest.seenContentHashes ?? []), ...(item.contentHash ? [item.contentHash] : [])]),
      ];
      catalog.lastIngestDate = today;
      if (options?.persist !== false) await saveCatalog(catalog);
      return true;
    }

    for (const candidate of candidates) {
      if (added.length >= count) break;
      if (isTitleCard(candidate.title) || isJunkTitle(candidate.title) || isUnsafeItem(candidate)) {
        skipped += 1;
        seen.add(candidate.key);
        continue;
      }
      try {
        console.log(`photo ${added.length + 1}/${count} [${candidate.sourceLabel || candidate.source}]: ${candidate.title}`);
        const item = await ingestOpenStill(candidate);
        if (!item) {
          skipped += 1;
          seen.add(candidate.key);
          console.log("  skip");
        } else {
          if (await keep(item, candidate.key)) {
            console.log(`  saved ${item.id} (${added.length} new)`);
          }
        }
      } catch (error) {
        skipped += 1;
        console.log(`  error: ${String(error).slice(0, 180)}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 400));
    }

    if (added.length < count) {
      const commons = shuffle(
        memesOnly
          ? await collectCommonsMemeCandidates(seen)
          : artOnly
            ? await collectCommonsArtCandidates(seen)
            : await collectCommonsCandidates(seen),
      );
      console.log(`commons ${memesOnly ? "meme" : artOnly ? "art" : "graphic"} candidates: ${commons.length}`);
      for (const title of commons) {
        if (added.length >= count) break;
        if (isTitleCard(title)) {
          skipped += 1;
          seen.add(title);
          continue;
        }
        try {
          console.log(`photo ${added.length + 1}/${count} [commons]: ${title}`);
          const item = await ingestCommonsStill(title, { lookupCredits: false });
          if (!item) {
            skipped += 1;
            seen.add(title);
            console.log("  skip");
          } else {
            await keep(item, title);
            console.log(`  saved ${item.id} (${added.length} new)`);
          }
        } catch (error) {
          skipped += 1;
          console.log(`  error: ${String(error).slice(0, 180)}`);
        }
        await new Promise((resolve) => setTimeout(resolve, 700));
      }
    }

    return {
      added,
      persisted,
      catalog,
      message: added.length
        ? memesOnly
          ? `新收入 ${added.length} 张可公开梗图。`
          : artOnly
            ? `新收入 ${added.length} 张名画 / 设计 / 古代壁画。`
            : `新收入 ${added.length} 张可公开摄影作品。`
        : memesOnly
          ? `暂时没有抓到新的可授权梗图（跳过 ${skipped}）。真正开放授权的梗图很少。`
          : artOnly
            ? `暂时没有抓到新的可授权名画或古代图像（跳过 ${skipped}）。`
            : `暂时没有抓到新的可授权摄影（跳过 ${skipped}）。`,
    };
  } finally {
    await releaseIngestLock();
  }
}
