import { NextResponse } from "next/server";
import { getDeployInfo } from "@/lib/deploy-info";

export function deployMetaJsonResponse(): NextResponse {
  const res = NextResponse.json(getDeployInfo());
  res.headers.set("Cache-Control", "no-store, must-revalidate");
  return res;
}
