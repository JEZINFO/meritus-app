"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../src/lib/supabase";
import { getProfile } from "../../src/lib/profile";

function Card({ children }) {
  return <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">{children}</div>;
}

export default function LoginClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | error
  const [msg, setMsg] = useState("");
  const [checking, setChecking] = useState(true);

  // ✅ Se já estiver logado E tiver perfil meritus_usuarios, manda pro /admin (ou next)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await getProfile();
        if (!mounted) return;
        if (res.ok) {
          const next = sp?.get("next") || "/admin";
          router.push(next);
          return;
        }
      } finally {
        if (!mounted) return;
        setChecking(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [router, sp]);

  async function entrar(e) {
    e.preventDefault();
    setMsg("");

    const clean = (email || "").trim().toLowerCase();
    if (!clean || !senha) {
      setStatus("error");
      setMsg("Informe e-mail e senha.");
      return;
    }

    setStatus("loading");

    const { error } = await supabase.auth.signInWithPassword({
      email: clean,
      password: senha,
    });

    if (error) {
      setStatus("error");
      setMsg(error.message || "Falha ao entrar.");
      return;
    }

    // Agora confirma perfil (evita loop se estiver sem meritus_usuarios/RLS)
    const prof = await getProfile();
    if (!prof.ok) {
      setStatus("error");
      setMsg(
        `Login OK, mas sem acesso no Meritus: ${prof.error}. ` +
          `Verifique se existe registro em meritus_usuarios e a policy RLS de SELECT self.`
      );
      return;
    }

    const next = sp?.get("next") || "/admin";
    router.push(next);
  }

  async function sair() {
    await supabase.auth.signOut();
    setMsg("Sessão encerrada.");
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-md px-4 py-14">
        <div className="mb-8 flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-black text-white flex items-center justify-center font-semibold">
            M
          </div>
          <div>
            <div className="text-lg font-semibold">Meritus</div>
            <div className="text-sm text-black/50">Acesso ao painel</div>
          </div>
        </div>

        <Card>
          <h1 className="text-xl font-semibold">Entrar</h1>
          <p className="mt-1 text-sm text-black/60">Use seu e-mail e senha.</p>

          {checking ? (
            <div className="mt-5 text-sm text-black/60">Carregando…</div>
          ) : (
            <form onSubmit={entrar} className="mt-5 space-y-3">
              <div>
                <label className="text-xs text-black/60">E-mail</label>
                <input
                  className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seuemail@dominio.com"
                  type="email"
                  autoComplete="email"
                />
              </div>

              <div>
                <label className="text-xs text-black/60">Senha</label>
                <input
                  className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="••••••••"
                  type="password"
                  autoComplete="current-password"
                />
              </div>

              <button
                type="submit"
                disabled={status === "loading"}
                className="w-full rounded-xl bg-black text-white px-4 py-2 text-sm border border-black hover:opacity-90 disabled:opacity-60"
              >
                {status === "loading" ? "Entrando…" : "Entrar"}
              </button>

              {msg ? <div className={`text-sm ${status === "error" ? "text-red-600" : "text-black/70"}`}>{msg}</div> : null}

              <button
                type="button"
                onClick={sair}
                className="w-full rounded-xl bg-white text-black px-4 py-2 text-sm border border-black/10 hover:bg-black/5"
              >
                Sair (se estiver logado)
              </button>

              <div className="pt-2 text-xs text-black/50">
                Admin: se você quer permitir criar conta aqui, eu adiciono um botão de “Criar conta” com
                <code>signUp</code>.
              </div>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
