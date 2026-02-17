"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../src/lib/supabaseClient";

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data?.session) router.push("/admin");
      else router.push("/login");
    })();
  }, [router]);

  return <div className="min-h-screen flex items-center justify-center text-sm text-black/60">Finalizando login...</div>;
}
