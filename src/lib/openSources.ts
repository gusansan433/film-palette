import "./proxy";
import { stillFromBuffer } from "./stillStore";
import { looksLikeMeme } from "./classify";
import { isUnsafeItem } from "./fingerprint";
import type { CatalogItem } from "./types";

const USER_AGENT =
  "FilmPalette/1.0 (public-domain film color archive; educational)";
const OPENVERSE = "https://api.openverse.org/v1/images/";
const LOC_SEARCH = "https://www.loc.gov/photos/";
const ARCHIVE_SEARCH = "https://archive.org/advancedsearch.php";

const BLOCKED_HOST = /wikimedia|upload\.wikimedia/i;
const ALLOWED_LICENSE = /cc0|pdm|pd-|public domain|no known restrictions|cc-by|by-sa|by$/i;
const BLOCKED_LICENSE = /fair use|all rights reserved|non-?commercial|nc-|nd-/i;
const BLOCKED_TITLE =
  /pinocchio|disney|wizard of oz|black narcissus|gone with the wind|casablanca|star wars|broadway rhythm|snow white|bambi|fantasia|mickey mouse|marvel|pokemon|pikachu|nintendo|spongebob|minions|harry potter|banksy|basquiat|keith haring|alexander mcqueen|mcqueen runway|vogue magazine|vintage vogue|balenciaga runway|balenciaga campaign|chanel runway|dior runway|dior campaign|lookbook|pinterest|instagram|naruto|cyberpunk|lannister|game of thrones|euphoria|fallout|caesar'?s legion|spider-?man|batman|fortnite|genshin|anime meme|meme edit/i;

/** Curated PD / safer film-still targets. Skip copyrighted titles (Black Narcissus / Oz). */
const FILM_STILL_QUERIES = [
  "nosferatu 1922 film still public domain",
  "nosferatu murnau movie still",
  "nosferatu lobby card",
  "metropolis 1927 film still public domain",
  "metropolis lang movie still",
  "metropolis 1927 frame",
  "the circus chaplin 1928 film still",
  "chaplin circus movie still public domain",
  "toll of the sea 1922 technicolor still",
  "toll of the sea film still public domain",
  "becky sharp 1935 technicolor still",
  "becky sharp film still public domain",
  "gulf between 1917 film still",
  "thief of bagdad public domain film still",
  "thief of bagdad commons still",
  "memphis belle 1944 film still",
  "memphis belle documentary still public domain",
  "technicolor public domain film still",
  "library of congress film still",
  "library of congress movie still",
  "nasa color film photograph",
  "wwii documentary film still public domain",
  "world war ii propaganda film still",
  "aviation documentary film still public domain",
  "movie still lobby card public domain",
  "silent film still public domain",
];

const QUERIES = [
  ...FILM_STILL_QUERIES,
  "charade 1963 color still",
  "king of jazz 1930 technicolor still",
  "sintel blender screenshot",
  "tears of steel screenshot",
  "big buck bunny screenshot",
  "elephants dream screenshot",
  "cosmos laundromat screenshot",
  "caminandes blender screenshot",
  "神女 1934 still",
  "马路天使 1937 still",
  "小城之春 still",
  "night of the living dead 1968 still",
  "his girl friday still",
  "carnival of souls still",
  "plan 9 from outer space still",
  "rashomon kurosawa still",
  "technicolor film still public domain",
];

