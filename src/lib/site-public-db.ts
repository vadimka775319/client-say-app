import { prisma } from "@/lib/prisma";
import { defaultSiteSettings } from "@/lib/site-settings";

export type SitePublicFields = {
  logoUrl: string;
  brandLine: string;
  emailInfo: string;
  phoneDisplay: string;
  phoneTel: string;
  schedule: string;
};

const defaults: SitePublicFields = {
  logoUrl: defaultSiteSettings.logoUrl,
  brandLine: defaultSiteSettings.brandLine,
  emailInfo: defaultSiteSettings.emailInfo,
  phoneDisplay: defaultSiteSettings.phoneDisplay,
  phoneTel: defaultSiteSettings.phoneTel,
  schedule: defaultSiteSettings.schedule,
};

export function rowToPublic(row: SitePublicFields): SitePublicFields {
  return {
    logoUrl: row.logoUrl,
    brandLine: row.brandLine,
    emailInfo: row.emailInfo,
    phoneDisplay: row.phoneDisplay,
    phoneTel: row.phoneTel,
    schedule: row.schedule,
  };
}

export async function getOrCreateSitePublicConfig(): Promise<SitePublicFields> {
  const existing = await prisma.sitePublicConfig.findUnique({ where: { id: "default" } });
  if (existing) return rowToPublic(existing);

  const created = await prisma.sitePublicConfig.create({
    data: {
      id: "default",
      ...defaults,
    },
  });
  return rowToPublic(created);
}

export async function updateSitePublicConfig(data: SitePublicFields): Promise<SitePublicFields> {
  const row = await prisma.sitePublicConfig.upsert({
    where: { id: "default" },
    create: { id: "default", ...data },
    update: data,
  });
  return rowToPublic(row);
}
