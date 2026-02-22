"use client";

import { useEffect, useMemo, useState } from "react";
import RequireRole from "@/components/admin/RequireRole";
import { Card, PageTitle, Button, Input, Select } from "@/components/admin/ui";
import { supabase } from "@/src/lib/supabase";
import { useProgram } from "@/components/admin/ProgramContext";

// ---------- helpers ----------
function iso(d) {
  if (!d) return "";
  return String(d).slice(0, 10);
}
function safeStr(v) {
  return String(v ?? "").trim();
}

// ---------- page ----------
export default function AdminCadastrosPeriodos() {
  const program = (typeof useProgram === "function" ? useProgram() : {}) || {};
  const programaId = program.programaId ?? null;
  const programas = program.programas ?? [];

  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);

  const [periodos, setPeriodos] = useState([]);

  // criação
  const [novo, setNovo] = useState({
    rotulo: "",
    inicio: "",
    fim: "",
    status: "aberto",
  });

  // edição inline
  const [editId, setEditId] = useState(null);
  const [edit, setEdit] = useState({
    rotulo: "",
    inicio: "",
    fim: "",
    status: "fechado",
  });

  const programaNome = useMemo(() => {
    return (programas || []).find((p) => p.id === programaId)?.nome || "—";
  }, [programas, programaId]);

  useEffect(() => {
    if (!programaId) return;
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programaId]);

  async function carregar() {
    setErro(null);
    setLoading(true);

    const { data, error } = await supabase
      .from("meritus_periodos")
      .select("id, programa_id, rotulo, inicio, fim, status, criado_em")
      .eq("programa_id", programaId)
      .order("inicio", { ascending: false })
      .limit(500);

    if (error) {
      setErro(error.message);
      setPeriodos([]);
      setLoading(false);
      return;
    }

    setPeriodos(data || []);
    setLoading(false);
  }

  function iniciarEdicao(p) {
    setEditId(p.id);
    setEdit({
      rotulo: p.rotulo || "",
      inicio: iso(p.inicio),
      fim: iso(p.fim),
      status: p.status || "fechado",
    });
  }

  function cancelarEdicao() {
    setEditId(null);
    setEdit({ rotulo: "", inicio: "", fim: "", status: "fechado" });
  }

  async function criar() {
    if (!programaId) return setErro("Selecione um programa.");
    setErro(null);

    const rotulo = safeStr(novo.rotulo);
    if (!rotulo) return setErro("Informe o rótulo do período.");
    if (!novo.inicio || !novo.fim) return setErro("Informe início e fim.");

    setLoading(true);
    const payload = {
      programa_id: programaId,
      rotulo,
      inicio: novo.inicio,
      fim: novo.fim,
      status: novo.status || "aberto",
    };

    const { error } = await supabase.from("meritus_periodos").insert(payload);
    if (error) {
      setErro(error.message);
      setLoading(false);
      return;
    }

    setNovo({ rotulo: "", inicio: "", fim: "", status: "aberto" });
    await carregar();
    setLoading(false);
  }

  async function salvar() {
    if (!editId) return;
    setErro(null);

    const rotulo = safeStr(edit.rotulo);
    if (!rotulo) return setErro("Informe o rótulo do período.");
    if (!edit.inicio || !edit.fim) return setErro("Informe início e fim.");

    setLoading(true);
    const { error } = await supabase
      .from("meritus_periodos")
      .update({ rotulo, inicio: edit.inicio, fim: edit.fim })
      .eq("id", editId);

    if (error) {
      setErro(error.message);
      setLoading(false);
      return;
    }

    cancelarEdicao();
    await carregar();
    setLoading(false);
  }

  async function mudarStatus(id, status) {
    setErro(null);
    setLoading(true);

    const { error } = await supabase.from("meritus_periodos").update({ status }).eq("id", id);
    if (error) {
      setErro(error.message);
      setLoading(false);
      return;
    }

    await carregar();
    setLoading(false);
  }

  async function excluir(id) {
    const ok = confirm("Excluir este período? Esta ação é irreversível.");
    if (!ok) return;

    setErro(null);
    setLoading(true);
    const { error } = await supabase.from("meritus_periodos").delete().eq("id", id);

    if (error) {
      setErro(error.message);
      setLoading(false);
      return;
    }

    await carregar();
    setLoading(false);
  }

  return (
    <RequireRole allow={["admin"]}>
      <div className="space-y-4">
        <PageTitle
          title="Períodos"
          subtitle="Abra/feche semanas e edite datas. (Somente Admin)"
          right={
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={carregar} disabled={loading || !programaId}>
                Recarregar
              </Button>
            </div>
          }
        />

        <Card className="space-y-3">
          <div className="text-sm text-white/70">
            Programa selecionado: <b>{programaNome}</b>
          </div>

          {!programaId ? (
            <div className="text-sm text-amber-200">
              Selecione um programa no topo para visualizar/criar períodos.
            </div>
          ) : null}

          <div className="grid gap-3 md:grid-cols-4">
            <div className="md:col-span-2">
              <div className="text-xs text-white/60 mb-1">Rótulo</div>
              <Input
                value={novo.rotulo}
                onChange={(e) => setNovo((s) => ({ ...s, rotulo: e.target.value }))}
                placeholder="Ex: 2026-02 (Sem 7) • 09/02 a 15/02"
                disabled={!programaId || loading}
              />
            </div>

            <div>
              <div className="text-xs text-white/60 mb-1">Início</div>
              <Input
                type="date"
                value={novo.inicio}
                onChange={(e) => setNovo((s) => ({ ...s, inicio: e.target.value }))}
                disabled={!programaId || loading}
              />
            </div>

            <div>
              <div className="text-xs text-white/60 mb-1">Fim</div>
              <Input
                type="date"
                value={novo.fim}
                onChange={(e) => setNovo((s) => ({ ...s, fim: e.target.value }))}
                disabled={!programaId || loading}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/60">Status</span>
              <Select
                value={novo.status}
                onChange={(e) => setNovo((s) => ({ ...s, status: e.target.value }))}
                disabled={!programaId || loading}
              >
                <option value="aberto">aberto</option>
                <option value="fechado">fechado</option>
              </Select>
            </div>

            <Button onClick={criar} disabled={!programaId || loading}>
              Criar período
            </Button>
          </div>

          {erro ? <div className="text-sm text-red-500">{erro}</div> : null}
        </Card>

        <Card className="p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">Lista</div>
              <div className="text-xs text-white/55">Status “aberto” permite lançamentos para Fiscal.</div>
            </div>
            <div className="text-xs text-white/55">{loading ? "Atualizando..." : `${periodos.length} períodos`}</div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white/[0.03] text-white/60">
                  <th className="text-left px-5 py-3">Rótulo</th>
                  <th className="text-left px-5 py-3">Início</th>
                  <th className="text-left px-5 py-3">Fim</th>
                  <th className="text-left px-5 py-3">Status</th>
                  <th className="text-right px-5 py-3">Ações</th>
                </tr>
              </thead>

              <tbody>
                {periodos.map((p) => {
                  const editing = editId === p.id;

                  return (
                    <tr key={p.id} className="border-t border-white/10 hover:bg-white/[0.03]">
                      <td className="px-5 py-3">
                        {editing ? (
                          <Input
                            value={edit.rotulo}
                            onChange={(e) => setEdit((s) => ({ ...s, rotulo: e.target.value }))}
                          />
                        ) : (
                          <div className="font-semibold">{p.rotulo}</div>
                        )}
                      </td>

                      <td className="px-5 py-3">
                        {editing ? (
                          <Input
                            type="date"
                            value={edit.inicio}
                            onChange={(e) => setEdit((s) => ({ ...s, inicio: e.target.value }))}
                          />
                        ) : (
                          <span className="text-white/70">{iso(p.inicio)}</span>
                        )}
                      </td>

                      <td className="px-5 py-3">
                        {editing ? (
                          <Input
                            type="date"
                            value={edit.fim}
                            onChange={(e) => setEdit((s) => ({ ...s, fim: e.target.value }))}
                          />
                        ) : (
                          <span className="text-white/70">{iso(p.fim)}</span>
                        )}
                      </td>

                      <td className="px-5 py-3">
                        <span
                          className={`inline-flex items-center rounded-xl border px-3 py-1 text-xs font-semibold ${
                            p.status === "aberto"
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                              : "border-amber-500/30 bg-amber-500/10 text-amber-200"
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>

                      <td className="px-5 py-3 text-right">
                        {editing ? (
                          <div className="flex justify-end gap-2 flex-wrap">
                            <Button onClick={salvar} disabled={loading}>
                              Salvar
                            </Button>
                            <Button variant="secondary" onClick={cancelarEdicao} disabled={loading}>
                              Cancelar
                            </Button>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-2 flex-wrap">
                            <Button variant="secondary" onClick={() => iniciarEdicao(p)} disabled={loading}>
                              Editar
                            </Button>

                            {p.status === "aberto" ? (
                              <Button
                                variant="secondary"
                                onClick={() => mudarStatus(p.id, "fechado")}
                                disabled={loading}
                              >
                                Fechar
                              </Button>
                            ) : (
                              <Button onClick={() => mudarStatus(p.id, "aberto")} disabled={loading}>
                                Abrir
                              </Button>
                            )}

                            <Button variant="secondary" onClick={() => excluir(p.id)} disabled={loading}>
                              Excluir
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {periodos.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-white/60">
                      {loading ? "Carregando..." : "Nenhum período cadastrado para este programa."}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </RequireRole>
  );
}
