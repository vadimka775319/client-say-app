import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

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
      ...(params.points != null ? { points: params.points } : {}),
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
    email: "owner@clientsay.ru",
    password: "OwnerOnly#2026",
    role: Role.SUPER_ADMIN,
    firstName: "Owner",
    lastName: "Admin",
  });
  console.log("Seeded super admin: owner@clientsay.ru");

  const partnerUser = await upsertUser({
    email: "partner@clientsay.ru",
    password: "PartnerDemo2026!",
    role: Role.PARTNER,
    firstName: "Демо",
    lastName: "Партнёр",
  });

  await prisma.partner.upsert({
    where: { userId: partnerUser.id },
    update: { companyName: "Демо-компания", city: "Москва", locations: 0 },
    create: {
      userId: partnerUser.id,
      companyName: "Демо-компания",
      city: "Москва",
      locations: 0,
    },
  });
  console.log("Seeded partner: partner@clientsay.ru");

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
      phoneDisplay: "89526230351",
      phoneTel: "+79526230351",
    },
    create: {
      id: "default",
      brandLine: "Сервис обратной связи с использованием QR-кодов",
      emailInfo: "info@clientsay.ru",
      phoneDisplay: "89526230351",
      phoneTel: "+79526230351",
      schedule: "пн-пт 10:00-17:00 МСК",
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
