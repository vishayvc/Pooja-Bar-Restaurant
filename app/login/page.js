"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/");
    });
  }, [router]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.replace("/");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="w-12 h-12 mx-auto rounded bg-gradient-to-br from-amber to-amberdark flex items-center justify-center font-display font-bold text-ink text-2xl mb-3">
            P
          </div>
          <h1 className="font-display font-bold text-xl text-ink">Pooja Bar and Restaurant</h1>
          <p className="text-xs text-stone-500 uppercase tracking-widest mt-1">Shop Manager</p>
        </div>
        <form onSubmit={handleSubmit} className="card">
          <div className="mb-3">
            <label className="field-label">Email</label>
            <input
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="mb-4">
            <label className="field-label">Password</label>
            <input
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && (
            <div className="text-xs text-red bg-red/10 border border-red/30 rounded px-3 py-2 mb-3">
              {error}
            </div>
          )}
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="text-center text-xs text-stone-400 mt-4">
          Accounts are created in Supabase → Authentication → Users. There is no
          public sign-up on this app.
        </p>
      </div>
    </div>
  );
}
