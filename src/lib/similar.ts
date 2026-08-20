import { paletteDistance, classifyHue, rgbToHex } from "./colors";
import type { CatalogItem, PaletteColor } from "./types";

export function similarByPalette(
  items: CatalogItem[],
  palette: PaletteColor[],
  options?: { excludeId?: string; limit?: number },
) {
  const limit = options?.limit ?? 12;
  return items
    .filter((item) => item.id !== options?.excludeId)
    .map((item) => ({
      item,
      distance: paletteDistance(palette, item.palette),
    }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit)
    .map((entry) => ({
      ...entry.item,
      matchScore: Math.max(0, Math.round((1 - entry.distance / 80) * 100)),
    }));
}

export function similarByColor(
  items: CatalogItem[],
  rgb: [number, number, number],
  options?: { excludeId?: string; limit?: number },
) {
  const palette: PaletteColor[] = [
    {
      hex: rgbToHex(...rgb),
      rgb,
      ratio: 1,
      bucket: classifyHue(...rgb),
    },
  ];
  return similarByPalette(items, palette, {
    excludeId: options?.excludeId,
    limit: options?.limit ?? items.length,
  });
}
