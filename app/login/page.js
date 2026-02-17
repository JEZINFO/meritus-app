"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../src/lib/supabaseClient";

function Card({ children }) {
  return <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">{children}</div>;
}

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle"); // idle | sending | sent | error
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data?.session) router.push("/admin");
    })();
  }, [router]);

  async function enviarLink(e) {
    e.preventDefault();
    setMsg("");
    const clean = (email || "").trim().toLowerCase();
    if (!clean) {
      setStatus("error");
      setMsg("Informe seu e-mail.");
      return;
    }

    setStatus("sending");
    const redirectTo = (typeof window !== "undefined" ? window.location.origin : "") + "/auth/callback";

    const { error } = await supabase.auth.signInWithOtp({
      email: clean,
      options: { emailRedirectTo: redirectTo },
    });

    if (error) {
      setStatus("error");
      setMsg(error.message);
      return;
    }

    setStatus("sent");
    setMsg("Link enviado! Verifique seu e-mail para entrar.");
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-md px-4 py-14">
        <div className="mb-8 flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-black text-white flex items-center justify-center font-semibold">M</div>
          <div>
            <div className="text-lg font-semibold">Meritus</div>
            <div className="text-sm text-black/50">Acesso ao painel</div>
          </div>
        </div>

        <Card>
          <h1 className="text-xl font-semibold">Entrar</h1>
          <p className="mt-1 text-sm text-black/60">Use seu e-mail para receber um link mágico.</p>

          <form onSubmit={enviarLink} className="mt-5 space-y-3">
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

            <button
              type="submit"
              disabled={status === "sending"}
              className="w-full rounded-xl bg-black text-white px-4 py-2 text-sm border border-black hover:opacity-90 disabled:opacity-60"
            >
              {status === "sending" ? "Enviando..." : "Enviar link"}
            </button>

            {msg ? <div className={`text-sm ${status === "error" ? "text-red-600" : "text-black/70"}`}>{msg}</div> : null}
          </form>

          <div className="mt-6 text-xs text-black/50">
            Se der erro de acesso, confirme que seu usuário existe na tabela <b>public.usuarios</b> e está ativo.
          </div>
        </Card>
      </div>
    </div>
  );
}
