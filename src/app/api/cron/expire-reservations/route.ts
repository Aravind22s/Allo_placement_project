import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Vercel calls this on a schedule. Protect it from public calls.
export async function GET(req: NextRequest) {
  if (
    req.headers.get("Authorization") !==
    `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find all PENDING reservations that have expired
  const expired = await prisma.reservation.findMany({
    where: {
      status: "PENDING",
      expiresAt: { lt: new Date() },
    },
  });

  let released = 0;

  for (const r of expired) {
    await prisma.$transaction(async (tx) => {
      await tx.reservation.update({
        where: { id: r.id, status: "PENDING" },
        data: { status: "RELEASED" },
      });

      await tx.stock.update({
        where: {
          productId_warehouseId: {
            productId: r.productId,
            warehouseId: r.warehouseId,
          },
        },
        data: { reserved: { decrement: r.quantity } },
      });
    });
    released++;
  }

  return NextResponse.json({ released });
}