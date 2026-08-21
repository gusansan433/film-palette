import { isPainting, isPoster } from "./creator";
import type { CatalogItem, MediaCategory, PeopleCount, SubjectTag } from "./types";

export const MEDIA_CATEGORIES: { id: MediaCategory; label: string }[] = [
  { id: "painting", label: "画" },
  { id: "poster", label: "海报" },
  { id: "photo", label: "摄影" },
  { id: "film", label: "剧照" },
  { id: "meme", label: "梗图" },
];

/** Prefer wordless reaction / animal / classic meme phrasing over captioned macros. */
const MEME_HIT =
  /\b(meme|trollface|troll meme|rage comic|image macro|wojak meme|advice animal|rage face|reaction image|reaction meme|facepalm|funny animal|confused animal|surprised face|vintage funny|public domain meme)\b/i;
/** Keep signal: reaction / animal / classic templates — bare “X [Meme]” macros fail this. */
const MEME_KEEP =
  /\b(trollface|troll meme|rage comic|rage face|wojak meme|\bwojak\b|advice animal|image macro|reaction (image|meme|photo)|facepalm|funny animal|confused animal|surprised (cat|dog|face)|blank meme template|vintage funny|public domain meme|cats?|kittens?|dogs?|puppies?|animals?|animal face)\b/i;
/** Polish “wojak” (soldier) / surnames must not count as the internet Wojak meme. */
const MEME_WOJAK_NAME_NOISE =
  /\b(dobry wojak|weso[łl]y wojak|szwejk|olaf wojak|irmtrud wojak|wojak nr\b|dr\.?\s+\w+\s+wojak)\b/i;
const MEME_NOISE =
  /zombomeme|buzzfeed|meme ranch|laser engraving|street art|misinformation|styled after|how many|cosplay|exhibition|museum|wall of|when internet memes attack|meme performance|hiding place|hyperinflation|controlnet|bolivar|fuduji|pixelfreunde|xvala|6-7 meme|67 meme|distrito rap|rap pol[ií]tico|pasaporte covid|suicid|meme edit|chipotle/i;
