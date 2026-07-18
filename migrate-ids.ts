import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting Farmer ID Migration...");

  const farmers = await prisma.farmer.findMany();
  
  for (const farmer of farmers) {
    if (farmer.id.startsWith("F-")) {
      const numStr = farmer.id.split("-")[1];
      const newId = String(1000 + parseInt(numStr, 10)); // F-001 -> 1001
      
      console.log(`Migrating ${farmer.id} -> ${newId}...`);

      // Create new farmer
      const newFarmer = await prisma.farmer.create({
        data: {
          id: newId,
          name: farmer.name,
          phone: farmer.phone,
          email: farmer.email,
          photoUrl: farmer.photoUrl,
          createdAt: farmer.createdAt,
          updatedAt: farmer.updatedAt,
        },
      });

      // Move relations
      await prisma.bill.updateMany({
        where: { farmerId: farmer.id },
        data: { farmerId: newId },
      });

      await prisma.cashTransaction.updateMany({
        where: { farmerId: farmer.id },
        data: { farmerId: newId },
      });

      await prisma.cropLog.updateMany({
        where: { farmerId: farmer.id },
        data: { farmerId: newId },
      });

      // Delete old farmer
      await prisma.farmer.delete({
        where: { id: farmer.id },
      });

      console.log(`Successfully migrated ${farmer.id} to ${newId}`);
    }
  }
  
  console.log("Migration complete!");
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
