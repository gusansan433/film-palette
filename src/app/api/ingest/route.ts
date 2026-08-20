import { NextResponse } from "next/server";
import { ingestDaily } from "@/lib/ingest";
import { pickToday } from "@/lib/catalog";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const force = searchParams.get("force") === "1";
  const count = Number(searchParams.get("count") || 10);
  const result = await ingestDaily({
    count: Number.isFinite(count) ? Math.min(Math.max(count, 1), 10) : 10,
    force,
  });

  return NextResponse.json({
    ...result,
    today: pickToday(result.catalog?.items ?? [], 10),
  });
}

export async function POST(request: Request) {
  return GET(request);
}
