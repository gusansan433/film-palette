import sharp from "sharp";
import { bucketsFromPalette, paletteFromPixels, type RGB } from "./colors";
import type { PaletteColor, ColorBucket } from "./types";

export type ColorAnalysis = {
  palette: PaletteColor[];
  buckets: ColorBucket[];
  chroma: number;
};

function chromaOf(pixel: RGB) {
  const max = Math.max(pixel.r, pixel.g, pixel.b) / 255;
  const min = Math.min(pixel.r, pixel.g, pixel.b) / 255;
  return max === 0 ? 0 : (max - min) / max;
}

export function isColorful(analysis: ColorAnalysis, minChroma = 0.12) {
  return analysis.chroma >= minChroma;
}

export async function analyzeImageBuffer(buffer: Buffer): Promise<ColorAnalysis> {
  const { data, info } = await sharp(buffer)
    .rotate()
    .resize(96, 96, { fit: "cover" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels: RGB[] = [];
  let chromaSum = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    const pixel = { r: data[i], g: data[i + 1], b: data[i + 2] };
    pixels.push(pixel);
    chromaSum += chromaOf(pixel);
  }

  const palette = paletteFromPixels(pixels, 5);
  const buckets = bucketsFromPalette(palette);
  return {
    palette,
    buckets: buckets.length ? buckets : [palette[0]?.bucket ?? "gray"],
    chroma: pixels.length ? chromaSum / pixels.length : 0,
  };
}
