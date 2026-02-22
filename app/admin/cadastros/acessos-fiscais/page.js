"use client";

import { useEffect, useMemo, useState } from "react";
import RequireRole from "@/components/admin/RequireRole";
import { supabase } from "@/src/lib/supabase";
import { PageTitle, Card, Button, Input, Select, Badge } from "@/components/admin/ui";

const PERFIL_FISCAL = "fiscal";

function cls(s) {
  return String(s || "").trim().toLowerCase();
}

export default function AdminAcessosFiscaisPage() {
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [ok, setOk] = useState(null);

  const [q, setQ] = useState("");
  const [fiscais, setFiscais] = useState([]);
  const [fiscalId, setFiscalId] = useState("");

  const fiscalAtual = useMemo(
    () => fiscais.find((f) => f.id === fiscalId) || null,
    [fiscais, fiscalId]
  );

  const [grupos, setGrupos] = useState([]);
  const [vinculos, setVinculos] = useState([]);
  const [saving, setSaving] = useState(false);

  const vincSet = useMemo(() => new Set(vinculos.map((v) => v.grupo_id)), [vinculos]);

  const gruposFiltrados = useMemo(() => {
    const qq = cls(q);
    if (!qq) return grupos;
    return grupos.filter((g) => cls(g.nome).includes(qq));
  }, [grupos, q]);

  async function carregarBase() {
    setLoading(true);
    setErro(null);
    setOk(null);

    // ✅ Fiscais via RPC (nome/email vem de auth.users)
    const { data: fisc, error: e1 } = await supabase.rpc("admin_list_fiscais");
    if (e1) {
      setErro(e1.message);
      setLoading(false);
      return;
    }

    setFiscais(fisc || []);
    const defaultFiscal = (fisc && fisc[0] && fisc[0].id) ? fisc[0].id : "";
    setFiscalId((prev) => prev || defaultFiscal);

    // Grupos
    const { data: gr, error: e2 } = await supabase
      .from("meritus_grupos")
      .select("id,nome,ativo")
      .eq("ativo", true)
      .order("nome", { ascending: true });

    if (e2) {
      setErro(e2.message);
      setLoading(false);
      return;
    }

    setGrupos(gr || []);
    setLoading(false);
  }

  async function carregarVinculos(idUsuario) {
    if (!idUsuario) {
      setVinculos([]);
      return;
    }

    const { data, error } = await supabase
      .from("meritus_usuario_grupos")
      .select("id,usuario_id,grupo_id")
      .eq("usuario_id", idUsuario);

    if (error) {
      setErro(error.message);
      return;
    }

    setVinculos(data || []);
  }

  useEffect(() => {
    carregarBase();
  }, []);

  useEffect(() => {
    carregarVinculos(fiscalId);
  }, [fiscalId]);

  async function toggleGrupo(grupoId) {
    if (!fiscalId || !grupoId) return;

    setErro(null);
    setOk(null);
    setSaving(true);

    const tem = vincSet.has(grupoId);

    if (tem) {
      const alvo = vinculos.find((v) => v.grupo_id === grupoId);
      const { error } = await supabase
        .from("meritus_usuario_grupos")
        .delete()
        .eq("id", alvo.id);

      if (error) {
        setErro(error.message);
        setSaving(false);
        return;
      }

      setOk("Vínculo removido.");
    } else {
      const { error } = await supabase
        .from("meritus_usuario_grupos")
        .insert([{ usuario_id: fiscalId, grupo_id: grupoId }]);

      if (error) {
        setErro(error.message);
        setSaving(false);
        return;
      }

      setOk("Vínculo adicionado.");
    }

    await carregarVinculos(fiscalId);
    setSaving(false);
  }

  return (
    <RequireRole allow={["admin"]}>
      <div className="space-y-4">
        <PageTitle
          title="Acessos do Fiscal"
          subtitle="Defina quais grupos cada Fiscal pode lançar."
        />

        <Card>
          <div className="flex flex-col md:flex-row gap-3 md:items-end md:justify-between">
            <div className="flex-1">
              <label className="text-xs text-white/55">Fiscal</label>
              <Select value={fiscalId} onChange={(e) => setFiscalId(e.target.value)}>
                {fiscais.map((f) => (
                  <option key={f.id} value={f.id}>
                    {(f.nome || f.email || "").trim() || f.id}
                  </option>
                ))}
              </Select>

              {fiscalAtual ? (
                <div className="mt-2 text-[11px] text-white/55">
                  <span className="font-mono">{fiscalAtual.id}</span>
                  {fiscalAtual.email ? <> • {fiscalAtual.email}</> : null}
                </div>
              ) : null}
            </div>

            <div className="flex-1">
              <label className="text-xs text-white/55">Filtrar grupos</label>
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ex.: COALA" />
            </div>

            <div>
              <Button onClick={carregarBase} disabled={loading || saving}>
                Atualizar
              </Button>
            </div>
          </div>

          {erro && <div className="mt-3 text-sm text-red-600">{erro}</div>}
          {ok && <div className="mt-3 text-sm text-emerald-700">{ok}</div>}
        </Card>

        <Card>
          {loading ? (
            <div className="text-sm text-white/60">Carregando…</div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-2">
              {gruposFiltrados.map((g) => {
                const checked = vincSet.has(g.id);
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => toggleGrupo(g.id)}
                    disabled={saving}
                    className={[
                      "text-left w-full rounded-2xl border px-4 py-3 transition",
                      checked
                        ? "bg-emerald-50 border-emerald-200"
                        : "bg-[var(--m-surface)] border-white/10 hover:bg-white/5",
                      saving ? "opacity-60" : "",
                    ].join(" ")}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium">{g.nome}</div>
                      {checked ? <Badge>Permitido</Badge> : <Badge variant="warn">Bloqueado</Badge>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </RequireRole>
  );
}
