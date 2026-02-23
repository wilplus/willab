import { NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const res = await fetch(`${BACKEND}/v2/homework/status`, {
    headers: { ...(auth && { Authorization: auth }) },
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
