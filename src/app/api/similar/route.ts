import { NextResponse } from "next/server";
import { loadCatalog } from "@/lib/catalog";
import { similarByPalette } from "@/lib/similar";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const catalog = await loadCatalog();
  const target = catalog.items.find((item) => item.id === id);
  if (!target) {
    return NextResponse.json({ error: "找不到这张图。" }, { status: 404 });
  }
  return NextResponse.json({
    item: target,
    similar: similarByPalette(catalog.items, target.palette, {
      excludeId: target.id,
    }),
  });
}
