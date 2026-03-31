export type SiteSettings = {
  phoneDisplay: string;
  phoneTel: string;
  schedule: string;
  emailInfo: string;
  brandLine: string;
  basePartners: number;
  usersPerPartner: number;
  baseRewards: number;
};

export const SITE_SETTINGS_KEY = "clientsay.site.settings.v1";

export const defaultSiteSettings: SiteSettings = {
  phoneDisplay: "8 (913) 516-90-73",
  phoneTel: "+79135169073",
  schedule: "пн-пт 10:00-17:00 МСК",
  emailInfo: "info@clientsay.ru",
  brandLine: "Сервис обратной связи с использованием QR-кодов",
  basePartners: 30,
  usersPerPartner: 3,
  baseRewards: 30,
};

export function computeLandingStats(
  settings: SiteSettings,
  realPartners: number,
  realUsers: number,
  realRewards: number,
) {
  const partners = Math.max(settings.basePartners + realPartners, 0);
  const users = Math.max(partners * settings.usersPerPartner + realUsers, 0);
  const rewards = Math.max(settings.baseRewards + realRewards, 0);

  return { partners, users, rewards };
}
