/**
 * Import public-domain artist folders from a local disk archive into the catalog.
 * Skips living / still-copyrighted artists; only processes folders listed below.
 */
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { loadCatalog, saveCatalog } from "../src/lib/catalog";
import { isNearDuplicate } from "../src/lib/fingerprint";
import { stillFromBuffer } from "../src/lib/stillStore";

const ROOT = process.argv.find((a) => a.startsWith("--root="))?.slice(7) || "E:\\画集";
const PER_FOLDER = Number(process.argv.find((a) => a.startsWith("--per="))?.slice(5) || 20);
const MAX_BYTES = 90 * 1024 * 1024;

type FolderSpec = {
  dir: string;
  artist: string;
  artistZh: string;
  allowGray?: boolean;
  max?: number;
  preferExt?: RegExp;
};

/** Safe PD / life+70 folders only. Do not add Burgert, Hua Sanchuan, Lucian Freud, etc. */
const FOLDERS: FolderSpec[] = [
  { dir: "伦勃朗-油画", artist: "Rembrandt", artistZh: "伦勃朗", preferExt: /\.(tif|tiff|jpe?g)$/i, max: 18 },
  { dir: "提埃波罗", artist: "Giambattista Tiepolo", artistZh: "提埃波罗", preferExt: /\.jpe?g$/i, max: 20 },
  {
    dir: "【26号自由星】奥博利·比亚兹莱Aubrey Beardsley作品集",
    artist: "Aubrey Beardsley",
    artistZh: "比亚兹莱",
    allowGray: true,
    preferExt: /\.(jpe?g|png)$/i,
    max: 25,
  },
  { dir: "敦煌壁画合集(1)", artist: "Dunhuang mural", artistZh: "敦煌壁画", preferExt: /\.jpe?g$/i, max: 30 },
  {
    dir: "9331J.C.Leyendecker",
    artist: "J. C. Leyendecker",
    artistZh: "莱恩德克",
    preferExt: /\.(jpe?g|png)$/i,
    max: 22,
  },
];

const IMAGE_EXT = /\.(jpe?g|png|webp|tif|tiff)$/i;

async function walkImages(dir: string, preferExt?: RegExp): Promise<string[]> {
  const out: string[] = [];
  async function walk(current: string) {
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.name.startsWith(".")) continue;
      if (/\.downloading$/i.test(entry.name) || /\.baiduyun/i.test(entry.name)) continue;
      if (entry.isDirectory()) {
        await walk(full);
        continue;
      }
      if (!IMAGE_EXT.test(entry.name)) continue;
      if (preferExt && !preferExt.test(entry.name)) continue;
      out.push(full);
    }
  }
  await walk(dir);
  return out;
}

function sampleEvenly<T>(items: T[], count: number): T[] {
  if (items.length <= count) return items;
  const picked: T[] = [];
  const step = items.length / count;
  for (let i = 0; i < count; i++) {
    picked.push(items[Math.min(items.length - 1, Math.floor(i * step))]!);
  }
  return picked;
}

function titleFromPath(filePath: string, artistZh: string) {
  const base = path.basename(filePath).replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
  if (!base || /^img\s*\d+$/i.test(base) || /^\d+$/.test(base)) {
    return `${artistZh} · ${base || path.basename(filePath)}`;
  }
  return base.length > 90 ? `${base.slice(0, 87)}…` : base;
}

async function main() {
  const catalog = await loadCatalog();
  const seenKeys = new Set(catalog.seenFileKeys);
  const seenHashes = [...(catalog.seenContentHashes ?? [])];
  let added = 0;

  for (const folder of FOLDERS) {
    const dir = path.join(ROOT, folder.dir);
    const limit = folder.max ?? PER_FOLDER;
    let files: string[];
    try {
      files = await walkImages(dir, folder.preferExt);
    } catch (error) {
      console.log(`skip missing ${folder.dir}: ${String(error).slice(0, 120)}`);
      continue;
    }
    if (files.length === 0) {
      console.log(`empty (likely still RAR/downloading): ${folder.dir}`);
      continue;
    }
    const sized: { file: string; size: number }[] = [];
    for (const file of files) {
      try {
        const info = await stat(file);
        if (info.size < 8000 || info.size > MAX_BYTES) continue;
        sized.push({ file, size: info.size });
      } catch {
        // ignore
      }
    }
    // Prefer mid-size files (often better scans than tiny thumbs / giant dumps)
    sized.sort((a, b) => a.size - b.size);
    const mid = sized.slice(Math.floor(sized.length * 0.15), Math.ceil(sized.length * 0.9));
    const pool = mid.length >= limit ? mid : sized;
    const picks = sampleEvenly(pool, limit);
    console.log(`\n${folder.artistZh} (${folder.artist}): ${files.length} files → try ${picks.length}`);

    let folderAdded = 0;
    for (const pick of picks) {
      const key = `local:${folder.artist}:${path.basename(pick.file)}`.toLowerCase();
      if (seenKeys.has(key)) continue;
      let buffer: Buffer;
      try {
        buffer = await readFile(pick.file);
      } catch (error) {
        console.log(`  read fail: ${path.basename(pick.file)} ${String(error).slice(0, 80)}`);
        continue;
      }
      const title = titleFromPath(pick.file, folder.artistZh);
      const item = await stillFromBuffer({
        buffer,
        title,
        source: "user",
        author: folder.artist,
        license: "Public domain (artist deceased); local museum/scan archive",
        fileKey: key,
        kind: "photo",
        sourceLabel: `${folder.artistZh} · 本地公版画集`,
        allowGray: folder.allowGray,
      });
      if (!item) {
        console.log(`  skip ${path.basename(pick.file)}`);
        continue;
      }
      if (item.contentHash && isNearDuplicate(item.contentHash, seenHashes)) {
        console.log(`  dup ${path.basename(pick.file)}`);
        continue;
      }
      catalog.items.unshift(item);
      seenKeys.add(key);
      catalog.seenFileKeys.push(key);
      if (item.contentHash) {
        seenHashes.push(item.contentHash);
        catalog.seenContentHashes = catalog.seenContentHashes ?? [];
        catalog.seenContentHashes.push(item.contentHash);
      }
      folderAdded += 1;
      added += 1;
      console.log(`  + ${item.title.slice(0, 70)}`);
    }
    console.log(`  folder done: +${folderAdded}`);
  }

  if (added > 0) {
    await saveCatalog(catalog);
  }
  console.log(`\nimported ${added}; catalog size ${catalog.items.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
