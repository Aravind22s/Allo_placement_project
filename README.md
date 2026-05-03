# Allo Inventory — Reservation System

**Live URL:** https://YOUR_APP.vercel.app

---

## The Idea

Think of it exactly like booking a movie ticket online.

When you pick your seats on a booking site, those seats are instantly shown as reserved to every other user — even though you haven't paid yet. The site gives you a 10-minute window to complete your payment. During that window nobody else can grab your seats. If you pay within the time, the seats are permanently yours. If you abandon the page or the timer runs out, the seats are automatically released and go back on sale for everyone else.

This system works the same way for physical inventory:

- Customer proceeds to checkout → units are **reserved** for 10 minutes
- Payment succeeds within 10 minutes → reservation is **confirmed**, stock is permanently decremented
- Timer runs out or customer cancels → reservation is **released**, units go back to available stock

The hard part is making sure that when two customers try to grab the last unit at the exact same millisecond, only one succeeds. This is the race condition the system is built to prevent.

---

Built with Next.js, Prisma, PostgreSQL (Supabase), and Redis (Upstash).

---

## How to Run Locally

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project (free tier)
- An [Upstash](https://console.upstash.com) Redis database (free tier)

### 1. Clone and install

```bash
git clone https://github.com/Aravind22s/Allo_placement_project.git
cd Allo_placement_project
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env
```

Fill in all six values in `.env`:

| Variable | Where to get it |
|---|---|
| `DATABASE_URL` | Supabase → Settings → Database → **Transaction pooler** URL (port 6543) |
| `DIRECT_URL` | Supabase → Settings → Database → **Direct connection** URL (port 5432) |
| `UPSTASH_REDIS_REST_URL` | Upstash Console → your database → REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Console → your database → REST Token |
| `RESERVATION_TTL_MINUTES` | Set to `10` |
| `CRON_SECRET` | Any random string you invent |

### 3. Run migrations

```bash
npx prisma migrate dev --name init
```

After the migration completes, open the **Supabase SQL Editor** and run this once to add the database-level safety constraint:

```sql
ALTER TABLE "Stock"
ADD CONSTRAINT reserved_lte_total CHECK (reserved <= total AND reserved >= 0);
```

This prevents `reserved` from ever exceeding `total` even if application code has a bug.

### 4. Seed the database

```bash
npx prisma db seed
```

This creates 2 warehouses (Chennai Hub, Mumbai Central) and 3 products (Treadmill Pro X1, Resistance Band Set, Yoga Mat Ultra) with stock in each warehouse.

### 5. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## How the Expiry Mechanism Works in Production

Reservations that aren't confirmed before `expiresAt` must be released so the stock returns to available. Two complementary mechanisms handle this:

### 1. Vercel Cron Job (primary)

`vercel.json` schedules `GET /api/cron/expire-reservations` to run every minute in production:

```json
{
  "crons": [{ "path": "/api/cron/expire-reservations", "schedule": "* * * * *" }]
}
```

The endpoint finds every `PENDING` reservation where `expiresAt < now()` and releases each one inside a transaction — setting status to `RELEASED` and decrementing `reserved` on the Stock row. Vercel sends the `Authorization: Bearer <CRON_SECRET>` header automatically; unauthenticated calls get a `401`.

### 2. Lazy cleanup on interaction (fallback)

Both the confirm and release endpoints check `expiresAt` before acting. If a reservation has expired, confirm returns `410` and the stock is not touched. This means even if the cron misses a cycle, no expired reservation can be confirmed.

Together these two approaches ensure stock is never permanently locked by an abandoned checkout.

---

## Trade-offs and What I'd Do Differently With More Time

**Concurrency approach — atomic UPDATE over SELECT + FOR UPDATE**

The reserve endpoint uses a single `$executeRaw` UPDATE that checks availability and increments `reserved` in one atomic operation. This avoids the TOCTOU (time-of-check to time-of-use) race without needing `SELECT ... FOR UPDATE` row locking. The trade-off is that raw SQL is less type-safe than the Prisma query builder — I've kept it isolated to one place and added a DB-level CHECK constraint as a backstop.

**No authentication**

Reservations are identified only by their ID in the URL. Anyone with the link can confirm or release a reservation. With more time I'd add NextAuth.js or Clerk to associate each reservation with a logged-in user and gate the confirm/release actions accordingly.

**Cron granularity**

Vercel's free tier limits cron jobs to once per minute. A reservation could theoretically stay PENDING for up to 59 seconds past its `expiresAt`. For a production system I'd use BullMQ with Upstash Redis to schedule a per-reservation delayed job that fires at exactly `expiresAt`.

**Seed is not fully idempotent**

Warehouses use `upsert` so running the seed twice is safe for them. Products use `create`, so a second seed run produces duplicates. With more time I'd convert product creation to upsert on a unique `name` field.

**No real-time expiry in the UI**

The countdown on the reservation page ticks down visually, but the page doesn't automatically detect when the server has released the reservation. If the timer hits zero and the user clicks Confirm, they'll get a `410` error message — which is handled correctly. With more time I'd use Supabase Realtime or SSE to push the status change to the client the moment expiry happens.

**Single unit in the UI**

The API fully supports `quantity > 1`, but the product listing always reserves exactly 1 unit. Adding a quantity selector to the Reserve button would be a straightforward extension.