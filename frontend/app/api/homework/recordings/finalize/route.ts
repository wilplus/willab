import { NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const body = await req.json().catch(() => ({}));
  const res = await fetch(`${BACKEND}/v2/homework/recordings/finalize`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(auth ? { Authorization: auth } : {}) },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
