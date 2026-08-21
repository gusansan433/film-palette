import type { CatalogItem } from "./types";
import { creatorLabel, isPainting, isPoster, isDesign, parseCreator } from "./creator";
import { withSearchTags } from "./classify";

const PLACE_PHOTO =
  /\b(theater|theatre|playhouse|church|opera house|elks club|street,|avenue,|chaplin,\s*west virginia|scotts run)\b/i;
const FILM_STILL =
  /\b(film still|movie still|motion picture still|screenshot|trailer|still from|in the film|in the movie)\b/i;

export function isTitleCard(title: string) {
  const base = title.replace(/^File:/i, "").replace(/\.[a-z0-9]+$/i, "").trim();
  return /\b(title card|opening title|wordmark|movie logo)\b/i.test(base)
    || /[\s_-]title$/i.test(base);
}

export function isPlacePhoto(title: string) {
  return PLACE_PHOTO.test(title) && !FILM_STILL.test(title);
}

export function looksLikeFilmStill(title: string) {
  return FILM_STILL.test(title);
}

export function sourceLabel(source: CatalogItem["source"]) {
  if (source === "loc") return "美国国会图书馆";
  if (source === "openverse") return "Openverse";
  if (source === "archive") return "互联网档案馆";
  if (source === "commons") return "维基共享资源";
  return "用户上传";
}

export function guessKind(item: Pick<CatalogItem, "title" | "source" | "fileKey">): "film" | "photo" {
  const text = `${item.title} ${item.fileKey ?? ""}`;
  if (isPainting(text) || isPoster(text) || isDesign(text)) return "photo";
  if (/\b(runway|fashion|couture|meme)\b/i.test(text)) return "photo";
  if (isPlacePhoto(text)) return "photo";
  if (looksLikeFilmStill(text)) return "film";
  if (
    /\b(nosferatu|metropolis|caligari|chaplin|keaton|charade|sintel|potemkin|gold rush|living dead|toll of the sea|becky sharp|gulf between|memphis belle|thief of bagdad|the circus)\b/i.test(
      text,
    )
  ) {
    return "film";
  }
  if (item.source === "commons" || item.source === "archive") return "film";
  if (item.source === "user") return "photo";
  return "photo";
}

export function withMediaMeta(item: CatalogItem): CatalogItem {
  const kind =
    isPainting(item.title) || isPoster(item.title) || isDesign(item.title)
      ? "photo"
      : item.kind ?? guessKind(item);
  const creator = parseCreator(item.title, item.author || item.photographer);
  const institutional = /library of congress|rawpixel|未注明/i.test(item.photographer || "");
  return withSearchTags({
    ...item,
    kind,
    photographer: creator || (!institutional && item.photographer) || item.author || "未注明",
    sourceLabel: item.sourceLabel || sourceLabel(item.source),
  });
}

export { creatorLabel, isPainting, isPoster, isDesign };
