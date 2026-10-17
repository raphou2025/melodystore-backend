const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();
const bcryptPattern = /^\$2[aby]\$\d{2}\$/;

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, password: true },
  });
  const legacyUsers = users.filter(
    (user) => !bcryptPattern.test(user.password),
  );

  for (const user of legacyUsers) {
    const hashedPassword = await bcrypt.hash(user.password, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });
    console.log(`Hashed legacy password for ${user.email}`);
  }

  console.log(
    `Checked ${users.length} users; updated ${legacyUsers.length} legacy passwords.`,
  );
}

main()
  .catch((error) => {
    console.error("Failed to hash legacy passwords:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
