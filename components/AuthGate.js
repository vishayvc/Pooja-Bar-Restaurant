"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AuthGate({ children }) {
  const router = useRouter();
  const [status, setStatus] = useState("checking"); // checking | ok | none

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (data.session) {
        setStatus("ok");
      } else {
        setStatus("none");
        router.replace("/login");
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setStatus("none");
        router.replace("/login");
      } else {
        setStatus("ok");
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [router]);

  if (status !== "ok") {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-stone-500">
        Checking session…
      </div>
    );
  }

  return children;
}
