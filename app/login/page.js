"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/src/lib/supabase";

/**
 * Meritus - Login
 * - Email + senha (Supabase Auth)
 * - Redireciona para ?next=... (padrão /lancamentos)
 * - Se já estiver logado, redireciona automaticamente
 */

export default function LoginPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const next = useMemo(() => sp.get("next") || "/lancamentos", [sp]);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");

  const [erro, setErro] = useState(null);
  const [ok, setOk] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErro(null);

      const { data, error } = await supabase.auth.getSession();
      if (error) {
        setErro(error.message);
        setLoading(false);
        return;
      }

      if (data?.session?.user) {
        router.replace(next);
        return;
      }

      setLoading(false);
    })();
  }, [router, next]);

  async function entrar(e) {
    e?.preventDefault?.();
    setErro(null);
    setOk(null);

    const em = String(email || "").trim().toLowerCase();
    if (!em || !String(senha || "").trim()) {
      setErro("Informe e-mail e senha.");
      return;
    }

    setBusy(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: em,
      password: senha,
    });

    if (error) {
      setErro(error.message);
      setBusy(false);
      return;
    }

    if (data?.session?.user) {
      setOk("Login realizado.");
      router.replace(next);
      return;
    }

    // fallback raro
    setOk("Login realizado. Redirecionando…");
    router.replace(next);
  }

  async function enviarLinkMagico() {
    setErro(null);
    setOk(null);

    const em = String(email || "").trim().toLowerCase();
    if (!em) {
      setErro("Informe seu e-mail para receber o link.");
      return;
    }

    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: em,
      options: {
        emailRedirectTo: typeof window !== "undefined" ? window.location.origin + next : undefined,
      },
    });

    if (error) {
      setErro(error.message);
      setBusy(false);
      return;
    }

    setOk("Link enviado para seu e-mail. Verifique a caixa de entrada e o spam.");
    setBusy(false);
  }

  if (loading) {
    return (
      <main style={S.page}>
        <div style={S.card}>
          <div style={S.kicker}>Meritus</div>
          <div style={S.title}>Entrar</div>
          <div style={S.muted}>Carregando…</div>
        </div>
      </main>
    );
  }

  return (
    <main style={S.page}>
      <div style={S.bgGlowA} />
      <div style={S.bgGlowB} />

      <div style={S.card}>
        <div style={S.kicker}>Meritus</div>
        <div style={S.title}>Entrar</div>
        <div style={S.muted}>Acesso ao painel e lançamentos</div>

        {erro ? (
          <div style={S.alertErr}>
            <b>Erro:</b> {erro}
            <div style={{ marginTop: 6, opacity: 0.9 }}>
              Dica: confirme <code>NEXT_PUBLIC_SUPABASE_URL</code> e <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> no{" "}
              <code>.env.local</code>.
            </div>
          </div>
        ) : null}

        {ok ? (
          <div style={S.alertOk}>
            <b>OK:</b> {ok}
          </div>
        ) : null}

        <form onSubmit={entrar} style={{ display: "grid", gap: 10, marginTop: 14 }}>
          <label style={S.field}>
            <span style={S.label}>E-mail</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              inputMode="email"
              autoComplete="email"
              style={S.input}
            />
          </label>

          <label style={S.field}>
            <span style={S.label}>Senha</span>
            <input
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="••••••••"
              type="password"
              autoComplete="current-password"
              style={S.input}
            />
          </label>

          <button type="submit" style={S.btn} disabled={busy}>
            {busy ? "Entrando…" : "Entrar"}
          </button>

          <button type="button" style={S.btnGhost} disabled={busy} onClick={enviarLinkMagico}>
            {busy ? "Enviando…" : "Enviar link por e-mail (sem senha)"}
          </button>

          <a href="/" style={S.link}>
            Voltar
          </a>
        </form>
      </div>
    </main>
  );
}

const S = {
  page: {
    minHeight: "100vh",
    background: "#070a12",
    color: "#e5e7eb",
    display: "grid",
    placeItems: "center",
    padding: 16,
    position: "relative",
    overflow: "hidden",
  },
  bgGlowA: {
    position: "absolute",
    inset: "-30% auto auto -30%",
    width: 520,
    height: 520,
    borderRadius: 999,
    background: "radial-gradient(circle at 30% 30%, rgba(34,197,94,.20), rgba(34,197,94,0) 60%)",
    filter: "blur(8px)",
    pointerEvents: "none",
  },
  bgGlowB: {
    position: "absolute",
    inset: "auto -30% -35% auto",
    width: 640,
    height: 640,
    borderRadius: 999,
    background: "radial-gradient(circle at 70% 60%, rgba(99,102,241,.20), rgba(99,102,241,0) 60%)",
    filter: "blur(10px)",
    pointerEvents: "none",
  },
  card: {
    width: "min(520px, 92vw)",
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,.12)",
    background: "rgba(255,255,255,.06)",
    backdropFilter: "blur(14px)",
    padding: 16,
    position: "relative",
    zIndex: 1,
  },
  kicker: { fontSize: 12, opacity: 0.72, fontWeight: 900, letterSpacing: 0.3, textTransform: "uppercase" },
  title: { marginTop: 6, fontSize: 22, fontWeight: 950, letterSpacing: -0.3 },
  muted: { marginTop: 6, opacity: 0.78, fontSize: 13 },

  alertErr: {
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    border: "1px solid rgba(220,38,38,.35)",
    background: "rgba(220,38,38,.12)",
  },
  alertOk: {
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    border: "1px solid rgba(34,197,94,.35)",
    background: "rgba(34,197,94,.12)",
  },

  field: { display: "grid", gap: 6 },
  label: { fontSize: 12, opacity: 0.8, fontWeight: 900 },
  input: {
    width: "100%",
    padding: "12px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,.18)",
    background: "rgba(17,24,39,.65)",
    color: "#e5e7eb",
    outline: "none",
  },

  btn: {
    marginTop: 4,
    padding: "12px 12px",
    borderRadius: 14,
    background: "rgba(255,255,255,.12)",
    border: "1px solid rgba(255,255,255,.18)",
    color: "inherit",
    fontWeight: 950,
    cursor: "pointer",
  },
  btnGhost: {
    padding: "12px 12px",
    borderRadius: 14,
    background: "transparent",
    border: "1px solid rgba(255,255,255,.16)",
    color: "inherit",
    fontWeight: 900,
    cursor: "pointer",
  },
  link: { marginTop: 8, textDecoration: "none", color: "inherit", opacity: 0.85, fontWeight: 900 },
};
