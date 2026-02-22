"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-sm text-black/60">Carregando…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-black/5 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-sm border border-black/10 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-lg font-semibold">Meritus</div>
            <div className="text-xs text-black/50">
              {modo === "login" ? "Entrar" : "Solicitar acesso (aprovação do Admin)"}
            </div>
          </div>
          <button
            className="text-xs px-3 py-2 rounded-xl border border-black/10 hover:bg-black/5"
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

        {erro ? <div className="text-sm text-red-600">{erro}</div> : null}
        {ok ? <div className="text-sm text-emerald-700">{ok}</div> : null}

        <form onSubmit={modo === "login" ? entrar : solicitarAcesso} className="space-y-3">
          {modo === "signup" ? (
            <>
              <div>
                <label className="text-xs text-black/50">Nome</label>
                <input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-black/10 outline-none focus:ring-2 focus:ring-black/10"
                  placeholder="Seu nome"
                  autoComplete="name"
                />
              </div>

              <div>
                <label className="text-xs text-black/50">Código da Organização</label>
                <div className="mt-1 flex gap-2">
                  <input
                    value={orgCodigo}
                    onChange={(e) => {
                      setOrgCodigo(e.target.value);
                      limparOrg();
                    }}
                    className="flex-1 px-3 py-2 rounded-xl border border-black/10 outline-none focus:ring-2 focus:ring-black/10"
                    placeholder="ex.: amigosparaiso"
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    disabled={busy}
                    onClick={carregarOrg}
                    className="px-3 py-2 rounded-xl border border-black/10 hover:bg-black/5 disabled:opacity-60"
                  >
                    Carregar
                  </button>
                </div>
                {orgInfo?.nome ? (
                  <div className="mt-1 text-[11px] text-black/55">
                    Organização: <span className="font-semibold">{orgInfo.nome}</span>
                  </div>
                ) : (
                  <div className="mt-1 text-[11px] text-black/45">
                    Use um código legível cadastrado em <span className="font-mono">meritus_organizacoes.codigo</span>.
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs text-black/50">Programa</label>
                <select
                  value={programaId}
                  onChange={(e) => trocarPrograma(e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-black/10 outline-none focus:ring-2 focus:ring-black/10"
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
                <label className="text-xs text-black/50">Grupo</label>
                <select
                  value={grupoId}
                  onChange={(e) => setGrupoId(e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-black/10 outline-none focus:ring-2 focus:ring-black/10"
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
                <label className="text-xs text-black/50">Perfil</label>
                <select
                  value={perfil}
                  onChange={(e) => setPerfil(e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-black/10 outline-none focus:ring-2 focus:ring-black/10"
                  disabled={busy}
                >
                  {PERFIS_SOLICITACAO.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
                <div className="mt-1 text-[11px] text-black/45">Admin é criado somente pelo próprio Admin.</div>
              </div>
            </>
          ) : null}

          <div>
            <label className="text-xs text-black/50">E-mail</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-xl border border-black/10 outline-none focus:ring-2 focus:ring-black/10"
              placeholder="email@dominio.com"
              autoComplete="email"
            />
          </div>

          <div>
            <label className="text-xs text-black/50">Senha</label>
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-xl border border-black/10 outline-none focus:ring-2 focus:ring-black/10"
              placeholder="••••••••"
              autoComplete={modo === "login" ? "current-password" : "new-password"}
            />
          </div>

          <button
            disabled={busy}
            className="w-full px-4 py-2 rounded-2xl bg-black text-white font-medium hover:opacity-95 disabled:opacity-60"
          >
            {busy ? "Processando…" : modo === "login" ? "Entrar" : "Solicitar acesso"}
          </button>
        </form>

        <div className="text-[11px] text-black/45">
          {modo === "signup"
            ? "A solicitação fica pendente até o Admin aprovar. Após aprovação, você entra com e-mail e senha."
            : "Se você ainda não tem acesso, clique em “Solicitar acesso”."}
        </div>
      </div>
    </div>
  );
}
