"use client";

import { useEffect, useMemo, useState } from "react";
import RequireRole from "../../../../components/admin/RequireRole";
import { Card, PageTitle, Button, Input, Select } from "../../../../components/admin/ui";
import { supabase } from "@/src/lib/supabase";
import { getProfile } from "@/src/lib/profile";

const ALL_GRUPOS = "__ALL__";

export default function CadParticipantes() {
  const [orgId, setOrgId] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);

  const [grupos, setGrupos] = useState([]);
  const [grupoFiltro, setGrupoFiltro] = useState(ALL_GRUPOS);

  const [rows, setRows] = useState([]);

  const [novo, setNovo] = useState({ nome: "", grupo_id: "", ativo: true });

  const [editId, setEditId] = useState(null);
  const [edit, setEdit] = useState({ nome: "", grupo_id: "", ativo: true });

  useEffect(() => {
    (async () => {
      const res = await getProfile();
      if (res.ok) setOrgId(res.profile.organizacao_id);
    })();
  }, []);

  useEffect(() => {
    if (!orgId) return;
    carregarBase();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  useEffect(() => {
    if (!orgId) return;
    carregarLista();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grupoFiltro, orgId]);

  async function carregarBase() {
    setErro(null);
    setLoading(true);
    const { data, error } = await supabase
      .from("grupos")
      .select("id,nome,ativo,ordem")
      .eq("organizacao_id", orgId)
      .eq("ativo", true)
      .order("ordem", { ascending: true })
      .order("nome", { ascending: true })
      .limit(2000);
    if (error) setErro(error.message);
    setGrupos(data || []);
    setLoading(false);
  }

  async function carregarLista() {
    setErro(null);
    setLoading(true);

    let q = supabase
      .from("participantes")
      .select("id,nome,grupo_id,ativo,criado_em,organizacao_id")
      .eq("organizacao_id", orgId)
      .order("nome", { ascending: true })
      .limit(5000);

    if (grupoFiltro !== ALL_GRUPOS) q = q.eq("grupo_id", grupoFiltro);

    const { data, error } = await q;
    if (error) setErro(error.message);
    setRows(data || []);
    setLoading(false);
  }

  function startEdit(r) {
    setEditId(r.id);
    setEdit({ nome: r.nome || "", grupo_id: r.grupo_id || "", ativo: !!r.ativo });
  }
  function cancelEdit() {
    setEditId(null);
    setEdit({ nome: "", grupo_id: "", ativo: true });
  }

  async function criar() {
    if (!orgId) return;
    setErro(null);
    const nome = (novo.nome || "").trim();
    if (!nome) return setErro("Informe o nome.");
    if (!novo.grupo_id) return setErro("Selecione o grupo.");
    setLoading(true);

    const { error } = await supabase.from("participantes").insert({
      organizacao_id: orgId,
      nome,
      grupo_id: novo.grupo_id,
      ativo: true,
    });

    if (error) setErro(error.message);
    setNovo({ nome: "", grupo_id: "", ativo: true });
    await carregarLista();
    setLoading(false);
  }

  async function salvar() {
    if (!editId) return;
    setErro(null);
    const nome = (edit.nome || "").trim();
    if (!nome) return setErro("Informe o nome.");
    if (!edit.grupo_id) return setErro("Selecione o grupo.");

    setLoading(true);
    const { error } = await supabase
      .from("participantes")
      .update({ nome, grupo_id: edit.grupo_id, ativo: !!edit.ativo })
      .eq("id", editId);

    if (error) setErro(error.message);
    cancelEdit();
    await carregarLista();
    setLoading(false);
  }

  async function toggleAtivo(r) {
    setErro(null);
    setLoading(true);
    const { error } = await supabase.from("participantes").update({ ativo: !r.ativo }).eq("id", r.id);
    if (error) setErro(error.message);
    await carregarLista();
    setLoading(false);
  }

  const grupoNome = useMemo(() => Object.fromEntries(grupos.map((g) => [g.id, g.nome])), [grupos]);

  return (
    <RequireRole allow={["admin"]}>
      <div className="space-y-4">
        <PageTitle title="Cadastros • Participantes" subtitle="Participantes vinculados a um grupo (unidade)." />

        <Card className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="md:col-span-2">
              <div className="text-xs text-black/60 mb-1">Nome</div>
              <Input value={novo.nome} onChange={(e) => setNovo((s) => ({ ...s, nome: e.target.value }))} placeholder="Nome do participante" />
            </div>
            <div>
              <div className="text-xs text-black/60 mb-1">Grupo</div>
              <Select value={novo.grupo_id} onChange={(e) => setNovo((s) => ({ ...s, grupo_id: e.target.value }))}>
                <option value="">Selecione…</option>
                {grupos.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nome}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button onClick={criar} disabled={loading || !orgId}>Criar</Button>
            <Button variant="secondary" onClick={carregarLista} disabled={loading || !orgId}>Recarregar</Button>

            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-black/60">Filtro grupo</span>
              <Select value={grupoFiltro} onChange={(e) => setGrupoFiltro(e.target.value)} disabled={loading || !orgId}>
                <option value={ALL_GRUPOS}>Todos</option>
                {grupos.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nome}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {erro ? <div className="text-sm text-red-600">{erro}</div> : null}
        </Card>

        <Card className="p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-black/10 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">Lista</div>
              <div className="text-xs text-black/50">Ordenação por nome.</div>
            </div>
            <div className="text-xs text-black/50">{loading ? "Atualizando..." : `${rows.length} participantes`}</div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-black/5 text-black/60">
                  <th className="text-left px-5 py-3">Nome</th>
                  <th className="text-left px-5 py-3">Grupo</th>
                  <th className="text-left px-5 py-3">Status</th>
                  <th className="text-right px-5 py-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const editing = editId === r.id;
                  return (
                    <tr key={r.id} className="border-t border-black/5 hover:bg-black/[0.03]">
                      <td className="px-5 py-3 font-medium">
                        {editing ? <Input value={edit.nome} onChange={(e) => setEdit((s) => ({ ...s, nome: e.target.value }))} /> : r.nome}
                      </td>
                      <td className="px-5 py-3">
                        {editing ? (
                          <Select value={edit.grupo_id} onChange={(e) => setEdit((s) => ({ ...s, grupo_id: e.target.value }))}>
                            <option value="">Selecione…</option>
                            {grupos.map((g) => (
                              <option key={g.id} value={g.id}>
                                {g.nome}
                              </option>
                            ))}
                          </Select>
                        ) : (
                          <span className="text-black/60">{grupoNome[r.grupo_id] || "—"}</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center rounded-xl border px-3 py-1 text-xs font-semibold ${r.ativo ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
                          {r.ativo ? "ativo" : "inativo"}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        {editing ? (
                          <div className="flex justify-end gap-2 flex-wrap">
                            <Button onClick={salvar} disabled={loading}>Salvar</Button>
                            <Button variant="secondary" onClick={cancelEdit} disabled={loading}>Cancelar</Button>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-2 flex-wrap">
                            <Button variant="secondary" onClick={() => startEdit(r)} disabled={loading}>Editar</Button>
                            <Button variant="secondary" onClick={() => toggleAtivo(r)} disabled={loading}>{r.ativo ? "Desativar" : "Ativar"}</Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-10 text-center text-black/60">{loading ? "Carregando..." : "Nenhum participante cadastrado."}</td>
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
