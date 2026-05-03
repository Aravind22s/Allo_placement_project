import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const reservation = await prisma.reservation.findUnique({
    where: { id },
    include: { product: true },
  });

  if (!reservation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (reservation.status !== "PENDING") {
    return NextResponse.json(reservation);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const released = await tx.reservation.update({
      where: { id, status: "PENDING" },
      data: { status: "RELEASED" },
      include: { product: true },
    });

    await tx.stock.update({
      where: {
        productId_warehouseId: {
          productId: released.productId,
          warehouseId: released.warehouseId,
        },
      },
      data: { reserved: { decrement: released.quantity } },
    });

    return released;
  });

  return NextResponse.json(updated);
}