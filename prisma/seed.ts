import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = "owner@clientsay.ru";
  const password = "OwnerOnly#2026";
  const hash = await bcrypt.hash(password, 12);

  await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash: hash,
      role: Role.SUPER_ADMIN,
      firstName: "Owner",
      lastName: "Admin",
    },
    create: {
      email,
      passwordHash: hash,
      role: Role.SUPER_ADMIN,
      firstName: "Owner",
      lastName: "Admin",
    },
  });

  console.log("Seeded super admin:", email);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
