"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { supabase } from "@/src/lib/supabase";

const PERFIS_SOLICITACAO = [
  { value: "fiscal", label: "Fiscal" },
  { value: "relatorio", label: "Relatório" },
];

export default function LoginClient() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = useMemo(() => sp.get("next") || "/admin", [sp]);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [modo, setModo] = useState("login"); // login | signup

  // login
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");

  // signup / solicitação
  const [nome, setNome] = useState("");
  const [orgCodigo, setOrgCodigo] = useState("");
  const [orgInfo, setOrgInfo] = useState(null); // {id,nome,codigo}
  const [programas, setProgramas] = useState([]);
  const [programaId, setProgramaId] = useState("");
  const [grupos, setGrupos] = useState([]);
  const [grupoId, setGrupoId] = useState("");
  const [perfil, setPerfil] = useState("fiscal");

  const [erro, setErro] = useState(null);
  const [ok, setOk] = useState(null);

  // ✅ Evita loop: só redireciona se existir sessão E o usuário estiver aprovado
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setErro(null);
        setOk(null);

        const { data } = await supabase.auth.getSession();
        const user = data?.session?.user;

        if (!alive) return;

        if (!user) {
          setLoading(false);
          return;
        }

        const { data: urow, error: uerr } = await supabase
          .from("meritus_usuarios")
          .select("ativo")
          .eq("id", user.id)
          .maybeSingle();

        if (!alive) return;

        if (uerr || !urow?.ativo) {
          await supabase.auth.signOut().catch(() => {});
          setErro("Cadastro pendente de aprovação do Admin.");
          setLoading(false);
          return;
        }

        router.replace(next);
      } catch {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [router, next]);

  function limparOrg() {
    setOrgInfo(null);
    setProgramas([]);
    setProgramaId("");
    setGrupos([]);
    setGrupoId("");
  }

  // ✅ Agora SEM RPC: usa tabelas meritus_* diretamente (evita mismatch de IDs)
  async function carregarOrg() {
    setErro(null);
    setOk(null);

    const code = String(orgCodigo || "").trim().toLowerCase();
    if (!code) return setErro("Informe o código da organização.");

    setBusy(true);
    limparOrg();

    const { data: org, error: eOrg } = await supabase
      .from("meritus_organizacoes")
      .select("id, nome, codigo, ativo")
      .eq("codigo", code)
      .eq("ativo", true)
      .limit(1)
      .maybeSingle();

    if (eOrg || !org?.id) {
      setBusy(false);
      return setErro("Código de organização inválido ou inativo.");
    }

    setOrgInfo({ id: org.id, nome: org.nome, codigo: org.codigo });

    const { data: progs, error: eP } = await supabase
      .from("meritus_programas")
      .select("id, nome, ativo")
      .eq("organizacao_id", org.id)
      .eq("ativo", true)
      .order("nome", { ascending: true });

    if (eP) {
      setBusy(false);
      return setErro(eP.message);
    }

    const arr = (progs || []).map((p) => ({ id: p.id, nome: p.nome }));
    setProgramas(arr);

    const first = arr[0]?.id || "";
    setProgramaId(first);

    if (first) {
      const { data: gs, error: eG } = await supabase
        .from("meritus_grupos")
        .select("id, nome, ativo")
        .eq("programa_id", first)
        .eq("ativo", true)
        .order("nome", { ascending: true });

      if (eG) {
        setBusy(false);
        return setErro(eG.message);
      }

      const garr = (gs || []).map((g) => ({ id: g.id, nome: g.nome }));
      setGrupos(garr);
      setGrupoId(garr[0]?.id || "");
    }

    setBusy(false);
  }

  async function trocarPrograma(pid) {
    setProgramaId(pid);
    setGrupoId("");
    setGrupos([]);
    if (!pid) return;

    setErro(null);
    setBusy(true);

    const { data: gs, error: eG } = await supabase
      .from("meritus_grupos")
      .select("id, nome, ativo")
      .eq("programa_id", pid)
      .eq("ativo", true)
      .order("nome", { ascending: true });

    if (eG) {
      setBusy(false);
      return setErro(eG.message);
    }

    const garr = (gs || []).map((g) => ({ id: g.id, nome: g.nome }));
    setGrupos(garr);
    setGrupoId(garr[0]?.id || "");
    setBusy(false);
  }

  async function entrar(e) {
    e?.preventDefault?.();
    setErro(null);
    setOk(null);

    const em = String(email || "").trim().toLowerCase();
    const pw = String(senha || "").trim();
    if (!em || !pw) return setErro("Informe e-mail e senha.");

    setBusy(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email: em, password: pw });
    if (error) {
      setBusy(false);
      return setErro(error.message);
    }

    const uid = data?.session?.user?.id;
    if (uid) {
      const { data: urow, error: uerr } = await supabase
        .from("meritus_usuarios")
        .select("ativo")
        .eq("id", uid)
        .maybeSingle();
      if (uerr || !urow?.ativo) {
        await supabase.auth.signOut();
        setBusy(false);
        return setErro("Cadastro pendente de aprovação do Admin.");
      }
    }

    setOk("Login realizado.");
    setBusy(false);
    router.replace(next);
  }

  async function registrarSolicitacaoServer(userId) {
    const res = await fetch("/api/meritus/request-access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: userId,
        organizacao_id: orgInfo?.id, // ✅ robusto
        programa_id: programaId,
        perfil,
        grupo_id: grupoId,
      }),
    });

    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(payload?.error || "Falha ao registrar solicitação.");
    return payload;
  }

  async function solicitarAcesso(e) {
    e?.preventDefault?.();
    setErro(null);
    setOk(null);

    const nm = String(nome || "").trim();
    const em = String(email || "").trim().toLowerCase();
    const pw = String(senha || "").trim();

    if (!nm) return setErro("Informe seu nome.");
    if (!orgInfo?.id) return setErro("Clique em “Carregar” para validar a organização.");
    if (!programaId) return setErro("Selecione o programa.");
    if (!grupoId) return setErro("Selecione o grupo.");
    if (!perfil) return setErro("Selecione o perfil.");
    if (!em || !pw) return setErro("Informe e-mail e senha.");

    setBusy(true);

    const { data: sign, error: eSign } = await supabase.auth.signUp({
      email: em,
      password: pw,
      options: { data: { nome: nm } },
    });

    if (eSign) {
      setBusy(false);
      return setErro(eSign.message || "Falha ao criar conta.");
    }

    const userId = sign?.user?.id;
    if (!userId) {
      setBusy(false);
      return setErro("Conta criada, mas UID ausente.");
    }

    try {
      await registrarSolicitacaoServer(userId);
    } catch (err) {
      setBusy(false);
      return setErro(err?.message || "Falha ao registrar solicitação.");
    }

    await supabase.auth.signOut().catch(() => {});
    setOk("Conta criada e solicitação enviada. Aguarde aprovação do Admin para acessar.");
    setBusy(false);
    setModo("login");
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--m-bg)]">
        <div className="text-sm text-white/65">Carregando…</div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--m-bg)] flex items-center justify-center p-4 bg-[radial-gradient(ellipse_at_top,rgba(212,175,55,.16),transparent_55%),radial-gradient(ellipse_at_bottom,rgba(255,255,255,.06),transparent_60%)]">
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(212,175,55,.10),transparent_60%)]" />
        <img src="/brand/meritus-mark.png" alt="Meritus" className="w-[780px] max-w-[92vw] opacity-[0.055] blur-[1px]" />
      </div>

      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-5">
          <Image src="/brand/meritus-mark.png" alt="Meritus" width={120} height={120} className="drop-shadow-[0_0_30px_rgba(212,175,55,0.35)]" />
          <div className="mt-3 text-center">
            <div className="text-2xl font-semibold tracking-[0.32em] text-white">MERITUS</div>
            <div className="text-sm text-white/60 mt-1">Excelência Conquistada</div>
          </div>
        </div>

        <div className="bg-[var(--m-surface)] rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,.55)] border border-white/10 p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Image src="/brand/meritus-mark.png" alt="Meritus" width={44} height={44} className="rounded-xl" />
            <div>
              <div className="text-lg font-semibold tracking-tight text-white">Meritus</div>
              <div className="text-xs text-white/55">
                {modo === "login" ? "Entrar" : "Solicitar acesso (aprovação do Admin)"}
              </div>
            </div>
          </div>
          <button
            className="text-xs px-3 py-2 rounded-xl border border-white/10 bg-[var(--m-surface-2)] text-white hover:bg-[var(--m-surface)]/5"
            onClick={() => {
              setErro(null);
              setOk(null);
              setModo(modo === "login" ? "signup" : "login");
            }}
            type="button"
          >
            {modo === "login" ? "Solicitar acesso" : "Já tenho conta"}
          </button>
        </div>

        {erro ? <div className="text-sm text-[var(--m-danger)]">{erro}</div> : null}
        {ok ? <div className="text-sm text-[var(--m-gold)]">{ok}</div> : null}

        <form onSubmit={modo === "login" ? entrar : solicitarAcesso} className="space-y-3">
          {modo === "signup" ? (
            <>
              <div>
                <label className="text-xs text-white/55">Nome</label>
                <input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-white/10 bg-[var(--m-surface-2)] text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-[rgba(212,175,55,.35)] focus:border-[color:var(--m-gold)]"
                  placeholder="Seu nome"
                  autoComplete="name"
                />
              </div>

              <div>
                <label className="text-xs text-white/55">Código da Organização</label>
                <div className="mt-1 flex gap-2">
                  <input
                    value={orgCodigo}
                    onChange={(e) => {
                      setOrgCodigo(e.target.value);
                      limparOrg();
                    }}
                    className="flex-1 px-3 py-2 rounded-xl border border-white/10 bg-[var(--m-surface-2)] text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-[rgba(212,175,55,.35)] focus:border-[color:var(--m-gold)]"
                    placeholder="ex.: amigosparaiso"
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    disabled={busy}
                    onClick={carregarOrg}
                    className="px-3 py-2 rounded-xl border border-white/10 bg-[var(--m-surface-2)] text-white hover:bg-white/5 disabled:opacity-60"
                  >
                    Carregar
                  </button>
                </div>
                {orgInfo?.nome ? (
                  <div className="mt-1 text-[11px] text-white/55">
                    Organização: <span className="font-semibold">{orgInfo.nome}</span>
                  </div>
                ) : (
                  <div className="mt-1 text-[11px] text-white/45">
                    Use um código legível cadastrado em <span className="font-mono">meritus_organizacoes.codigo</span>.
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs text-white/55">Programa</label>
                <select
                  value={programaId}
                  onChange={(e) => trocarPrograma(e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-white/10 bg-[var(--m-surface-2)] text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-[rgba(212,175,55,.35)] focus:border-[color:var(--m-gold)]"
                  disabled={!orgInfo?.id || busy}
                >
                  <option value="">Selecione…</option>
                  {programas.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-white/55">Grupo</label>
                <select
                  value={grupoId}
                  onChange={(e) => setGrupoId(e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-white/10 bg-[var(--m-surface-2)] text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-[rgba(212,175,55,.35)] focus:border-[color:var(--m-gold)]"
                  disabled={!programaId || busy}
                >
                  <option value="">Selecione…</option>
                  {grupos.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-white/55">Perfil</label>
                <select
                  value={perfil}
                  onChange={(e) => setPerfil(e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-white/10 bg-[var(--m-surface-2)] text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-[rgba(212,175,55,.35)] focus:border-[color:var(--m-gold)]"
                  disabled={busy}
                >
                  {PERFIS_SOLICITACAO.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
                <div className="mt-1 text-[11px] text-white/45">Admin é criado somente pelo próprio Admin.</div>
              </div>
            </>
          ) : null}

          <div>
            <label className="text-xs text-white/55">E-mail</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-xl border border-white/10 bg-[var(--m-surface-2)] text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-[rgba(212,175,55,.35)] focus:border-[color:var(--m-gold)]"
              placeholder="email@dominio.com"
              autoComplete="email"
            />
          </div>

          <div>
            <label className="text-xs text-white/55">Senha</label>
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-xl border border-white/10 bg-[var(--m-surface-2)] text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-[rgba(212,175,55,.35)] focus:border-[color:var(--m-gold)]"
              placeholder="••••••••"
              autoComplete={modo === "login" ? "current-password" : "new-password"}
            />
          </div>

          <button
            disabled={busy}
            className="w-full px-4 py-2 rounded-2xl bg-[var(--m-gold)] text-black font-semibold hover:bg-[var(--m-gold-2)] disabled:opacity-60"
          >
            {busy ? "Processando…" : modo === "login" ? "Entrar" : "Solicitar acesso"}
          </button>
        </form>

        <div className="text-[11px] text-white/45">
          {modo === "signup"
            ? "A solicitação fica pendente até o Admin aprovar. Após aprovação, você entra com e-mail e senha."
            : "Se você ainda não tem acesso, clique em “Solicitar acesso”."}
        </div>
      </div>
      </div>
    </div>
  );
}
