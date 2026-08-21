import { paletteDistance, classifyHue, rgbToHex } from "./colors";
import type { CatalogItem, PaletteColor } from "./types";

/** Palette distance above this is a weak match (≈ matchScore under 55%). */
export const COLOR_RELEVANCE_MAX_DISTANCE = 36;
/** When nothing clears the threshold, keep the closest K. */
export const COLOR_RELEVANCE_FALLBACK_K = 200;

export type SimilarItem = CatalogItem & { matchScore: number };

export type SimilarOptions = {
  excludeId?: string;
  limit?: number;
  /** Keep only close matches; if none, fall back to top-K closest. */
  relevanceGate?: boolean;
  maxDistance?: number;
  fallbackLimit?: number;
};

export type RankedColorResult = {
  items: SimilarItem[];
  usedFallback: boolean;
};

type RankedEntry = { item: CatalogItem; distance: number };

function distanceToScore(distance: number) {
  return Math.max(0, Math.round((1 - distance / 80) * 100));
}

function toSimilarItem(entry: RankedEntry): SimilarItem {
  return {
    ...entry.item,
    matchScore: distanceToScore(entry.distance),
  };
}

function singleColorPalette(rgb: [number, number, number]): PaletteColor[] {
  return [
    {
      hex: rgbToHex(...rgb),
      rgb,
      ratio: 1,
      bucket: classifyHue(...rgb),
    },
  ];
}

function rankByDistance(
  items: CatalogItem[],
  palette: PaletteColor[],
  excludeId?: string,
): RankedEntry[] {
  return items
    .filter((item) => item.id !== excludeId)
    .map((item) => ({
      item,
      distance: paletteDistance(palette, item.palette),
    }))
    .sort((a, b) => a.distance - b.distance);
}

function applyRelevanceGate(
  ranked: RankedEntry[],
  maxDistance: number,
  fallbackLimit: number,
): { entries: RankedEntry[]; usedFallback: boolean } {
  const tight = ranked.filter((entry) => entry.distance <= maxDistance);
  if (tight.length > 0) {
    return { entries: tight, usedFallback: false };
  }
  return {
    entries: ranked.slice(0, fallbackLimit),
    usedFallback: ranked.length > 0,
  };
}

export function similarByPalette(
  items: CatalogItem[],
  palette: PaletteColor[],
  options?: SimilarOptions,
): SimilarItem[] {
  const limit = options?.limit ?? 12;
  const ranked = rankByDistance(items, palette, options?.excludeId);

  let selected = ranked;
  if (options?.relevanceGate) {
    selected = applyRelevanceGate(
      ranked,
      options.maxDistance ?? COLOR_RELEVANCE_MAX_DISTANCE,
      options.fallbackLimit ?? COLOR_RELEVANCE_FALLBACK_K,
    ).entries;
  }

  return selected.slice(0, limit).map(toSimilarItem);
}

/** Gallery / image-match ranking: sort by closeness, drop weak matches, else top-K. */
export function similarByPaletteRanked(
  items: CatalogItem[],
  palette: PaletteColor[],
  options?: Omit<SimilarOptions, "relevanceGate">,
): RankedColorResult {
  const ranked = rankByDistance(items, palette, options?.excludeId);
  const gated = applyRelevanceGate(
    ranked,
    options?.maxDistance ?? COLOR_RELEVANCE_MAX_DISTANCE,
    options?.fallbackLimit ?? COLOR_RELEVANCE_FALLBACK_K,
  );
  const limit = options?.limit ?? gated.entries.length;
  return {
    usedFallback: gated.usedFallback,
    items: gated.entries.slice(0, limit).map(toSimilarItem),
  };
}

export function similarByColor(
  items: CatalogItem[],
  rgb: [number, number, number],
  options?: SimilarOptions,
): SimilarItem[] {
  return similarByPalette(items, singleColorPalette(rgb), {
    excludeId: options?.excludeId,
    limit: options?.limit ?? items.length,
    relevanceGate: options?.relevanceGate,
    maxDistance: options?.maxDistance,
    fallbackLimit: options?.fallbackLimit,
  });
}

export function similarByColorRanked(
  items: CatalogItem[],
  rgb: [number, number, number],
  options?: Omit<SimilarOptions, "relevanceGate">,
): RankedColorResult {
  return similarByPaletteRanked(items, singleColorPalette(rgb), options);
}
