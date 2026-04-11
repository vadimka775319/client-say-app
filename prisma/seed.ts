import path from "path";
import { config as loadEnv } from "dotenv";
import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

/** Как в start-prod: до PrismaClient, иначе при `npx tsx prisma/seed.ts` бывает пустой DATABASE_URL. */
loadEnv({ path: path.join(__dirname, "..", ".env") });
loadEnv({ path: path.join(__dirname, "..", ".env.production"), override: true });

const prisma = new PrismaClient();

async function upsertUser(params: {
  email: string;
  password: string;
  role: Role;
  firstName: string;
  lastName: string;
  points?: number;
}) {
  const hash = await bcrypt.hash(params.password, 12);
  return prisma.user.upsert({
    where: { email: params.email },
    update: {
      passwordHash: hash,
      role: params.role,
      firstName: params.firstName,
      lastName: params.lastName,
      // points не трогаем при повторном seed — иначе каждый деплой сбрасывает баланс пользователя
    },
    create: {
      email: params.email,
      passwordHash: hash,
      role: params.role,
      firstName: params.firstName,
      lastName: params.lastName,
      ...(params.points != null ? { points: params.points } : {}),
    },
  });
}

async function main() {
  await upsertUser({
    email: "clientsay@mail.ru",
    password: "OwnerOnly#2026",
    role: Role.SUPER_ADMIN,
    firstName: "Owner",
    lastName: "Admin",
  });
  console.log("Seeded super admin: clientsay@mail.ru");

  const partnerUser = await upsertUser({
    email: "partner@clientsay.ru",
    password: "PartnerDemo2026!",
    role: Role.PARTNER,
    firstName: "Демо",
    lastName: "Партнёр",
  });

  const demoPartner = await prisma.partner.upsert({
    where: { userId: partnerUser.id },
    update: {
      companyName: "Демо-компания",
      city: "Москва",
      locations: 3,
      addressLine: "ТЦ «Пульс», демо-точка — QR для брифа на стойке.",
    },
    create: {
      userId: partnerUser.id,
      companyName: "Демо-компания",
      city: "Москва",
      locations: 3,
      addressLine: "ТЦ «Пульс», демо-точка — QR для брифа на стойке.",
    },
  });
  console.log("Seeded partner: partner@clientsay.ru");

  await prisma.reward.upsert({
    where: { id: "seed_reward_demo_coffee" },
    /** Не трогаем stockLeft/totalStock — иначе каждый деплой сбрасывает остаток призов */
    update: {
      title: "Капучино в подарок",
      description: "Классический капучино 300 мл. Покажите код сотруднику.",
      imageUrl: "https://picsum.photos/seed/pulse-r1/800/440",
      pointsCost: 300,
      startsAt: new Date("2026-03-01T00:00:00.000Z"),
      endsAt: new Date("2026-12-31T23:59:59.000Z"),
    },
    create: {
      id: "seed_reward_demo_coffee",
      partnerId: demoPartner.id,
      fundedByPlatform: false,
      title: "Капучино в подарок",
      description: "Классический капучино 300 мл. Покажите код сотруднику.",
      imageUrl: "https://picsum.photos/seed/pulse-r1/800/440",
      pointsCost: 300,
      totalStock: 100,
      stockLeft: 42,
      startsAt: new Date("2026-03-01T00:00:00.000Z"),
      endsAt: new Date("2026-12-31T23:59:59.000Z"),
    },
  });
  console.log("Seeded demo reward for partner cabinet");

  await upsertUser({
    email: "user@clientsay.ru",
    password: "UserDemo2026!",
    role: Role.USER,
    firstName: "Демо",
    lastName: "Пользователь",
    points: 1320,
  });
  console.log("Seeded user: user@clientsay.ru");

  await prisma.sitePublicConfig.upsert({
    where: { id: "default" },
    update: {
      emailInfo: "clientsay@mail.ru",
      phoneDisplay: "",
      phoneTel: "",
      schedule: "Ответим на e-mail в рабочие дни (МСК)",
    },
    create: {
      id: "default",
      brandLine: "Сервис обратной связи с использованием QR-кодов",
      emailInfo: "clientsay@mail.ru",
      phoneDisplay: "",
      phoneTel: "",
      schedule: "Ответим на e-mail в рабочие дни (МСК)",
    },
  });
  console.log("Seeded site public config (footer / contacts)");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
