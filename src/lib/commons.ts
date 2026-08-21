import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import "./proxy";
import { analyzeImageBuffer, isColorful } from "./analyze";
import { knownCredits, lookupFilm, parseFilmTitle } from "./filmMeta";
import { looksLikeMeme } from "./classify";
import { isTitleCard, sourceLabel, guessKind } from "./mediaKind";
import { parseCreator } from "./creator";
import { imageFingerprint, isUnsafeItem } from "./fingerprint";
import type { CatalogItem } from "./types";

const COMMONS_API = "https://commons.wikimedia.org/w/api.php";
const USER_AGENT =
  "FilmPalette/1.0 (public-domain film color archive; educational)";

const CATEGORIES = [
  "Category:Nosferatu_(1922_film)",
  "Category:Metropolis_(1927_film)",
  "Category:The_Cabinet_of_Dr._Caligari",
  "Category:Night_of_the_Living_Dead_(1968_film)",
  "Category:Charade_(1963_film)",
  "Category:Le_Voyage_dans_la_Lune",
  "Category:The_Great_Train_Robbery_(1903_film)",
  "Category:The_Phantom_of_the_Opera_(1925_film)",
  "Category:The_General_(1926_film)",
  "Category:The_Kid_(1921_film)",
  "Category:The_Gold_Rush_(film)",
  "Category:Sunrise:_A_Song_of_Two_Humans",
  "Category:The_Passion_of_Joan_of_Arc",
  "Category:Safety_Last!",
  "Category:Steamboat_Bill_Jr.",
  "Category:All_Quiet_on_the_Western_Front_(1930_film)",
  "Category:Battleship_Potemkin_(film)",
  "Category:Man_with_a_Movie_Camera",
  "Category:Pandora's_Box_(1929_film)",
  "Category:Faust_(1926_film)",
  "Category:His_Girl_Friday",
  "Category:Carnival_of_Souls",
  "Category:The_Little_Shop_of_Horrors",
  "Category:Plan_9_from_Outer_Space",
  "Category:King_of_Jazz",
  "Category:The_Circus_(1928_film)",
  "Category:The_Toll_of_the_Sea",
  "Category:Becky_Sharp_(film)",
  "Category:The_Memphis_Belle:_A_Story_of_a_Flying_Fortress",
  "Category:The_Thief_of_Bagdad_(1940_film)",
  "Category:Film_stills",
  "Category:Technicolor_films",
  "Category:Charade_(1963_film)",
  "Category:Screenshots_of_Big_Buck_Bunny",
  "Category:Screenshots_of_Sintel",
  "Category:Screenshots_of_Elephants_Dream",
  "Category:Screenshots_of_Tears_of_Steel",
  "Category:Screenshots_of_Caminandes",
  "Category:Screenshots_of_Cosmos_Laundromat",
  "Category:The_Goddess_(1934_film)",
  "Category:Street_Angel_(1937_film)",
  "Category:Spring_in_a_Small_Town",
  "Category:Films_of_China",
  "Category:Japanese_films",
  "Category:French_films",
  "Category:German_films",
  "Category:Italian_films",
  "Category:Soviet_films",
  "Category:Publicity_photographs_of_silent_films",
  "Category:Film_stills",
  "Category:Film_trailer_screenshots",
  "Category:WPA_posters",
  "Category:Film_posters_of_silent_films",
  "Category:1920s_film_posters",
  "Category:1910s_film_posters",
  "Category:Film_posters_of_the_United_States",
  "Category:Paintings_by_Vincent_van_Gogh",
  "Category:Paintings_by_Claude_Monet",
  "Category:Ukiyo-e",
  "Category:Frescoes_of_Pompeii",
  "Category:Cave_paintings",
  "Category:Lascaux",
  "Category:Ancient_Egyptian_paintings",
];

