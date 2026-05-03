"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow, isPast } from "date-fns";

type Reservation = {
  id: string;
  status: "PENDING" | "CONFIRMED" | "RELEASED";
  expiresAt: string;
  quantity: number;
  product: { name: string };
};

function Countdown({ expiresAt }: { expiresAt: string }) {
  const [label, setLabel] = useState("");

  useEffect(() => {
    function tick() {
      const expiry = new Date(expiresAt);
      if (isPast(expiry)) {
        setLabel("Expired");
        return;
      }
      setLabel(`Expires ${formatDistanceToNow(expiry, { addSuffix: true })}`);
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  return (
    <span className={`text-sm ${label === "Expired" ? "text-destructive" : "text-muted-foreground"}`}>
      ⏱ {label}
    </span>
  );
}

export default function ReservationPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const fetchRes = async () => {
      const res = await fetch(`/api/reservations/${id}`);
      if (res.ok) setReservation(await res.json());
      setLoading(false);
    };
    fetchRes();
  }, [id]);

  async function handleAction(action: "confirm" | "release") {
    setBusy(true);
    setActionError(null);

    const res = await fetch(`/api/reservations/${id}/${action}`, {
      method: "POST",
    });
    const data = await res.json();

    if (!res.ok) {
      setActionError(
        res.status === 410
          ? "This reservation has expired. The stock has been released."
          : data.error ?? "Something went wrong"
      );
      setBusy(false);
      return;
    }

    setReservation(data); // update UI without refresh
    setBusy(false);
  }

  if (loading) return <div className="p-8 text-center">Loading…</div>;
  if (!reservation) return <div className="p-8 text-center">Not found.</div>;

  const statusColor: Record<Reservation["status"], "secondary" | "default" | "outline"> = {
    PENDING: "secondary",
    CONFIRMED: "default",
    RELEASED: "outline",
  };

  return (
    <main className="max-w-lg mx-auto px-4 py-16">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Your Reservation</CardTitle>
            <Badge variant={statusColor[reservation.status]}>
              {reservation.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-1">
            <p className="font-medium text-lg">{reservation.product.name}</p>
            <p className="text-sm text-muted-foreground">
              Qty: {reservation.quantity}
            </p>
            <Countdown expiresAt={reservation.expiresAt} />
          </div>

          {actionError && (
            <div className="rounded-md bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 text-sm">
              {actionError}
            </div>
          )}

          {reservation.status === "PENDING" && (
            <div className="flex gap-3">
              <Button
                className="flex-1"
                disabled={busy}
                onClick={() => handleAction("confirm")}
              >
                {busy ? "Processing…" : "Confirm Purchase"}
              </Button>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => handleAction("release")}
              >
                Cancel
              </Button>
            </div>
          )}

          {reservation.status === "CONFIRMED" && (
            <div className="text-green-600 font-medium text-center py-2">
              ✓ Purchase confirmed! Thank you.
            </div>
          )}

          {reservation.status === "RELEASED" && (
            <div className="space-y-3">
              <p className="text-muted-foreground text-sm text-center">
                This reservation was released.
              </p>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => router.push("/")}
              >
                Back to products
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}