"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

const TABS = [
  { href: "/", label: "Dashboard" },
  { href: "/dealers", label: "Dealers" },
  { href: "/purchase", label: "Purchase" },
  { href: "/inventory", label: "Inventory" },
  { href: "/sales", label: "Sales" },
  { href: "/expenses", label: "Expenses" },
];

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <>
      <header className="bg-ink text-paper px-5 py-4 flex items-center justify-between border-b-4 border-amber">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded bg-gradient-to-br from-amber to-amberdark flex items-center justify-center font-display font-bold text-ink text-lg">
            P
          </div>
          <div>
            <h1 className="font-display font-bold text-lg leading-tight">
              Pooja Bar and Restaurant
            </h1>
            <div className="text-[10px] uppercase tracking-widest opacity-60">
              Shop Manager
            </div>
          </div>
        </div>
        <button onClick={signOut} className="text-xs font-semibold opacity-75 hover:opacity-100">
          Sign out
        </button>
      </header>
      <nav className="flex bg-paper2 border-b border-line px-4 overflow-x-auto">
        {TABS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={`px-4 py-3 text-sm font-semibold whitespace-nowrap border-b-2 ${
              pathname === t.href
                ? "border-amber text-ink"
                : "border-transparent text-stone-500 hover:text-ink"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
