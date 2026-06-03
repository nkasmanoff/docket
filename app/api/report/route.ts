import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// Trust & accuracy: a "report a problem" sink. For v1 this logs the flagged
// puzzle JSON to the server logs for human review. SEAM: forward to a database,
// issue tracker, or Slack webhook for a real review queue.
export async function POST(req: NextRequest) {
  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  console.warn("[REPORT] flagged puzzle for human review:", JSON.stringify(body));
  return NextResponse.json({ ok: true });
}
