import { NextResponse } from "next/server";
import { analyzeImageBuffer } from "@/lib/analyze";
import { loadCatalog } from "@/lib/catalog";
import { similarByPalette } from "@/lib/similar";

export const runtime = "nodejs";
export const maxDuration = 30;

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "请选择一张图片。" }, { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: "只支持 JPG / PNG / WEBP。" }, { status: 400 });
  }
  if (file.size > 6 * 1024 * 1024) {
    return NextResponse.json({ error: "图片请小于 6MB。" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const analysis = await analyzeImageBuffer(buffer);
  const catalog = await loadCatalog();
  const similar = similarByPalette(catalog.items, analysis.palette, { limit: catalog.items.length });

  return NextResponse.json({
    palette: analysis.palette,
    similar,
    persisted: false,
  });
}