const SEARCH_QUERIES = [
  "Nosferatu 1922 film still",
  "Metropolis 1927 film still",
  "The Circus Chaplin 1928 still",
  "Toll of the Sea 1922 technicolor still",
  "Becky Sharp 1935 technicolor still",
  "Memphis Belle 1944 film still",
  "Thief of Bagdad public domain still",
  "Technicolor public domain film still",
  "King of Jazz 1930 still",
  "Charade Hepburn 1963 color still",
  "Tears of Steel screenshot",
  "Sintel Blender screenshot",
  "Big Buck Bunny screenshot",
  "Caminandes screenshot",
  "The Goddess 1934 神女 still",
  "Street Angel 1937 马路天使 still",
  "Spring in a Small Town 小城之春 still",
  "Rashomon 1950 still",
  "Tokyo Story 东京物语 still",
  "Ugetsu 雨月物语 still",
  "The Rules of the Game Renoir still",
  "Bicycle Thieves 1948 still",
  "Ivan the Terrible Eisenstein color still",
  "Technicolor public domain still",
  "Van Gogh Starry Night",
  "Girl with a Pearl Earring Vermeer",
  "Hokusai Great Wave",
  "Monet Water Lilies",
  "The Kiss Klimt",
  "Pompeii fresco",
  "Lascaux cave painting",
  "Altamira cave painting",
  "Egyptian tomb painting",
  "Knossos fresco",
  "Giotto Scrovegni",
  "Bosch Garden of Earthly Delights",
  "William Morris wallpaper",
  "Thonet chair",
  "Chippendale furniture",
];

const ALLOWED_LICENSE =
  /public domain|pd-|cc0|cc.by|cc-by|creative commons attribution/i;
const BLOCKED_LICENSE = /fair use|non-?free|all rights reserved/i;

type ImageInfo = {
  title: string;
  mime?: string;
  size?: number;
  width?: number;
  height?: number;
  url?: string;
  thumburl?: string;
  descriptionurl?: string;
  extmetadata?: Record<string, { value?: string }>;
};

