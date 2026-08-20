import { COLOR_BUCKETS, type ColorBucket, type PaletteColor } from "./types";

export { COLOR_BUCKETS };
export type { ColorBucket, PaletteColor, CatalogItem } from "./types";

export type RGB = { r: number; g: number; b: number };

export function bucketMeta(id: ColorBucket) {
  return COLOR_BUCKETS.find((item) => item.id === id) ?? COLOR_BUCKETS[11];
}

export function rgbToHex(r: number, g: number, b: number) {
  return (
    "#" +
    [r, g, b]
      .map((channel) => Math.round(channel).toString(16).padStart(2, "0"))
      .join("")
  );
}

export function rgbToHsl(r: number, g: number, b: number) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return { h: h * 360, s, l };
}

export function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const hue = (((h % 360) + 360) % 360) / 60;
  const i = Math.floor(hue);
  const f = hue - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const mix = [
    [v, t, p],
    [q, v, p],
    [p, v, t],
    [p, q, v],
    [t, p, v],
    [v, p, q],
  ][i % 6];
  return [
    Math.round(mix[0] * 255),
    Math.round(mix[1] * 255),
    Math.round(mix[2] * 255),
  ];
}

export function rgbToHsv(r: number, g: number, b: number) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  if (delta !== 0) {
    if (max === r) h = ((g - b) / delta + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / delta + 2) / 6;
    else h = ((r - g) / delta + 4) / 6;
  }
  return { h: h * 360, s: max === 0 ? 0 : delta / max, v: max };
}

export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const hue = ((h % 360) + 360) % 360 / 360;
  if (s === 0) {
    const channel = Math.round(l * 255);
    return [channel, channel, channel];
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(hue2rgb(p, q, hue + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, hue) * 255),
    Math.round(hue2rgb(p, q, hue - 1 / 3) * 255),
  ];
}

export function classifyHue(r: number, g: number, b: number): ColorBucket {
  const { h, s, l } = rgbToHsl(r, g, b);
  if (l < 0.08) return "black";
  if (l > 0.92 && s < 0.14) return "white";
  if (s < 0.1) {
    if (l < 0.18) return "black";
    if (l > 0.82) return "white";
    return "gray";
  }
  if (h >= 12 && h < 52 && l < 0.48 && s < 0.62) return "brown";
  if (h >= 345 || h < 15) return "red";
  if (h < 40) return "orange";
  if (h < 70) return "yellow";
  if (h < 165) return "green";
  if (h < 198) return "cyan";
  if (h < 255) return "blue";
  if (h < 292) return "purple";
  return "pink";
}

function srgbToLinear(channel: number) {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  const rl = srgbToLinear(r);
  const gl = srgbToLinear(g);
  const bl = srgbToLinear(b);
  const x = (rl * 0.4124 + gl * 0.3576 + bl * 0.1805) / 0.95047;
  const y = (rl * 0.2126 + gl * 0.7152 + bl * 0.0722) / 1;
  const z = (rl * 0.0193 + gl * 0.1192 + bl * 0.9505) / 1.08883;
  const f = (t: number) =>
    t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export function deltaE(a: [number, number, number], b: [number, number, number]) {
  const labA = rgbToLab(...a);
  const labB = rgbToLab(...b);
  return Math.hypot(labA[0] - labB[0], labA[1] - labB[1], labA[2] - labB[2]);
}

function kmeans(pixels: RGB[], k: number, iterations = 10) {
  const centroids = pixels
    .filter((_, index) => index % Math.max(1, Math.floor(pixels.length / k)) === 0)
    .slice(0, k)
    .map((pixel) => ({ ...pixel }));

  while (centroids.length < k && pixels.length) {
    centroids.push({ ...pixels[centroids.length % pixels.length] });
  }

  const assignments = new Array(pixels.length).fill(0);

  for (let round = 0; round < iterations; round++) {
    for (let i = 0; i < pixels.length; i++) {
      let best = 0;
      let bestDist = Infinity;
      for (let c = 0; c < centroids.length; c++) {
        const d =
          (pixels[i].r - centroids[c].r) ** 2 +
          (pixels[i].g - centroids[c].g) ** 2 +
          (pixels[i].b - centroids[c].b) ** 2;
        if (d < bestDist) {
          bestDist = d;
          best = c;
        }
      }
      assignments[i] = best;
    }

    const sums = centroids.map(() => ({ r: 0, g: 0, b: 0, n: 0 }));
    for (let i = 0; i < pixels.length; i++) {
      const bucket = sums[assignments[i]];
      bucket.r += pixels[i].r;
      bucket.g += pixels[i].g;
      bucket.b += pixels[i].b;
      bucket.n += 1;
    }
    for (let c = 0; c < centroids.length; c++) {
      if (sums[c].n === 0) continue;
      centroids[c] = {
        r: sums[c].r / sums[c].n,
        g: sums[c].g / sums[c].n,
        b: sums[c].b / sums[c].n,
      };
    }
  }

  const counts = new Array(centroids.length).fill(0);
  for (const assignment of assignments) counts[assignment] += 1;

  return centroids
    .map((centroid, index) => ({ centroid, count: counts[index] }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count);
}

export function paletteFromPixels(pixels: RGB[], k = 5): PaletteColor[] {
  if (!pixels.length) return [];
  const clusters = kmeans(pixels, Math.min(k, pixels.length));
  const total = clusters.reduce((sum, cluster) => sum + cluster.count, 0);
  return clusters.map((cluster) => {
    const r = Math.round(cluster.centroid.r);
    const g = Math.round(cluster.centroid.g);
    const b = Math.round(cluster.centroid.b);
    return {
      hex: rgbToHex(r, g, b),
      rgb: [r, g, b],
      ratio: cluster.count / total,
      bucket: classifyHue(r, g, b),
    };
  });
}

export function bucketsFromPalette(palette: PaletteColor[]): ColorBucket[] {
  const scores = new Map<ColorBucket, number>();
  for (const swatch of palette) {
    scores.set(swatch.bucket, (scores.get(swatch.bucket) ?? 0) + swatch.ratio);
  }
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .filter(([, score]) => score >= 0.08)
    .map(([id]) => id);
}

export function paletteDistance(a: PaletteColor[], b: PaletteColor[]) {
  if (!a.length || !b.length) return 100;
  let total = 0;
  let weight = 0;
  for (const color of a.slice(0, 5)) {
    let best = Infinity;
    for (const other of b.slice(0, 5)) {
      best = Math.min(best, deltaE(color.rgb, other.rgb));
    }
    total += best * Math.max(color.ratio, 0.08);
    weight += Math.max(color.ratio, 0.08);
  }
  const samePrimary = a[0]?.bucket && a[0].bucket === b[0]?.bucket ? 0.82 : 1;
  return (total / weight) * samePrimary;
}
