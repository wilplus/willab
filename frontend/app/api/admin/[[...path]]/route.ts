import { NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

function getPath(path: string[]): string {
  if (!path || path.length === 0) return "";
  return path.join("/");
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  const { path } = await params;
  const pathStr = getPath(path || []);
  const auth = req.headers.get("authorization") || "";
  const url = new URL(`/v2/admin/${pathStr}`, BACKEND);
  req.nextUrl.searchParams.forEach((v, k) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), { headers: { ...(auth && { Authorization: auth }) } });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  const { path } = await params;
  const pathStr = getPath(path || []);
  const auth = req.headers.get("authorization") || "";
  const body = await req.text();
  const res = await fetch(`${BACKEND}/v2/admin/${pathStr}`, {
    method: "POST",
    headers: {
      "Content-Type": req.headers.get("content-type") || "application/json",
      ...(auth && { Authorization: auth }),
    },
    body: body || undefined,
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  const { path } = await params;
  const pathStr = getPath(path || []);
  const auth = req.headers.get("authorization") || "";
  const body = await req.text();
  const res = await fetch(`${BACKEND}/v2/admin/${pathStr}`, {
    method: "PUT",
    headers: {
      "Content-Type": req.headers.get("content-type") || "application/json",
      ...(auth && { Authorization: auth }),
    },
    body: body || undefined,
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
