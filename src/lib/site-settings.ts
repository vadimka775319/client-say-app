export type SiteSettings = {
  logoUrl: string;
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
  logoUrl: "",
  phoneDisplay: "",
  phoneTel: "",
  schedule: "Ответим на e-mail в рабочие дни (МСК)",
  emailInfo: "clientsay@mail.ru",
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
