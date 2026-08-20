import { NextResponse } from "next/server";
import { loadCatalog, pickToday } from "@/lib/catalog";

export const runtime = "nodejs";

export async function GET() {
  const catalog = await loadCatalog();
  return NextResponse.json({
    items: catalog.items,
    today: pickToday(catalog.items, 10),
    lastIngestDate: catalog.lastIngestDate,
  });
}
