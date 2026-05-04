"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Stock = {
  warehouseId: string;
  warehouseName: string;
  warehouseLocation: string;
  available: number;
};

type Product = {
  id: string;
  name: string;
  description: string | null;
  stocks: Stock[];
};

export default function HomePage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [reserving, setReserving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/products")
      .then((r) => r.json())
      .then(setProducts)
      .finally(() => setLoading(false));
  }, []);

  async function reserve(productId: string, warehouseId: string) {
    const key = `${productId}-${warehouseId}`;
    setReserving(key);
    setError(null);

    const res = await fetch("/api/reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, warehouseId, quantity: 1 }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "Something went wrong");
      setReserving(null);
      return;
    }

    router.push(`/reservation/${data.id}`);
  }

  if (loading) return <div className="p-8 text-center">Loading products…</div>;

  return (
    <main className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold mb-2">Allo Inventory</h1>
      <p className="text-muted-foreground mb-8">
        Reserve a product — you have 10 minutes to complete your purchase.
      </p>

      {error && (
        <div className="mb-6 rounded-md bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {products.map((product) => (
          <Card key={product.id}>
            <CardHeader>
              <CardTitle>{product.name}</CardTitle>
              {product.description && (
                <p className="text-sm text-muted-foreground">
                  {product.description}
                </p>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {product.stocks.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No warehouse data.
                </p>
              )}
              {product.stocks.map((s) => (
                <div
                  key={s.warehouseId}
                  className="flex items-center justify-between"
                >
                  <div>
                    <p className="text-sm font-medium">{s.warehouseName}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.warehouseLocation}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={s.available > 0 ? "secondary" : "outline"}>
                      {s.available > 0 ? `${s.available} available` : "Out of stock"}
                    </Badge>
                    <Button
                      size="sm"
                      disabled={
                        s.available === 0 ||
                        reserving === `${product.id}-${s.warehouseId}`
                      }
                      onClick={() => reserve(product.id, s.warehouseId)}
                    >
                      {reserving === `${product.id}-${s.warehouseId}`
                        ? "Reserving…"
                        : "Reserve"}
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
