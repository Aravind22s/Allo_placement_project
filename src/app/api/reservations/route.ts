import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { ReserveSchema } from "@/lib/schemas";

const TTL_MINUTES = parseInt(process.env.RESERVATION_TTL_MINUTES ?? "10");

export async function POST(req: NextRequest) {
  // ── Idempotency (Bonus) ─────────────────────────────
  const idempotencyKey = req.headers.get("Idempotency-Key");
  if (idempotencyKey) {
    const cached = await redis.get<string>(`idem:${idempotencyKey}`);
    if (cached) {
      const parsed = JSON.parse(cached);
      return NextResponse.json(parsed.body, { status: parsed.status });
    }
  }

  // ── Validate input ──────────────────────────────────
  const body = await req.json().catch(() => null);
  const parsed = ReserveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { productId, warehouseId, quantity } = parsed.data;

  // ── Atomic reservation using a single UPDATE ────────
  // This is the key to correctness under concurrency.
  // We do NOT do a SELECT then UPDATE (TOCTOU race).
  // Instead we do one atomic UPDATE that checks availability inline.
  const result = await prisma.$executeRaw`
    UPDATE "Stock"
    SET reserved = reserved + ${quantity}
    WHERE "productId"  = ${productId}
      AND "warehouseId" = ${warehouseId}
      AND (total - reserved) >= ${quantity}
  `;

  // result = number of rows updated; 0 means not enough stock
  if (result === 0) {
    return NextResponse.json(
      { error: "Not enough stock available" },
      { status: 409 }
    );
  }

  // Stock was held — now create the reservation record
  const expiresAt = new Date(Date.now() + TTL_MINUTES * 60 * 1000);

  const reservation = await prisma.reservation.create({
    data: {
      productId,
      warehouseId,
      quantity,
      status: "PENDING",
      expiresAt,
    },
    include: { product: true },
  });

  const responseBody = reservation;

  // ── Store idempotency result ────────────────────────
  if (idempotencyKey) {
    await redis.set(
      `idem:${idempotencyKey}`,
      JSON.stringify({ body: responseBody, status: 201 }),
      { ex: 60 * 60 } // keep for 1 hour
    );
  }

  return NextResponse.json(responseBody, { status: 201 });
}