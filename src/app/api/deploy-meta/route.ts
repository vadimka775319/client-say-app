import { NextResponse } from "next/server";
import { getDeployInfo } from "@/lib/deploy-info";

/** JSON версии деплоя — всегда через Node (обходит отсутствие public/deploy-meta.json и nginx static). */
export async function GET() {
  const res = NextResponse.json(getDeployInfo());
  res.headers.set("Cache-Control", "no-store, must-revalidate");
  return res;
}
