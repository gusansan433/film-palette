export const COLOR_BUCKETS = [
  { id: "red", label: "红", swatch: "#c43c3c" },
  { id: "orange", label: "橙", swatch: "#e07a2f" },
  { id: "yellow", label: "黄", swatch: "#e2b63a" },
  { id: "green", label: "绿", swatch: "#3d9a5f" },
  { id: "cyan", label: "青", swatch: "#2aa3a8" },
  { id: "blue", label: "蓝", swatch: "#3b6fd4" },
  { id: "purple", label: "紫", swatch: "#7a4bbd" },
  { id: "pink", label: "粉", swatch: "#d96a9a" },
  { id: "brown", label: "棕", swatch: "#8a5a32" },
  { id: "black", label: "黑", swatch: "#1a1a1a" },
  { id: "white", label: "白", swatch: "#f3f1ec" },
  { id: "gray", label: "灰", swatch: "#8b8b8b" },
] as const;

export type ColorBucket = (typeof COLOR_BUCKETS)[number]["id"];

export type PaletteColor = {
  hex: string;
  rgb: [number, number, number];
  ratio: number;
  bucket: ColorBucket;
};

export type MediaCategory = "painting" | "poster" | "photo" | "film" | "meme";
export type PeopleCount = "none" | "one" | "two" | "crowd";
export type SubjectTag =
  | "portrait"
  | "people"
  | "landscape"
  | "city"
  | "night"
  | "still-life"
  | "architecture"
  | "interior"
  | "nature"
  | "design"
  | "ancient"
  | "sculpture"
  | "pattern"
  | "graffiti";

export type CatalogItem = {
  id: string;
  title: string;
  titleEn?: string;
  titleZh?: string;
  director?: string;
  source: "commons" | "openverse" | "loc" | "archive" | "user";
  imageUrl: string;
  thumbUrl: string;
  pageUrl?: string;
  author?: string;
  license: string;
  licenseUrl?: string;
  buckets: ColorBucket[];
  palette: PaletteColor[];
  addedAt: string;
  fileKey?: string;
  kind?: "film" | "photo";
  photographer?: string;
  sourceLabel?: string;
  contentHash?: string;
  category?: MediaCategory;
  people?: PeopleCount;
  subjects?: SubjectTag[];
};

export type Catalog = {
  items: CatalogItem[];
  lastIngestDate: string | null;
  seenFileKeys: string[];
  seenContentHashes?: string[];
};
