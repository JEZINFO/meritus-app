"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/src/lib/supabase";

/**
 * Home do Meritus
 * - Evita 404 na raiz (/)
 * - Se houver sessão: vai para /lancamentos
 * - Se não: vai para /login
 */
export default function Page() {
  const router = useRouter();
  const [msg, setMsg] = useState("Carregando…");

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        setMsg("Erro de sessão. Indo para login…");
        router.replace("/login");
        return;
      }
      const has = !!data?.session?.user;
      router.replace(has ? "/lancamentos" : "/login");
    })();
  }, [router]);

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 20 }}>
      <div
        style={{
          maxWidth: 520,
          width: "100%",
          borderRadius: 18,
          border: "1px solid rgba(255,255,255,.12)",
          background: "rgba(255,255,255,.06)",
          padding: 16,
        }}
      >
        <div style={{ fontWeight: 950, fontSize: 18, marginBottom: 8 }}>Meritus</div>
        <div style={{ opacity: 0.82 }}>{msg}</div>
        <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <a
            href="/lancamentos"
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              background: "rgba(255,255,255,.10)",
              border: "1px solid rgba(255,255,255,.16)",
              color: "inherit",
              fontWeight: 950,
              textDecoration: "none",
            }}
          >
            Ir para Lançamentos
          </a>
          <a
            href="/admin"
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              background: "transparent",
              border: "1px solid rgba(255,255,255,.16)",
              color: "inherit",
              fontWeight: 900,
              textDecoration: "none",
            }}
          >
            Ir para Admin
          </a>
        </div>
      </div>
    </main>
  );
}
