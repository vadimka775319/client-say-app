import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth-server";
import { getOrCreateSitePublicConfig, updateSitePublicConfig } from "@/lib/site-public-db";

/** Не кэшировать ответ — иначе футер после правок в админке не обновляется. */
export const dynamic = "force-dynamic";
export const revalidate = 0;

const noStore = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
} as const;

const patchSchema = z.object({
  logoUrl: z.string().max(2_000_000),
  brandLine: z.string().min(1).max(500),
  emailInfo: z.string().min(1).max(320),
  phoneDisplay: z.string().max(120),
  phoneTel: z.string().max(80),
  schedule: z.string().min(1).max(200),
});

export async function GET() {
  try {
    const config = await getOrCreateSitePublicConfig();
    return NextResponse.json(config, { headers: noStore });
  } catch {
    return NextResponse.json({ error: "server" }, { status: 500, headers: noStore });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }

    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "validation" }, { status: 400 });
    }

    const config = await updateSitePublicConfig(parsed.data);
    return NextResponse.json(config, { headers: noStore });
  } catch {
    return NextResponse.json({ error: "server" }, { status: 500, headers: noStore });
  }
}