export type OpenCandidate = {
  key: string;
  title: string;
  imageUrl: string;
  pageUrl: string;
  author: string;
  license: string;
  licenseUrl?: string;
  source: Exclude<CatalogItem["source"], "user">;
  kind?: CatalogItem["kind"];
  sourceLabel?: string;
  /** Extra text for ingest prefer ranking (e.g. tattoo query hits whose titles omit the word). */
  preferText?: string;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchOk(url: string | URL) {
  let lastError = new Error("fetch failed");
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json,image/*" },
      signal: AbortSignal.timeout(25000),
    });
    if (response.status === 429 || response.status === 503) {
      lastError = new Error(`HTTP ${response.status} ${url.toString()}`);
      await sleep(2000 * (attempt + 1));
      continue;
    }
    if (!response.ok) throw new Error(`HTTP ${response.status} ${url.toString()}`);
    return response;
  }
  throw lastError;
}

function licenseOk(license: string) {
  if (BLOCKED_LICENSE.test(license)) return false;
  return ALLOWED_LICENSE.test(license);
}

function looksLikeFilm(text: string) {
  return /\b(film|movie|cinema|trailer|screenshot|motion picture|silent film|lobby card|frame|nosferatu|metropolis|chaplin|keaton|murnau|melies|caligari|pickford|fairbanks|charade|sintel|blender|toll of the sea|becky sharp|gulf between|thief of bagdad|memphis belle|technicolor)\b/i.test(
    text,
  );
}

const CAT_QUERIES = [
  "cute kitten",
  "fluffy cat photograph",
  "orange tabby cat",
  "sleeping kitten",
  "sleeping cat photograph",
  "kitten portrait",
  "cat portrait photograph",
  "cat close up photograph",
  "cute cat photograph",
  "ginger kitten",
  "white kitten photograph",
  "tabby kitten portrait",
  "cat looking at camera",
  "cat in box photograph",
  "cat behind window",
  "cat hiding photograph",
  "cat staring photograph",
  "funny cat photograph",
];

/** Tattoo reference: prefer flash / designs / engravings / museum patterns over body photos. */
const TATTOO_QUERIES = [
  "tattoo flash sheet",
  "american traditional tattoo flash",
  "japanese irezumi print",
  "sailor jerry style tattoo",
  "blackwork tattoo photograph",
  "tattoo design drawing public domain",
  "tribal tattoo pattern museum",
  "engraving tattoo reference",
  "henna design pattern",
  "illustration tattoo flash cc0",
  "tattoo flash illustration",
  "vintage tattoo flash sheet",
  "japanese woodblock tattoo motif",
  "maori tattoo pattern museum",
  "polynesian tattoo pattern drawing",
  "celtic knot tattoo design",
  "rose tattoo flash drawing",
  "anchor tattoo flash illustration",
  "skull tattoo flash illustration",
  "serpent tattoo engraving",
];

/**
 * Costume / fashion refs for indie game art.
 * Prefer museum object photos + PD fashion plates; skip commercial runway / Vogue / brand ads.
 */
const FASHION_QUERIES = [
  "charles frederick worth gown museum",
  "charles frederick worth fashion illustration",
  "worth paris gown met",
  "paul poiret gown museum",
  "paul poiret fashion illustration",
  "madeleine vionnet dress museum",
  "vionnet bias cut dress museum",
  "early 20th century haute couture museum",
  "1950s paris haute couture photograph commons",
  "1960s space age fashion museum",
  "pierre cardin dress museum",
  "courreges dress museum",
  "mary quant dress museum",
  "1960s mod fashion museum",
  "met costume institute dress",
  "met museum costume gown",
  "victoria and albert museum dress",
  "victoria and albert museum fashion",
  "rijksmuseum costume dress",
  "rijksmuseum costume painting",
  "art nouveau fashion illustration",
  "19th century ball gown museum",
  "fashion plate 1890",
  "fashion plate 1900",
  "fashion plate 1910",
  "historical dress pattern plate",
  "costume design museum dress",
  "empire waist gown museum",
  "edwardian gown museum",
  "regency dress museum",
];

const PHOTO_QUERIES = [
  ...CAT_QUERIES,
  ...TATTOO_QUERIES,
  ...FASHION_QUERIES,
  "cinematic photography",
  "golden hour portrait",
  "neon night street",
  "kodachrome photograph",
  "sunset landscape photograph",
  "blue hour city",
  "red lantern night",
  "analog film photography",
  "street photography color",
  "still life flower photograph",
  "hong kong neon photograph",
  "tokyo night photograph",
  "desert landscape color",
  "ocean sunset photograph",
  "rain window photograph",
  "vintage movie poster",
  "silent film poster",
  "wpa poster",
  "theatrical poster",
  "art deco poster",
  "travel poster vintage",
  "circus poster",
  "soviet film poster",
  "poster design vintage",
  "van gogh starry night",
  "vermeer girl with a pearl earring",
  "monet water lilies",
  "hokusai great wave",
  "botticelli birth of venus",
  "klimt the kiss",
  "rembrandt night watch",
  "ukiyo-e print",
  "chinese landscape painting",
  "cezanne still life painting",
  "internet meme",
  "classic meme",
  "reaction meme",
  "museum oil painting",
  "architectural interior photograph",
  "nasa earth photograph",
  "vintage magazine illustration",
  "stained glass window photograph",
  "color still life painting",
];

const PHOTO_SOURCES =
  "flickr,stocksnap,rawpixel,nappy,wordpress,justtakeitfree,met,rijksmuseum,europeana,clevelandmuseum,brooklynmuseum,smithsonian_cooper_hewitt_museum,smithsonian_american_art_museum,nypl,smk,nasa";

function isFilmFrame(title: string) {
  return /\b(trailer|screenshot|film still|movie still|still from)\b/i.test(title) && !/\bposter\b/i.test(title);
}

function providerLabel(provider?: string) {
  const name = (provider || "").toLowerCase();
  if (name.includes("flickr")) return "Flickr";
  if (name.includes("stocksnap")) return "StockSnap";
  if (name.includes("rawpixel")) return "Rawpixel";
  if (name.includes("nappy")) return "Nappy";
  if (name.includes("cooper_hewitt")) return "Cooper Hewitt";
  if (name.includes("smithsonian")) return "Smithsonian";
  if (name.includes("rijksmuseum")) return "Rijksmuseum";
  if (name.includes("europeana")) return "Europeana";
  if (name === "met") return "Met Museum";
  if (name.includes("nypl")) return "纽约公共图书馆";
  if (name.includes("cleveland")) return "Cleveland Museum";
  if (name.includes("brooklyn")) return "Brooklyn Museum";
  if (name === "smk") return "SMK";
  if (name === "nasa") return "NASA";
  return "Openverse";
}

async function collectOpenverse(seen: Set<string>) {
  const found: OpenCandidate[] = [];
  for (const query of QUERIES) {
    for (const page of [1, 2, 3]) {
      try {
        const url = new URL(OPENVERSE);
        url.searchParams.set("q", query);
        url.searchParams.set("license", "cc0,pdm,by,by-sa");
        url.searchParams.set("category", "photograph");
        url.searchParams.set("excluded_source", "wikimedia");
        url.searchParams.set("page_size", "20");
        url.searchParams.set("page", String(page));
        url.searchParams.set("mature", "false");
        const data = (await (await fetchOk(url)).json()) as {
          results?: {
            id: string;
            title?: string;
            url?: string;
            thumbnail?: string;
            foreign_landing_url?: string;
            creator?: string;
            license?: string;
            license_url?: string;
            provider?: string;
            width?: number;
            height?: number;
          }[];
        };
        for (const row of data.results ?? []) {
          const imageUrl = row.url || row.thumbnail;
          if (!imageUrl || BLOCKED_HOST.test(imageUrl) || BLOCKED_HOST.test(row.provider ?? "")) {
            continue;
          }
          if ((row.width ?? 400) < 240) continue;
          const license = row.license ?? "";
          if (!licenseOk(license)) continue;
          const title = row.title || query;
          const blob = `${title} ${row.creator ?? ""}`;
          if (!looksLikeFilm(blob)) continue;
          const key = `openverse:${row.id}`;
          if (seen.has(key)) continue;
          found.push({
            key,
            title,
            imageUrl,
            pageUrl: row.foreign_landing_url || imageUrl,
            author: row.creator || row.provider || "Openverse",
            license: license.toUpperCase(),
            licenseUrl: row.license_url,
            source: "openverse",
            kind: "film",
          });
        }
      } catch (error) {
        console.log(`openverse skip (${query} p${page}): ${String(error).slice(0, 140)}`);
        break;
      }
      await sleep(250);
    }
  }
  return found;
}

async function collectOpenversePhotos(seen: Set<string>, options?: { cats?: boolean }) {
  const found: OpenCandidate[] = [];
  const queries = options?.cats ? CAT_QUERIES : PHOTO_QUERIES;
  const pages = options?.cats ? [1, 2, 3] : [1, 2];
  for (const query of queries) {
    for (const page of pages) {
      try {
        const url = new URL(OPENVERSE);
        url.searchParams.set("q", query);
        url.searchParams.set("license", "cc0,pdm,by,by-sa");
        url.searchParams.set("category", "photograph");
        url.searchParams.set("excluded_source", "wikimedia");
        url.searchParams.set("page_size", "20");
        url.searchParams.set("page", String(page));
        url.searchParams.set("mature", "false");
        const data = (await (await fetchOk(url)).json()) as {
          results?: {
            id: string;
            title?: string;
            url?: string;
            thumbnail?: string;
            foreign_landing_url?: string;
            creator?: string;
            license?: string;
            license_url?: string;
            provider?: string;
            width?: number;
            height?: number;
          }[];
        };
        for (const row of data.results ?? []) {
          const imageUrl = row.url || row.thumbnail;
          const provider = (row.provider ?? "").toLowerCase();
          if (!imageUrl || BLOCKED_HOST.test(imageUrl) || BLOCKED_HOST.test(provider)) {
            continue;
          }
          if (!PHOTO_SOURCES.split(",").some((name) => provider.includes(name))) {
            continue;
          }
          if ((row.width ?? 400) < 320) continue;
          const license = row.license ?? "";
          if (!licenseOk(license)) continue;
          const title = row.title || query;
          if (BLOCKED_TITLE.test(title) || isFilmFrame(title)) continue;
          if (isUnsafeItem({ title, author: row.creator ?? "", pageUrl: row.foreign_landing_url })) continue;
          const key = `openverse:${row.id}`;
          if (seen.has(key)) continue;
          found.push({
            key,
            title,
            imageUrl,
            pageUrl: row.foreign_landing_url || imageUrl,
            author: row.creator || row.provider || "Photographer",
            license: license.toUpperCase(),
            licenseUrl: row.license_url,
            source: "openverse",
            kind: "photo",
            sourceLabel: providerLabel(row.provider),
          });
        }
      } catch (error) {
        console.log(`openverse photo skip (${query} p${page}): ${String(error).slice(0, 140)}`);
        break;
      }
      await sleep(250);
    }
  }
  return found;
}

async function collectLocPhotos(seen: Set<string>) {
  const found: OpenCandidate[] = [];
  const searches = [
    "kodachrome color photograph",
    "farm security administration color",
    "prokudin-gorskii",
    "color slide photograph",
    "gordon parks fsa photograph",
    "wpa posters",
    "movie posters",
    "theatrical posters",
    "travel posters",
    "circus posters",
    "oil painting",
    "color photograph",
    "portrait painting",
  ].flatMap((q) => [1, 41, 81].map((sp) => ({ q, sp })));
  for (const search of searches) {
    try {
      const url = new URL(LOC_SEARCH);
      url.searchParams.set("q", search.q);
      url.searchParams.set("fo", "json");
      url.searchParams.set("c", "40");
      url.searchParams.set("sp", String(search.sp));
      const data = (await (await fetchOk(url)).json()) as {
        results?: {
          id?: string;
          title?: string | string[];
          url?: string;
          image_url?: string[];
          item?: { rights?: string[] };
        }[];
      };
      for (const row of data.results ?? []) {
        const rightsRaw = row.item?.rights;
        const rights = Array.isArray(rightsRaw)
          ? rightsRaw.join(" ")
          : String(rightsRaw ?? "");
        if (rights && !licenseOk(rights) && !/no known restrictions/i.test(rights)) continue;
        const images = (row.image_url ?? [])
          .map((src) => (src.startsWith("//") ? `https:${src}` : src))
          .filter((src) => /^https?:/i.test(src));
        const imageUrl = images.at(-1);
        if (!imageUrl || BLOCKED_HOST.test(imageUrl)) continue;
        const rawTitle = row.title;
        const title = Array.isArray(rawTitle) ? String(rawTitle[0] ?? "") : String(rawTitle ?? "");
        const key = `loc:${row.id || imageUrl}`;
        if (!title || seen.has(key) || BLOCKED_TITLE.test(title) || isFilmFrame(title)) continue;
        found.push({
          key,
          title,
          imageUrl,
          pageUrl: row.url || `https://www.loc.gov${row.id ?? ""}`,
          author: "Library of Congress",
          license: rights || "No known restrictions / public domain",
          source: "loc",
          kind: "photo",
          sourceLabel: "美国国会图书馆",
        });
      }
    } catch (error) {
      console.log(`loc photo skip (${search.q}): ${String(error).slice(0, 140)}`);
    }
    await sleep(300);
  }
  return found;
}

async function collectLoc(seen: Set<string>) {
  const found: OpenCandidate[] = [];
  const searches = [
    { q: "motion picture stills", sp: 1 },
    { q: "motion picture stills", sp: 41 },
    { q: "motion picture stills", sp: 81 },
    { q: "chaplin film still", sp: 1 },
    { q: "the circus chaplin still", sp: 1 },
    { q: "nosferatu film still", sp: 1 },
    { q: "metropolis 1927 still", sp: 1 },
    { q: "toll of the sea still", sp: 1 },
    { q: "becky sharp still", sp: 1 },
    { q: "memphis belle film still", sp: 1 },
    { q: "world war ii film still", sp: 1 },
    { q: "buster keaton still", sp: 1 },
    { q: "mary pickford still", sp: 1 },
    { q: "douglas fairbanks still", sp: 1 },
    { q: "silent film actress still", sp: 1 },
    { q: "technicolor film still", sp: 1 },
    { q: "color motion picture still", sp: 1 },
    { q: "movie still", sp: 1 },
    { q: "film still", sp: 1 },
    { q: "night of the living dead still", sp: 1 },
    { q: "his girl friday still", sp: 1 },
    { q: "charade 1963 still", sp: 1 },
  ];
  for (const search of searches) {
    try {
      const url = new URL(LOC_SEARCH);
      url.searchParams.set("q", search.q);
      url.searchParams.set("fo", "json");
      url.searchParams.set("c", "40");
      url.searchParams.set("sp", String(search.sp));
      const data = (await (await fetchOk(url)).json()) as {
        results?: {
          id?: string;
          title?: string | string[];
          url?: string;
          image_url?: string[];
          description?: string[];
          item?: { rights?: string[]; medium?: string[] };
        }[];
      };
      for (const row of data.results ?? []) {
        const rightsRaw = row.item?.rights;
        const rights = Array.isArray(rightsRaw)
          ? rightsRaw.join(" ")
          : String(rightsRaw ?? "");
        if (rights && !licenseOk(rights) && !/no known restrictions/i.test(rights)) continue;
        const images = (row.image_url ?? [])
          .map((src) => (src.startsWith("//") ? `https:${src}` : src))
          .filter((src) => /^https?:/i.test(src));
        const imageUrl = images.at(-1);
        if (!imageUrl || BLOCKED_HOST.test(imageUrl)) continue;
        const rawTitle = row.title;
        const title = Array.isArray(rawTitle) ? String(rawTitle[0] ?? "") : String(rawTitle ?? "");
        const key = `loc:${row.id || imageUrl}`;
        if (!title || seen.has(key) || BLOCKED_TITLE.test(title)) continue;
        if (!looksLikeFilm(title) && !/\bstill\b/i.test(title)) continue;
        found.push({
          key,
          title,
          imageUrl,
          pageUrl: row.url || `https://www.loc.gov${row.id ?? ""}`,
          author: "Library of Congress",
          license: rights || "No known restrictions / public domain",
          source: "loc",
          kind: "film",
        });
      }
    } catch (error) {
      console.log(`loc skip (${search.q}): ${String(error).slice(0, 140)}`);
    }
    await sleep(300);
  }
  return found;
}

async function collectArchive(seen: Set<string>) {
  const found: OpenCandidate[] = [];
  const queries = [
    "collection:publicdomainmovies AND mediatype:movies",
    'mediatype:image AND (subject:"film stills" OR subject:"motion pictures") AND year:[1890 TO 1930]',
    'mediatype:image AND (subject:"movie posters" OR subject:"film posters" OR title:poster) AND year:[1890 TO 1940]',
  ];
  for (const query of queries) {
    try {
      const url = new URL(ARCHIVE_SEARCH);
      url.searchParams.set("q", query);
      url.searchParams.set("fl[]", "identifier");
      url.searchParams.append("fl[]", "title");
      url.searchParams.append("fl[]", "creator");
      url.searchParams.append("fl[]", "licenseurl");
      url.searchParams.set("rows", "80");
      url.searchParams.set("output", "json");
      const data = (await (await fetchOk(url)).json()) as {
        response?: {
          docs?: { identifier: string; title?: string; creator?: string; licenseurl?: string }[];
        };
      };
      for (const row of data.response?.docs ?? []) {
        const key = `archive:${row.identifier}`;
        if (seen.has(key)) continue;
        found.push({
          key,
          title: row.title || row.identifier,
          imageUrl: `https://archive.org/services/img/${row.identifier}`,
          pageUrl: `https://archive.org/details/${row.identifier}`,
          author: Array.isArray(row.creator) ? row.creator[0] : row.creator || "Internet Archive",
          license: row.licenseurl || "Public domain",
          licenseUrl: row.licenseurl,
          source: "archive",
          kind: "film",
        });
      }
    } catch (error) {
      console.log(`archive skip: ${String(error).slice(0, 140)}`);
    }
    await sleep(300);
  }
  return found;
}

export async function collectOpenCandidates(seen: Set<string>) {
  const batches = await Promise.all([
    collectOpenverse(seen),
    collectLoc(seen),
    collectArchive(seen),
  ]);
  const unique = new Map<string, OpenCandidate>();
  for (const item of batches.flat()) unique.set(item.key, item);
  return [...unique.values()];
}

export async function collectPhotoCandidates(seen: Set<string>, options?: { cats?: boolean }) {
  const batches = options?.cats
    ? await Promise.all([collectOpenversePhotos(seen, { cats: true })])
    : await Promise.all([
        collectOpenversePhotos(seen),
        collectLocPhotos(seen),
        collectArchive(seen),
      ]);
  const unique = new Map<string, OpenCandidate>();
  for (const item of batches.flat()) {
    unique.set(item.key, {
      ...item,
      kind: item.kind ?? "photo",
      sourceLabel: item.sourceLabel ?? providerLabel(item.source),
    });
  }
  return [...unique.values()];
}

/** Western painters whose works are PD on US/EU museum scans (d. ≤1955). Kay Nielsen omitted (life+70). */
const WESTERN_PAINTER_QUERIES = [
  // Renaissance
  "botticelli painting",
  "leonardo da vinci painting",
  "albrecht durer painting",
  "michelangelo painting",
  "raphael painting",
  "titian painting",
  "pieter bruegel painting",
  "tintoretto painting",
  "paolo veronese painting",
  "el greco painting",
  // Baroque
  "caravaggio painting",
  "peter paul rubens painting",
  "frans hals painting",
  "artemisia gentileschi painting",
  "diego velazquez painting",
  "rembrandt painting",
  "jan steen painting",
  "johannes vermeer painting",
  "jacob van ruisdael painting",
  // Rococo / Neoclassical
  "antoine watteau painting",
  "francois boucher painting",
  "jean-honore fragonard painting",
  "joshua reynolds painting",
  "thomas gainsborough painting",
  "jacques-louis david painting",
  "francisco goya painting",
  "william blake painting",
  // Romanticism / Realism / Academic
  "caspar david friedrich painting",
  "jmw turner painting",
  "john constable painting",
  "jean-auguste ingres painting",
  "eugene delacroix painting",
  "theodore gericault painting",
  "camille corot painting",
  "jean-francois millet painting",
  "gustave courbet painting",
  "honore daumier painting",
  "adolph menzel painting",
  "william-adolphe bouguereau painting",
  "alexandre cabanel painting",
  "lawrence alma-tadema painting",
  "jean-leon gerome painting",
  "ilya repin painting",
  "ivan aivazovsky painting",
  "ivan shishkin painting",
  "vasily surikov painting",
  "arkhip kuindzhi painting",
  // Pre-Raphaelite / Aesthetic
  "dante rossetti painting",
  "john everett millais painting",
  "edward burne-jones painting",
  "william morris design",
  "john william waterhouse painting",
  "frederic leighton painting",
  "albert joseph moore painting",
  "simeon solomon painting",
  "evelyn de morgan painting",
  "john collier painting",
  "walter crane illustration",
  "aubrey beardsley illustration",
  // Impressionism
  "edouard manet painting",
  "claude monet painting",
  "pierre-auguste renoir painting",
  "edgar degas painting",
  "camille pissarro painting",
  "alfred sisley painting",
  "berthe morisot painting",
  "mary cassatt painting",
  "gustave caillebotte painting",
  "frederic bazille painting",
  // Post-Impressionism
  "vincent van gogh painting",
  "paul cezanne painting",
  "paul gauguin painting",
  "georges seurat painting",
  "paul signac painting",
  "toulouse-lautrec painting",
  "henri rousseau painting",
  "odilon redon painting",
  "pierre bonnard painting",
  "edouard vuillard painting",
  // Symbolism / Art Nouveau
  "gustave moreau painting",
  "arnold bocklin painting",
  "fernand khnopff painting",
  "jan toorop painting",
  "gustav klimt painting",
  "egon schiele painting",
  "alphonse mucha poster",
  "carlos schwabe painting",
  "franz von stuck painting",
  "mihaly zichy painting",
  // Modernism (d. ≤1955)
  "henri matisse painting",
  "andre derain painting",
  "frida kahlo painting",
  "wassily kandinsky painting",
  "paul klee painting",
  "piet mondrian painting",
  "kazimir malevich painting",
  "amedeo modigliani painting",
  "edvard munch painting",
  "james ensor painting",
  "francis picabia painting",
  "raoul dufy painting",
  "robert delaunay painting",
  "franz marc painting",
  "august macke painting",
  "ernst ludwig kirchner painting",
  "alexej von jawlensky painting",
  "kathe kollwitz print",
  // American
  "james mcneill whistler painting",
  "winslow homer painting",
  "thomas eakins painting",
  "john singer sargent painting",
  "frederic remington painting",
  "george bellows painting",
  "marsden hartley painting",
  "charles demuth painting",
  "arthur dove painting",
  "grant wood painting",
  "nc wyeth illustration",
  "john sloan painting",
  // Illustration
  "gustave dore illustration",
  "arthur rackham illustration",
  "edmund dulac illustration",
  "howard pyle illustration",
  "jessie willcox smith illustration",
  "charles robinson illustration",
  "william heath robinson illustration",
  "warwick goble illustration",
  "ivan bilibin illustration",
  "harry clarke illustration",
  "heinrich kley illustration",
];

const ART_QUERIES = [
  ...FASHION_QUERIES,
  ...TATTOO_QUERIES,
  "pompeii fresco",
  "herculaneum fresco",
  "villa of the mysteries pompeii",
  "lascaux cave painting",
  "altamira cave painting",
  "chauvet cave painting",
  "egyptian tomb painting",
  "fayum mummy portrait",
  "knossos minoan fresco",
  "roman mosaic pompeii",
  "giotto scrovegni fresco",
  "bosch garden of earthly delights",
  "delacroix liberty leading the people",
  "ingres grande odalisque",
  "gericault raft of the medusa",
  "caspar david friedrich painting",
  "mucha art nouveau",
  "mondrian composition painting",
  "kandinsky composition painting",
  "chippendale furniture",
  "thonet bentwood chair",
  "william morris wallpaper",
  "william morris textile",
  "shaker furniture",
  "art nouveau furniture",
  "antique armchair museum",
  "louis xvi furniture",
  "egyptian furniture museum",
  "greek vase painting",
  "byzantine mosaic",
  "dunhuang mural",
  "mogao caves mural",
  "kizil caves mural",
  "qizil thousand buddha caves",
  "yulin caves dunhuang",
  "yungang grottoes",
  "longmen grottoes sculpture",
  "maijishan grottoes",
  "ajanta caves mural",
  "sigiriya fresco",
  "greek marble sculpture",
  "roman marble statue museum",
  "venus de milo sculpture",
  "nike of samothrace",
  "buddhist sculpture museum",
  "terracotta warriors sculpture",
  "egyptian sculpture museum",
  "khmer sculpture museum",
  "chinese stone sculpture",
  "bonampak mural",
  "teotihuacan mural",
  "byzantine fresco",
  "coptic mural egypt",
  "ethiopian church mural",
  "bagan temple mural",
  "romanian painted monastery",
  "iznik tile pattern",
  "islamic geometric tile",
  "moroccan zellige",
  "japanese kimono pattern",
  "batik textile museum",
  "kente cloth museum",
  "navajo textile museum",
  "kilim rug museum",
  "andean textile museum",
  "chinese embroidery pattern",
  "miao embroidery museum",
  "nasa earth photograph",
  "aerial mountain landscape",
  "aerial coastline photograph",
  "glacier aerial photograph",
  "volcano aerial photograph",
  "desert aerial photograph",
  "himalaya aerial landscape",
  "grand canyon aerial",
  "tibetan thangka museum",
  "hmong embroidery museum",
  "suzani embroidery",
  "russian lubok folk print",
  "chinese nianhua folk print",
  "yangliuqing new year print",
  "korean bojagi textile",
  "okinawan bingata",
  "ainu textile museum",
  "mexican talavera tile",
  "otomi embroidery mexico",
  "polish wycinanki folk",
  "scandinavian rosemaling",
  "amish quilt museum",
  "ukrainian embroidery museum",
  "berber carpet museum",
  "indian block print textile",
  "african mask museum",
  "historic graffiti pompeii",
  "graffiti mural photograph",
  "street art mural photograph",
  "berlin wall graffiti photograph",
  "taohuawu nianhua",
  "mianzhu nianhua",
  "zhuxian nianhua",
  "yangjiabu nianhua",
  "chinese woodblock new year print",
  "menshen door god print",
  "chinese paper cut jianzhi",
  "chinese blue calico textile",
  "nanjing yunjin brocade",
  "shu brocade pattern",
  "cloisonne enamel china",
  "chinese dragon textile motif",
  "chinese phoenix motif",
  "scrolling lotus china",
  "blue and white porcelain pattern",
  "famille rose porcelain",
  "chinese lacquerware pattern",
  "dunhuang caisson pattern",
  ...WESTERN_PAINTER_QUERIES,
];

const ART_TITLE =
  /\b(fresco|mural|cave painting|painting|oil on canvas|watercolor|watercolour|etching|engraving|drawing|sketch|portrait|landscape|still life|altarpiece|triptych|diptych|illustration|pompeii|herculaneum|lascaux|altamira|chauvet|tomb painting|fayum|knossos|minoan|mosaic|furniture|chippendale|thonet|morris|bauhaus|art nouveau|shaker|armchair|sideboard|vase painting|giotto|bosch|botticelli|leonardo|durer|dürer|michelangelo|raphael|titian|bruegel|tintoretto|veronese|greco|caravaggio|rubens|hals|gentileschi|velazquez|velázquez|rembrandt|steen|vermeer|ruysdael|watteau|boucher|fragonard|reynolds|gainsborough|david|goya|blake|friedrich|turner|constable|ingres|delacroix|gericault|corot|millet|courbet|daumier|menzel|bouguereau|cabanel|alma-tadema|gerome|gérôme|repin|aivazovsky|shishkin|surikov|kuindzhi|rossetti|millais|burne-jones|waterhouse|leighton|solomon|de morgan|collier|crane|beardsley|manet|monet|renoir|degas|pissarro|sisley|morisot|cassatt|caillebotte|bazille|van gogh|gogh|cezanne|cézanne|gauguin|seurat|signac|lautrec|rousseau|redon|bonnard|vuillard|moreau|bocklin|böcklin|khnopff|toorop|klimt|schiele|mucha|schwabe|stuck|zichy|matisse|derain|kahlo|kandinsky|klee|mondrian|malevich|modigliani|munch|ensor|picabia|dufy|delaunay|marc|macke|kirchner|jawlensky|kollwitz|whistler|homer|eakins|sargent|remington|bellows|hartley|demuth|dove|grant wood|wyeth|sloan|dore|doré|rackham|dulac|pyle|bilibin|clarke|kley|scrovegni|odalisque|egyptian|dunhuang|mogao|kizil|qizil|yulin|yungang|longmen|maijishan|ajanta|sigiriya|grotto|sculpture|statue|terracotta|venus de milo|samothrace|buddhist|bonampak|teotihuacan|byzantine|coptic|ethiopian|bagan|iznik|zellige|batik|kente|kilim|ikat|embroidery|textile|kimono|navajo|palampore|andean|geometric tile|aerial|satellite|nasa|glacier|volcano|thangka|lubok|nianhua|bojagi|bingata|talavera|otomi|wycinanki|rosemaling|quilt|suzani|graffiti|street art|folk print|folk art|yangliuqing|taohuawu|mianzhu|yangjiabu|zhuxian|jianzhi|paper cut|cloisonne|cloisonné|yunjin|brocade|calico|porcelain|famille rose|lacquer|menshen|door god|caisson|tattoo|flash sheet|irezumi|henna|sailor jerry|blackwork|tribal tattoo|maori tattoo|polynesian tattoo|costume|fashion plate|gown|dress|ball gown|haute couture|worth|poiret|vionnet|cardin|courr[eè]ges|mary quant|mod fashion|space age fashion|edwardian|regency dress|empire waist)\b/i;

async function collectOpenverseArt(seen: Set<string>, options?: { fashionOnly?: boolean }) {
  const found: OpenCandidate[] = [];
  const queries = options?.fashionOnly ? FASHION_QUERIES : ART_QUERIES;
  const fashionMiss: string[] = [];
  let fashionHits = 0;
  for (const query of queries) {
    let queryHits = 0;
    for (const category of ["digitized_artwork", "photograph"]) {
      try {
        const url = new URL(OPENVERSE);
        url.searchParams.set("q", query);
        url.searchParams.set("license", "cc0,pdm,by,by-sa");
        url.searchParams.set("category", category);
        url.searchParams.set("excluded_source", "wikimedia");
        url.searchParams.set("page_size", "20");
        url.searchParams.set("page", "1");
        url.searchParams.set("mature", "false");
        const data = (await (await fetchOk(url)).json()) as {
          results?: {
            id: string;
            title?: string;
            url?: string;
            thumbnail?: string;
            foreign_landing_url?: string;
            creator?: string;
            license?: string;
            license_url?: string;
            provider?: string;
            width?: number;
            height?: number;
          }[];
        };
        for (const row of data.results ?? []) {
          const imageUrl = row.url || row.thumbnail;
          const provider = (row.provider ?? "").toLowerCase();
          if (!imageUrl || BLOCKED_HOST.test(imageUrl) || BLOCKED_HOST.test(provider)) continue;
          if (!PHOTO_SOURCES.split(",").some((name) => provider.includes(name))) continue;
          if ((row.width ?? 400) < 280) continue;
          const license = row.license ?? "";
          if (!licenseOk(license)) continue;
          const title = row.title || query;
          const museum = /met|rijksmuseum|cleveland|brooklyn|cooper_hewitt|smithsonian|rawpixel|europeana|smk|nypl/.test(
            provider,
          );
          if (BLOCKED_TITLE.test(title) || isFilmFrame(title)) continue;
          if (isUnsafeItem({ title, author: row.creator ?? "", pageUrl: row.foreign_landing_url })) continue;
          const tattooQuery = /tattoo|irezumi|henna|flash sheet|sailor jerry|blackwork|tribal tattoo|maori tattoo|polynesian tattoo/i.test(
            query,
          );
          if (!ART_TITLE.test(title) && !museum && !tattooQuery) continue;
          const key = `openverse:${row.id}`;
          if (seen.has(key)) continue;
          queryHits += 1;
          found.push({
            key,
            title,
            imageUrl,
            pageUrl: row.foreign_landing_url || imageUrl,
            author: row.creator || row.provider || "Openverse",
            license: license.toUpperCase(),
            licenseUrl: row.license_url,
            source: "openverse",
            kind: "photo",
            sourceLabel: providerLabel(row.provider),
            preferText: tattooQuery ? `tattoo flash ${query}` : undefined,
          });
        }
      } catch (error) {
        console.log(`openverse art skip (${query} ${category}): ${String(error).slice(0, 140)}`);
      }
      await sleep(250);
    }
    if (FASHION_QUERIES.includes(query)) {
      if (queryHits > 0) fashionHits += 1;
      else fashionMiss.push(query);
    }
  }
  if (fashionMiss.length) {
    console.log(`fashion zero-hit queries (${fashionMiss.length}): ${fashionMiss.join(" | ")}`);
  }
  if (fashionHits) {
    console.log(`fashion queries with hits: ${fashionHits}`);
  }
  return found;
}

async function collectLocArt(seen: Set<string>, options?: { fashionOnly?: boolean }) {
  const found: OpenCandidate[] = [];
  const fashionSearches = [
    "charles frederick worth",
    "paul poiret",
    "madeleine vionnet",
    "fashion plate",
    "ball gown",
    "costume dress museum",
    "edwardian gown",
    "mary quant",
  ];
  const defaultSearches = [
    ...fashionSearches,
    "tattoo flash",
    "tattoo design",
    "irezumi",
    "henna design",
    "engraving tattoo",
    "tribal tattoo pattern",
    "pompeii fresco",
    "pompeii mural",
    "cave painting",
    "egyptian painting",
    "antique furniture",
    "chippendale chair",
    "fresco painting",
    "dunhuang mural",
    "kizil caves",
    "greek sculpture",
    "marble statue",
    "buddhist sculpture",
    "aerial photograph",
    "textile pattern",
    "islamic tile",
    "folk textile",
    "graffiti mural",
  ];
  const searches = (options?.fashionOnly ? fashionSearches : defaultSearches).map((q) => ({ q, sp: 1 }));
  for (const search of searches) {
    try {
      const url = new URL(LOC_SEARCH);
      url.searchParams.set("q", search.q);
      url.searchParams.set("fo", "json");
      url.searchParams.set("c", "40");
      url.searchParams.set("sp", String(search.sp));
      const data = (await (await fetchOk(url)).json()) as {
        results?: {
          id?: string;
          title?: string | string[];
          url?: string;
          image_url?: string[];
          item?: { rights?: string[] };
        }[];
      };
      for (const row of data.results ?? []) {
        const rightsRaw = row.item?.rights;
        const rights = Array.isArray(rightsRaw)
          ? rightsRaw.join(" ")
          : String(rightsRaw ?? "");
        if (rights && !licenseOk(rights) && !/no known restrictions/i.test(rights)) continue;
        const images = (row.image_url ?? [])
          .map((src) => (src.startsWith("//") ? `https:${src}` : src))
          .filter((src) => /^https?:/i.test(src));
        const imageUrl = images.at(-1);
        if (!imageUrl || BLOCKED_HOST.test(imageUrl)) continue;
        const rawTitle = row.title;
        const title = Array.isArray(rawTitle) ? String(rawTitle[0] ?? "") : String(rawTitle ?? "");
        const key = `loc:${row.id || imageUrl}`;
        if (!title || seen.has(key) || BLOCKED_TITLE.test(title) || isFilmFrame(title)) continue;
        const tattooSearch = /tattoo|irezumi|henna|engraving tattoo|tribal tattoo/i.test(search.q);
        if (!ART_TITLE.test(title) && !tattooSearch) continue;
        found.push({
          key,
          title,
          imageUrl,
          pageUrl: row.url || `https://www.loc.gov${row.id ?? ""}`,
          author: "Library of Congress",
          license: rights || "No known restrictions / public domain",
          source: "loc",
          kind: "photo",
          sourceLabel: "美国国会图书馆",
          preferText: tattooSearch ? `tattoo flash ${search.q}` : undefined,
        });
      }
    } catch (error) {
      console.log(`loc art skip (${search.q}): ${String(error).slice(0, 140)}`);
    }
    await sleep(300);
  }
  return found;
}

async function collectArchiveArt(seen: Set<string>, options?: { fashionOnly?: boolean }) {
  const found: OpenCandidate[] = [];
  const fashionQueries = [
    'mediatype:image AND ("fashion plate" OR "ball gown" OR costume OR "charles frederick worth" OR poiret OR vionnet) AND year:[1800 TO 1930]',
    'mediatype:image AND (gown OR dress) AND (museum OR costume) AND year:[1800 TO 1925]',
  ];
  const queries = options?.fashionOnly
    ? fashionQueries
    : [
        ...fashionQueries,
        'mediatype:image AND (tattoo OR "tattoo flash" OR irezumi OR henna OR "flash sheet") AND year:[1800 TO 1950]',
        'mediatype:image AND (pompeii OR lascaux OR fresco OR "cave painting") AND year:[1 TO 1925]',
        'mediatype:image AND (dunhuang OR mogao OR kizil OR ajanta OR sculpture OR statue) AND year:[1 TO 1925]',
        'mediatype:image AND (textile OR embroidery OR iznik OR batik) AND year:[1600 TO 1925]',
        'mediatype:image AND (aerial OR nasa) AND mediatype:image',
        'mediatype:image AND (furniture OR chippendale OR thonet OR morris) AND year:[1700 TO 1920]',
      ];
  for (const query of queries) {
    try {
      const url = new URL(ARCHIVE_SEARCH);
      url.searchParams.set("q", query);
      url.searchParams.set("fl[]", "identifier");
      url.searchParams.append("fl[]", "title");
      url.searchParams.append("fl[]", "creator");
      url.searchParams.append("fl[]", "licenseurl");
      url.searchParams.set("rows", "40");
      url.searchParams.set("output", "json");
      const data = (await (await fetchOk(url)).json()) as {
        response?: {
          docs?: { identifier: string; title?: string; creator?: string; licenseurl?: string }[];
        };
      };
      for (const row of data.response?.docs ?? []) {
        const title = row.title || row.identifier;
        const tattooArchive = /tattoo|irezumi|henna|flash sheet/i.test(query);
        if ((!ART_TITLE.test(title) && !tattooArchive) || BLOCKED_TITLE.test(title)) continue;
        const key = `archive:${row.identifier}`;
        if (seen.has(key)) continue;
        found.push({
          key,
          title,
          imageUrl: `https://archive.org/services/img/${row.identifier}`,
          pageUrl: `https://archive.org/details/${row.identifier}`,
          author: Array.isArray(row.creator) ? row.creator[0] : row.creator || "Internet Archive",
          license: row.licenseurl || "Public domain",
          licenseUrl: row.licenseurl,
          source: "archive",
          kind: "photo",
          sourceLabel: "互联网档案馆",
          preferText: tattooArchive ? "tattoo flash archive" : undefined,
        });
      }
    } catch (error) {
      console.log(`archive art skip: ${String(error).slice(0, 140)}`);
    }
    await sleep(300);
  }
  return found;
}

export async function collectArtCandidates(seen: Set<string>, options?: { fashionOnly?: boolean }) {
  const batches = await Promise.all([
    collectOpenverseArt(seen, options),
    collectLocArt(seen, options),
    collectArchiveArt(seen, options),
  ]);
  const unique = new Map<string, OpenCandidate>();
  for (const item of batches.flat()) unique.set(item.key, item);
  return [...unique.values()];
}

const MEME_QUERIES = [
  // Prefer wordless reaction / animal / historical funny (titles must still lookLikeMeme).
  "reaction meme",
  "reaction image",
  "reaction image meme",
  "internet meme cc0",
  "funny animal meme",
  "confused animal meme",
  "surprised cat meme",
  "confused dog meme",
  "surprised face illustration public domain",
  "facepalm meme",
  "trollface",
  "troll meme",
  "rage comic",
  "wojak meme",
  "blank meme template",
  "vintage funny advertisement",
  "old comic funny public domain",
  "public domain meme",
  "public domain funny animal",
  "library of congress funny animals",
  "meme sticker animal",
  "meme clipart animal",
];

async function collectOpenverseMemes(seen: Set<string>) {
  const found: OpenCandidate[] = [];
  for (const query of MEME_QUERIES) {
    for (const category of ["illustration", "digitized_artwork", "photograph"]) {
      for (const page of [1, 2]) {
        try {
          const url = new URL(OPENVERSE);
          url.searchParams.set("q", query);
          url.searchParams.set("license", "cc0,pdm,by,by-sa");
          url.searchParams.set("category", category);
          url.searchParams.set("excluded_source", "wikimedia");
          url.searchParams.set("page_size", "20");
          url.searchParams.set("page", String(page));
          url.searchParams.set("mature", "false");
          const data = (await (await fetchOk(url)).json()) as {
            results?: {
              id: string;
              title?: string;
              url?: string;
              thumbnail?: string;
              foreign_landing_url?: string;
              creator?: string;
              license?: string;
              license_url?: string;
              provider?: string;
              width?: number;
              height?: number;
            }[];
          };
          for (const row of data.results ?? []) {
            const imageUrl = row.url || row.thumbnail;
            const provider = (row.provider ?? "").toLowerCase();
            if (!imageUrl || BLOCKED_HOST.test(imageUrl) || BLOCKED_HOST.test(provider)) continue;
            if ((row.width ?? 400) < 200) continue;
            const license = row.license ?? "";
            if (!licenseOk(license)) continue;
            const title = row.title || query;
            const blob = `${title} ${row.creator ?? ""} ${provider}`;
            if (BLOCKED_TITLE.test(title) || !looksLikeMeme(blob)) continue;
            const key = `openverse:${row.id}`;
            if (seen.has(key)) continue;
            found.push({
              key,
              title,
              imageUrl,
              pageUrl: row.foreign_landing_url || imageUrl,
              author: row.creator || row.provider || "Openverse",
              license: license.toUpperCase(),
              licenseUrl: row.license_url,
              source: "openverse",
              kind: "photo",
              sourceLabel: providerLabel(row.provider),
            });
          }
        } catch (error) {
          console.log(`openverse meme skip (${query} ${category} p${page}): ${String(error).slice(0, 140)}`);
          break;
        }
        await sleep(250);
      }
    }
  }
  return found;
}

async function collectArchiveMemes(seen: Set<string>) {
  const found: OpenCandidate[] = [];
  const query =
    'mediatype:image AND (title:meme OR subject:meme) AND (licenseurl:*creativecommons* OR licenseurl:*publicdomain* OR licenseurl:*cc0*)';
  try {
    const url = new URL(ARCHIVE_SEARCH);
    url.searchParams.set("q", query);
    url.searchParams.set("fl[]", "identifier");
    url.searchParams.append("fl[]", "title");
    url.searchParams.append("fl[]", "creator");
    url.searchParams.append("fl[]", "licenseurl");
    url.searchParams.set("rows", "40");
    url.searchParams.set("output", "json");
    const data = (await (await fetchOk(url)).json()) as {
      response?: {
        docs?: { identifier: string; title?: string; creator?: string; licenseurl?: string }[];
      };
    };
    for (const row of data.response?.docs ?? []) {
      const title = row.title || row.identifier;
      if (!looksLikeMeme(title) || BLOCKED_TITLE.test(title)) continue;
      const key = `archive:${row.identifier}`;
      if (seen.has(key)) continue;
      found.push({
        key,
        title,
        imageUrl: `https://archive.org/services/img/${row.identifier}`,
        pageUrl: `https://archive.org/details/${row.identifier}`,
        author: Array.isArray(row.creator) ? row.creator[0] : row.creator || "Internet Archive",
        license: row.licenseurl || "Public domain",
        licenseUrl: row.licenseurl,
        source: "archive",
        kind: "photo",
        sourceLabel: "互联网档案馆",
      });
    }
  } catch (error) {
    console.log(`archive meme skip: ${String(error).slice(0, 140)}`);
  }
  return found;
}

export async function collectMemeCandidates(seen: Set<string>) {
  const batches = await Promise.all([collectOpenverseMemes(seen), collectArchiveMemes(seen)]);
  const unique = new Map<string, OpenCandidate>();
  for (const item of batches.flat()) unique.set(item.key, item);
  return [...unique.values()];
}

export async function ingestOpenStill(candidate: OpenCandidate) {
  if (BLOCKED_TITLE.test(candidate.title) || isUnsafeItem(candidate)) return null;
  const response = await fetchOk(candidate.imageUrl);
  const mime = response.headers.get("content-type") || "";
  if (mime.includes("svg") || (mime && !mime.startsWith("image/") && !mime.includes("octet-stream"))) {
    return null;
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  return stillFromBuffer({
    buffer,
    title: candidate.title,
    source: candidate.source,
    pageUrl: candidate.pageUrl,
    author: candidate.author,
    license: candidate.license,
    licenseUrl: candidate.licenseUrl,
    fileKey: candidate.key,
    kind: candidate.kind,
    sourceLabel: candidate.sourceLabel,
  });
}
