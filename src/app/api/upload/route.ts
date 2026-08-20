import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { analyzeImageBuffer } from "@/lib/analyze";
import { loadCatalog, saveCatalog } from "@/lib/catalog";
import { similarByPalette } from "@/lib/similar";
import type { CatalogItem } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

function textField(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

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

  const titleEn = textField(form, "titleEn");
  const titleZh = textField(form, "titleZh");
  const director = textField(form, "director");
  const sourceLabel = textField(form, "sourceLabel");
  const rights = textField(form, "rights");

  if (titleEn.length < 2) {
    return NextResponse.json({ error: "请填写标题。" }, { status: 400 });
  }
  if (sourceLabel.length < 2) {
    return NextResponse.json({ error: "请填写来源。" }, { status: 400 });
  }
  if (rights !== "yes") {
    return NextResponse.json({ error: "请确认你有权上传这张图。" }, { status: 400 });
  }

  const sourceUrl = /^https?:\/\//i.test(sourceLabel) ? sourceLabel : undefined;
  const buffer = Buffer.from(await file.arrayBuffer());
  const analysis = await analyzeImageBuffer(buffer);
  const id = crypto.randomUUID();
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";

  let imageUrl = "";
  let persisted = false;
  try {
    const dir = path.join(process.cwd(), "public", "uploads");
    await mkdir(dir, { recursive: true });
    const filename = `${id}.${ext}`;
    await writeFile(path.join(dir, filename), buffer);
    imageUrl = `/uploads/${filename}`;
    persisted = true;
  } catch {
    persisted = false;
  }

  const item: CatalogItem = {
    id,
    title: titleEn,
    titleEn,
    titleZh: titleZh || "未注明",
    director: director || "未注明",
    source: "user",
    imageUrl: imageUrl || "",
    thumbUrl: imageUrl || "",
    pageUrl: sourceUrl,
    author: sourceLabel,
    license: "用户提供，来源见标注",
    buckets: analysis.buckets,
    palette: analysis.palette,
    addedAt: new Date().toISOString(),
    fileKey: `user:${id}`,
    kind: director ? "film" : "photo",
    photographer: director || "未注明",
    sourceLabel,
  };

  const catalog = await loadCatalog();
  if (persisted) {
    catalog.items = [item, ...catalog.items];
    try {
      await saveCatalog(catalog);
    } catch {
      persisted = false;
    }
  }

  const similar = similarByPalette(catalog.items, item.palette, {
    excludeId: item.id,
    limit: 12,
  });

  return NextResponse.json({ item, similar, persisted });
}