const MEME_BLOCKED_IP =
  /\b(pepe the frog|doge\b|kabosu|distracted boyfriend|drake hotline|woman yelling at a cat|this is fine|hide the pain|success kid|overly attached|ancient aliens|surprised pikachu|spongebob|minions|gru'?s plan|arthur'?s fist|naruto|sasuke|one piece|dragon ball|cyberpunk\s*2077|\bcyberpunk\b|lannister|game of thrones|\bgot\b|jon snow|marvel|avengers|spider-?man|batman|superman|disney|pixar|harry potter|pokemon|pokémon|nintendo|zelda|mario\b|sonic the|fallout|caesar'?s legion|the institute|euphoria|star wars|star trek|lord of the rings|hobbit|witcher|fortnite|minecraft|genshin|anime)\b/i;

export function looksLikeMeme(text: string) {
  if (MEME_WOJAK_NAME_NOISE.test(text)) return false;
  // Internet Wojak character: allow bare “wojak” only when not a Polish name/statue hit above.
  const hit =
    MEME_HIT.test(text) ||
    (/\bwojak\b/i.test(text) && !/\b(szwejk|przemysl|warszawa|protest|nr\s*\d)\b/i.test(text));
  if (!hit || MEME_NOISE.test(text) || MEME_BLOCKED_IP.test(text)) {
    return false;
  }
  // Drop captioned franchise / personality macros that only match on the word “meme”.
  if (!MEME_KEEP.test(text) && !/\bwojak\b/i.test(text)) return false;
  return true;
}

export const PEOPLE_COUNTS: { id: PeopleCount; label: string }[] = [
  { id: "none", label: "无人" },
  { id: "one", label: "一人" },
  { id: "two", label: "两人" },
  { id: "crowd", label: "多人" },
];

export const SUBJECTS: { id: SubjectTag; label: string }[] = [
  { id: "portrait", label: "肖像" },
  { id: "people", label: "人物" },
  { id: "landscape", label: "风景" },
  { id: "city", label: "城市" },
  { id: "night", label: "夜景" },
  { id: "still-life", label: "静物" },
  { id: "architecture", label: "建筑" },
  { id: "interior", label: "室内" },
  { id: "nature", label: "自然" },
  { id: "design", label: "设计" },
  { id: "costume", label: "服饰" },
  { id: "ancient", label: "古代" },
  { id: "sculpture", label: "雕塑" },
  { id: "pattern", label: "纹样" },
  { id: "graffiti", label: "涂鸦" },
];

const CROWD =
  /\b(crowd|group|audience|parade|family|children|soldiers|people|villagers|congregation|orchestra|cast)\b/i;
const TWO =
  /\b(couple|two |2 |duet|kiss|lovers|pair|双人|两人)\b|the kiss/i;
const ONE =
  /\b(portrait|self-portrait|bust|head-and-shoulders|a man|a woman|actress|actor|close-up|closeup|半身|肖像|一人)\b/i;
const NONE =
  /\b(landscape|seascape|still life|architecture|interior|building|sunset|ocean|desert|mountain|forest|flower|abstract|empty|skyline|still-life|风景|静物)\b/i;

export function classifyCategory(item: Pick<CatalogItem, "title" | "kind" | "fileKey" | "source">): MediaCategory {
  const text = `${item.title} ${item.fileKey ?? ""}`;
  if (looksLikeMeme(text)) return "meme";
  if (isPainting(text)) return "painting";
  if (isPoster(text)) return "poster";
  if (item.kind === "film" || /\b(film still|movie still|motion picture still|screenshot|trailer|still from)\b/i.test(text)) {
    return "film";
  }
  if (
    /\b(film|movie|cinema|screenshot|chaplin|keaton|nosferatu|metropolis|sintel)\b/i.test(text) &&
    item.source !== "openverse"
  ) {
    return "film";
  }
  return "photo";
}

export function classifyPeople(title: string, category: MediaCategory): PeopleCount | undefined {
  if (CROWD.test(title)) return "crowd";
  if (TWO.test(title)) return "two";
  if (ONE.test(title)) return "one";
  if (NONE.test(title)) return "none";
  if (category === "painting" && /water lilies|starry night|great wave|ukiyo/i.test(title)) return "none";
  if (category === "poster" && /travel poster|circus poster|wpa/i.test(title) && !ONE.test(title)) {
    return undefined;
  }
  return undefined;
}

export function classifySubjects(title: string, category: MediaCategory): SubjectTag[] {
  const found = new Set<SubjectTag>();
  if (/\b(portrait|self-portrait|bust|head-and-shoulders|肖像)\b/i.test(title)) found.add("portrait");
  if (/\b(night|neon|blue hour|nocturne|夜)\b/i.test(title)) found.add("night");
  if (/\b(city|street|tokyo|paris|hong kong|urban|skyline)\b/i.test(title)) found.add("city");
  if (/\b(landscape|ocean|desert|mountain|sunset|river|lake|valley|风景)\b/i.test(title)) found.add("landscape");
  if (/\b(still life|flower|fruit|静物)\b/i.test(title)) found.add("still-life");
  if (/\b(architecture|building|church|bridge|cathedral|建筑)\b/i.test(title)) found.add("architecture");
  if (/\b(interior|room|atelier|gallery|室内)\b/i.test(title)) found.add("interior");
  if (/\b(forest|tree|garden|park|bird|nature)\b/i.test(title)) found.add("nature");
  if (/\b(man|woman|girl|boy|people|actor|actress|figure|人物)\b/i.test(title)) found.add("people");
  if (
    /\b(furniture|chair|armchair|cabinet|sideboard|chippendale|thonet|shaker|william morris|bauhaus|art nouveau|wiener werkstätte|textile design|wallpaper design|embroidery|batik|kilim|zellige|ikat|kente|iznik|kimono pattern)\b/i.test(
      title,
    )
  ) {
    found.add("design");
  }
  if (
    /\b(costume|fashion plate|gown|ball gown|haute couture|dress|charles frederick worth|paul poiret|madeleine vionnet|pierre cardin|courr[eè]ges|mary quant|mod fashion|space age fashion|edwardian gown|regency dress|empire waist|met costume)\b/i.test(
      title,
    )
  ) {
    found.add("costume");
    found.add("design");
  }
  if (
    /\b(pompeii|herculaneum|lascaux|altamira|chauvet|cave painting|prehistoric|egyptian tomb|fayum|knossos|minoan|fresco|roman mosaic|assyrian|sumerian|dunhuang|mogao|kizil|qizil|yulin|yungang|longmen|maijishan|ajanta|sigiriya|grotto|bonampak|teotihuacan|byzantine|coptic|bagan)\b/i.test(
      title,
    )
  ) {
    found.add("ancient");
  }
  if (
    /\b(sculpture|statue|marble figure|bronze statue|terracotta warrior|venus de milo|samothrace|bust sculpture)\b/i.test(
      title,
    )
  ) {
    found.add("sculpture");
  }
  if (
    /\b(pattern|textile|embroidery|batik|kilim|zellige|ikat|kente|iznik|kimono|navajo rug|palampore|geometric tile|ornament|thangka|lubok|nianhua|bojagi|bingata|talavera|otomi|suzani|folk print|folk art|quilt|yangliuqing|taohuawu|jianzhi|paper cut|cloisonne|cloisonné|yunjin|brocade|calico|porcelain|famille rose|menshen|door god|tattoo|flash sheet|irezumi|henna|sailor jerry|blackwork)\b/i.test(
      title,
    )
  ) {
    found.add("pattern");
  }
  if (/\b(graffiti|street art)\b/i.test(title)) found.add("graffiti");
  if (/\b(aerial|satellite|nasa earth)\b/i.test(title)) found.add("landscape");
  if (category === "film" && found.size === 0) found.add("people");
  return [...found];
}

export function withSearchTags(item: CatalogItem): CatalogItem {
  const category = classifyCategory(item);
  const people = classifyPeople(item.title, category);
  const subjects = classifySubjects(item.title, category);
  return { ...item, category, people, subjects };
}

export function categoryLabel(id?: MediaCategory) {
  return MEDIA_CATEGORIES.find((row) => row.id === id)?.label ?? "画面";
}

/** Card/chip label safe to show — omit ambiguous painting / photo / poster. */
export function displayCategoryLabel(id?: MediaCategory) {
  if (id === "film" || id === "meme") return categoryLabel(id);
  return "";
}

export function peopleLabel(id?: PeopleCount) {
  return PEOPLE_COUNTS.find((row) => row.id === id)?.label ?? "";
}
