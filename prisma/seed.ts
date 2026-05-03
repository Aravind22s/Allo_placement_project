import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Warehouses
  const wh1 = await prisma.warehouse.upsert({
    where: { id: "wh-chennai" },
    create: { id: "wh-chennai", name: "Chennai Hub", location: "Chennai, TN" },
    update: {},
  });

  const wh2 = await prisma.warehouse.upsert({
    where: { id: "wh-mumbai" },
    create: { id: "wh-mumbai", name: "Mumbai Central", location: "Mumbai, MH" },
    update: {},
  });

  // Products
  const products = [
    { name: "Treadmill Pro X1", description: "High-performance home treadmill" },
    { name: "Resistance Band Set", description: "Premium latex bands, 5 levels" },
    { name: "Yoga Mat Ultra", description: "6mm anti-slip eco-friendly mat" },
  ];

  for (const p of products) {
    const product = await prisma.product.create({ data: p });

    await prisma.stock.createMany({
      data: [
        { productId: product.id, warehouseId: wh1.id, total: 5, reserved: 0 },
        { productId: product.id, warehouseId: wh2.id, total: 3, reserved: 0 },
      ],
    });
  }

  console.log("✅ Seed complete");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());