function commonsHeaders(): HeadersInit {
  return {
    "User-Agent": USER_AGENT,
    Accept: "application/json",
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchOk(url: string | URL, extra?: RequestInit) {
  let lastError = new Error("fetch failed");
  for (let attempt = 0; attempt < 5; attempt++) {
    const response = await fetch(url, {
      ...extra,
      headers: { ...commonsHeaders(), ...(extra?.headers ?? {}) },
      signal: extra?.signal ?? AbortSignal.timeout(25000),
    });
    if (response.status === 429 || response.status === 503) {
      lastError = new Error(`HTTP ${response.status} ${url.toString()}`);
      await sleep(1500 * (attempt + 1));
      continue;
    }
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${url.toString()}`);
    }
    return response;
  }
  throw lastError;
}

async function commonsGet(params: Record<string, string>) {
  const url = new URL(COMMONS_API);
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  const response = await fetchOk(url);
  return response.json() as Promise<Record<string, unknown>>;
}

function stripTags(value?: string) {
  return (value ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function licenseOk(info: ImageInfo) {
  const meta = info.extmetadata ?? {};
  const license = stripTags(meta.LicenseShortName?.value || meta.UsageTerms?.value);
  const copyrighted = stripTags(meta.Copyrighted?.value);
  if (BLOCKED_LICENSE.test(license)) return false;
  if (/^true$/i.test(copyrighted) && !ALLOWED_LICENSE.test(license)) return false;
  return ALLOWED_LICENSE.test(license) || /^pd/i.test(license);
}

async function listCategoryFiles(category: string) {
  const titles: string[] = [];
  let continueToken: string | undefined;
  for (let page = 0; page < 8; page++) {
    const data = await commonsGet({
      action: "query",
      list: "categorymembers",
      cmtitle: category,
      cmtype: "file",
      cmlimit: "50",
      ...(continueToken ? { cmcontinue: continueToken } : {}),
    });
    const members = (
      data.query as { categorymembers?: { title: string }[] } | undefined
    )?.categorymembers;
    for (const member of members ?? []) titles.push(member.title);
    continueToken = (data.continue as { cmcontinue?: string } | undefined)
      ?.cmcontinue;
    if (!continueToken) break;
  }
  return titles;
}

async function imageInfoFor(titles: string[]) {
  if (!titles.length) return [] as ImageInfo[];
  const data = await commonsGet({
    action: "query",
    titles: titles.join("|"),
    prop: "imageinfo",
    iiprop: "url|extmetadata|mime|size",
    iiurlwidth: "1280",
  });
  const pages = (data.query as { pages?: Record<string, { title: string; imageinfo?: ImageInfo[] }> })
    ?.pages;
  return Object.values(pages ?? {}).map((page) => ({
    title: page.title,
    ...(page.imageinfo?.[0] ?? {}),
  }));
}

async function searchCommonsFiles(query: string) {
  const titles: string[] = [];
  const data = await commonsGet({
    action: "query",
    list: "search",
    srsearch: query,
    srnamespace: "6",
    srlimit: "30",
  });
  const hits = (data.query as { search?: { title: string }[] } | undefined)?.search;
  for (const hit of hits ?? []) titles.push(hit.title);
  return titles;
}

export async function collectCommonsCandidates(seen: Set<string>) {
  const titles = new Set<string>();
  for (const category of CATEGORIES) {
    try {
      const files = await listCategoryFiles(category);
      for (const title of files) {
        if (!seen.has(title) && !isTitleCard(title)) titles.add(title);
      }
    } catch {
      // Skip a missing or rate-limited category and keep going.
    }
  }
  for (const query of SEARCH_QUERIES) {
    try {
      const files = await searchCommonsFiles(query);
      for (const title of files) {
        if (!seen.has(title) && !isTitleCard(title)) titles.add(title);
      }
    } catch {
      // Search is optional; categories may already be enough.
    }
    await sleep(250);
  }
  return [...titles];
}

const MEME_SEARCH_QUERIES = [
  'reaction meme incategory:"CC-Zero"',
  'funny animal meme incategory:"CC-Zero"',
  'trollface clipart incategory:"CC-Zero"',
  "trollface clipart",
  "reaction meme",
  "reaction image",
  "funny animal meme",
  "confused animal",
  "surprised cat meme",
  "wojak meme",
  "blank meme template",
  "facepalm meme",
  "public domain meme",
  "vintage funny advertisement",
];

export async function collectCommonsMemeCandidates(seen: Set<string>) {
  const titles = new Set<string>();
  for (const query of MEME_SEARCH_QUERIES) {
    try {
      const files = await searchCommonsFiles(query);
      for (const title of files) {
        if (seen.has(title) || isTitleCard(title) || !looksLikeMeme(title)) continue;
        titles.add(title);
      }
    } catch {
      // Commons is rate-limited from this machine; Openverse can still fill.
    }
    await sleep(400);
  }
  return [...titles];
}

const ART_SEARCH_QUERIES = [
  "tattoo flash sheet",
  "american traditional tattoo flash",
  "japanese irezumi",
  "Sailor Jerry tattoo",
  "tattoo design drawing",
  "henna design pattern",
  "tribal tattoo pattern",
  "engraving tattoo",
  "Charles Frederick Worth gown",
  "Paul Poiret fashion",
  "Madeleine Vionnet dress",
  "fashion plate 1890",
  "Met Costume Institute",
  "ball gown museum",
  "Mary Quant dress",
  "Pompeii fresco",
  "Herculaneum fresco",
  "Lascaux cave painting",
  "Altamira bison",
  "Egyptian tomb painting",
  "Knossos bull fresco",
  "Giotto Scrovegni fresco",
  "Bosch Garden of Earthly Delights",
  "William Morris strawberry thief",
  "Thonet chair",
  "Chippendale chair",
  "Fayum portrait",
  "Dunhuang Mogao mural",
  "Kizil Caves mural",
  "Yungang Grottoes",
  "Ajanta caves painting",
  "Venus de Milo",
  "Terracotta Army",
  "Greek marble sculpture",
  "Bonampak mural",
  "Iznik tiles",
  "NASA Earth photograph",
  "aerial landscape photograph",
  "Tibetan thangka",
  "Chinese nianhua",
  "graffiti mural",
  "folk textile embroidery",
  "Yangliuqing nianhua",
  "Taohuawu nianhua",
  "Chinese paper cutting",
  "Chinese blue and white porcelain",
  "Yunjin brocade",
];

const FASHION_SEARCH_QUERIES = [
  "Charles Frederick Worth gown",
  "Paul Poiret fashion",
  "Madeleine Vionnet dress",
  "fashion plate 1890",
  "fashion plate 1910",
  "Met Costume Institute",
  "ball gown museum",
  "Mary Quant dress",
  "Courreges dress",
  "Pierre Cardin dress",
  "Victoria and Albert Museum dress",
  "Rijksmuseum costume",
];

export async function collectCommonsArtCandidates(seen: Set<string>, options?: { fashionOnly?: boolean }) {
  const titles = new Set<string>();
  const queries = options?.fashionOnly ? FASHION_SEARCH_QUERIES : ART_SEARCH_QUERIES;
  for (const query of queries) {
    try {
      const files = await searchCommonsFiles(query);
      for (const title of files) {
        if (seen.has(title) || isTitleCard(title)) continue;
        titles.add(title);
      }
    } catch {
      // Commons is often 429; Openverse/LOC can still fill.
    }
    await sleep(400);
  }
  return [...titles];
}

export async function ingestCommonsStill(
  fileTitle: string,
  options?: { lookupCredits?: boolean },
): Promise<CatalogItem | null> {
  const [info] = await imageInfoFor([fileTitle]);
  if (!info?.url && !info?.thumburl) return null;
  if (info.mime && !info.mime.startsWith("image/")) return null;
  if (info.mime === "image/svg+xml") return null;
  if ((info.width ?? 400) < 240) return null;
  if (!licenseOk(info)) return null;
  if (isTitleCard(fileTitle) || isUnsafeItem({ title: fileTitle, fileKey: fileTitle })) return null;

  const imageUrl = info.thumburl || info.url;
  if (!imageUrl) return null;

  const imageResponse = await fetchOk(imageUrl);
  const buffer = Buffer.from(await imageResponse.arrayBuffer());
  const analysis = await analyzeImageBuffer(buffer);
  if (!isColorful(analysis) && !looksLikeMeme(fileTitle)) return null;
  const id = crypto.randomUUID();

  let localUrl = "";
  try {
    const jpeg = await sharp(buffer)
      .rotate()
      .resize({ width: 1280, withoutEnlargement: true })
      .jpeg({ quality: 78 })
      .toBuffer();
    const dir = path.join(process.cwd(), "public", "stills");
    await mkdir(dir, { recursive: true });
    const filename = `${id}.jpg`;
    await writeFile(path.join(dir, filename), jpeg);
    localUrl = `/stills/${filename}`;
  } catch {
    localUrl = "";
  }

  const meta = info.extmetadata ?? {};
  const title =
    stripTags(meta.ObjectName?.value || meta.ImageDescription?.value) ||
    fileTitle.replace(/^File:/, "").replace(/\.[^.]+$/, "");
  const author = stripTags(meta.Artist?.value) || "Wikimedia Commons";
  const license =
    stripTags(meta.LicenseShortName?.value) || "Public domain / free license";
  const licenseUrl = stripTags(meta.LicenseUrl?.value);
  const query = parseFilmTitle(fileTitle);
  const credits =
    options?.lookupCredits === false
      ? knownCredits(query) ?? {
          titleEn: query || title,
          titleZh: "未注明",
          director: "未注明",
        }
      : await lookupFilm(query);

  return {
    id,
    title,
    titleEn: credits.titleEn,
    titleZh: credits.titleZh,
    director: credits.director,
    source: "commons",
    imageUrl: localUrl || imageUrl,
    thumbUrl: localUrl || imageUrl,
    pageUrl: info.descriptionurl,
    author,
    license,
    licenseUrl: licenseUrl || info.descriptionurl,
    buckets: analysis.buckets,
    palette: analysis.palette,
    addedAt: new Date().toISOString(),
    fileKey: fileTitle,
    kind: guessKind({ title, source: "commons", fileKey: fileTitle }),
    photographer: parseCreator(title, author) || author,
    sourceLabel: sourceLabel("commons"),
    contentHash: await imageFingerprint(buffer),
  };
}
