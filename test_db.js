const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  try {
    const user = await prisma.user.findFirst();
    if (!user) {
      console.log("No user found");
      return;
    }
    const farmer = await prisma.farmer.create({
      data: {
        farmerNo: "1001",
        userId: user.id,
        name: "Test Farmer",
        phone: "1234567890",
      },
    });
    console.log("Created farmer:", farmer);
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await prisma.$disconnect();
  }
}
test();
