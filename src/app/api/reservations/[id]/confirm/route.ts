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

  if (reservation.status === "CONFIRMED") {
    return NextResponse.json(reservation);
  }

  if (reservation.status === "RELEASED" || reservation.expiresAt < new Date()) {
    return NextResponse.json(
      { error: "Reservation has expired or was already released" },
      { status: 410 }
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    const confirmed = await tx.reservation.update({
      where: { id, status: "PENDING" },
      data: { status: "CONFIRMED" },
      include: { product: true },
    });

    await tx.stock.update({
      where: {
        productId_warehouseId: {
          productId: confirmed.productId,
          warehouseId: confirmed.warehouseId,
        },
      },
      data: {
        total: { decrement: confirmed.quantity },
        reserved: { decrement: confirmed.quantity },
      },
    });

    return confirmed;
  });

  return NextResponse.json(updated);
}