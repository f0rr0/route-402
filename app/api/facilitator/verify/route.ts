import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  return NextResponse.json(
    { error: "Not implemented", code: "not_implemented" },
    { status: 501 }
  );
}
