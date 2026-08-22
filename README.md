# Pooja Bar and Restaurant — Shop Manager

Next.js + Supabase web app. Deploys to Vercel from GitHub, works in any
mobile browser, and can be added to a phone's home screen as a PWA
(it won't be a native app store app — see the earlier conversation about
why React Native and Vercel don't combine).

## 1. Set up Supabase

1. Create a project at supabase.com.
2. Open the SQL editor and run `supabase_schema.sql` (the file from the
   earlier message — copy it in alongside this project, or paste its
   contents directly).
3. Go to Authentication → Users → Add user, and create a login for
   yourself (and anyone else who'll use the app). There's no public
   sign-up screen — accounts are created by you in the Supabase dashboard.
4. Go to Project Settings → API and copy the **Project URL** and
   **anon public key**.

## 2. Run it locally

```bash
npm install
cp .env.local.example .env.local
# edit .env.local and paste in your Supabase URL + anon key
npm run dev
```

Open http://localhost:3000 and sign in with the user you created in
Supabase.

## 3. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<your-username>/<repo-name>.git
git push -u origin main
```

## 4. Deploy on Vercel

1. vercel.com → New Project → import the GitHub repo.
2. In the project's Environment Variables, add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   (same values as your `.env.local`)
3. Deploy. Every push to `main` redeploys automatically.

## What's implemented

- **Dashboard** — today / this month / financial year (Apr–Mar) KPIs,
  low-stock alert, dealer payables.
- **Dealers** — add dealer, ledger (purchased vs paid vs balance).
- **Purchase** — logs a credit purchase; a database trigger updates the
  item's stock, purchase rate, and selling rate automatically.
- **Inventory** — add catalog items, view live stock and stock value.
- **Sales** — line-by-line entry by brand+size (saves and updates stock
  immediately), cash/UPI collection with a mismatch check, opening/closing
  stock, CSV export per date.
- **Expenses** — type-driven form (Salary → employee dropdown, Dealer
  Payment → dealer dropdown), feeds the dealer ledger.
- **Auth** — Supabase email/password login gates every page. Row Level
  Security is set to "any signed-in user, full access" — there's no
  per-staff permission split yet (see the SQL file's comments).

## Known open decisions (carried over from the schema)

- **Overselling is blocked**, not just flagged — a sale line that would
  take stock negative is rejected by the database. Change this in the
  trigger in `supabase_schema.sql` if you'd rather allow it and warn
  instead.
- **Purchase rate uses "last purchase wins"** — editing an old purchase
  will overwrite the item's current rate even if a newer purchase exists.
  Fine for how most small shops actually operate, but flagged in case you
  want weighted-average costing instead.
- **"Sadar" / "Sadar Daily"** expense types are kept as literal labels —
  confirm they mean what I assumed.
