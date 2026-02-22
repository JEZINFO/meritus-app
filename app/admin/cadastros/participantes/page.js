"use client";

import { useEffect, useMemo, useState } from "react";
import RequireRole from "../../../../components/admin/RequireRole";
import { Card, PageTitle, Button, Input, Select } from "../../../../components/admin/ui";
import { supabase } from "@/src/lib/supabase";
import { getProfile } from "@/src/lib/profile";

export default function CadParticipantes() {
  const [orgId, setOrgId] = useState("");
  const [programas, setProgramas] = useState([]);
  const [programaId, setProgramaId] = useState("");

  const [grupos, setGrupos] = useState([]);
  const [grupoId, setGrupoId] = useState("__ALL__");

  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);
  const [ok, setOk] = useState(null);
  const [rows, setRows] = useState([]);

  const [novo, setNovo] = useState({ nome: "", ativo: true });
  const [editId, setEditId] = useState(null);
  const [edit, setEdit] = useState({ nome: "", ativo: true, grupo_id: "" });

  const programaAtual = useMemo(() => programas.find((p) => p.id === programaId) || null, [programas, programaId]);

  useEffect(() => {
    (async () => {
      const res = await getProfile();
      if (res.ok) setOrgId(res.profile.organizacao_id);
    })();
  }, []);

  useEffect(() => {
    if (!orgId) return;
    carregarProgramas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  useEffect(() => {
    if (!programaId) return;
    carregarGrupos();
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programaId]);

  useEffect(() => {
    if (!programaId) return;
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grupoId]);

  async function carregarProgramas() {
    setErro(null);
    setOk(null);
    setLoading(true);

    const { data, error } = await supabase
      .from("meritus_programas")
      .select("id,nome,ativo")
      .eq("organizacao_id", orgId)
      .eq("ativo", true)
      .order("nome", { ascending: true })
      .limit(500);

    if (error) {
      setErro(error.message);
      setProgramas([]);
      setProgramaId("");
      setLoading(false);
      return;
    }

    setProgramas(data || []);
    setProgramaId((prev) => prev || (data?.[0]?.id || ""));
    setLoading(false);
  }

  async function carregarGrupos() {
    setErro(null);
    setOk(null);

    const { data, error } = await supabase
      .from("meritus_grupos")
      .select("id,nome,ativo")
      .eq("programa_id", programaId)
      .eq("ativo", true)
      .order("nome", { ascending: true })
      .limit(2000);

    if (error) {
      setErro(error.message);
      setGrupos([]);
      setGrupoId("__ALL__");
      return;
    }
    setGrupos(data || []);
    setGrupoId("__ALL__");
  }

  async function carregar() {
    setErro(null);
    setOk(null);
    setLoading(true);

    let q = supabase
      .from("meritus_participantes")
      .select("id,nome,ativo,criado_em,grupo_id,programa_id")
      .eq("programa_id", programaId)
      .order("nome", { ascending: true })
      .limit(5000);

    if (grupoId && grupoId !== "__ALL__") q = q.eq("grupo_id", grupoId);

    const { data, error } = await q;
    if (error) setErro(error.message);
    setRows(data || []);
    setLoading(false);
  }

  async function criar() {
    setErro(null);
    setOk(null);

    const nome = String(novo.nome || "").trim();
    if (!programaId) return setErro("Selecione um programa.");
    const gId = (grupoId && grupoId !== "__ALL__") ? grupoId : (grupos[0]?.id || "");
    if (!gId) return setErro("Cadastre um grupo antes.");
    if (!nome) return setErro("Informe o nome do participante.");

    setLoading(true);
    const { error } = await supabase
      .from("meritus_participantes")
      .insert([{ programa_id: programaId, grupo_id: gId, nome, ativo: !!novo.ativo }]);

    if (error) setErro(error.message);
    else {
      setOk("Participante criado.");
      setNovo({ nome: "", ativo: true });
      await carregar();
    }
    setLoading(false);
  }

  function startEdit(r) {
    setEditId(r.id);
    setEdit({ nome: r.nome || "", ativo: !!r.ativo, grupo_id: r.grupo_id || "" });
  }
  function cancelEdit() {
    setEditId(null);
    setEdit({ nome: "", ativo: true, grupo_id: "" });
  }

  async function salvarEdit() {
    setErro(null);
    setOk(null);

    const nome = String(edit.nome || "").trim();
    if (!nome) return setErro("Informe o nome.");
    if (!edit.grupo_id) return setErro("Selecione o grupo.");

    setLoading(true);
    const { error } = await supabase
      .from("meritus_participantes")
      .update({ nome, ativo: !!edit.ativo, grupo_id: edit.grupo_id })
      .eq("id", editId);

    if (error) setErro(error.message);
    else {
      setOk("Participante atualizado.");
      cancelEdit();
      await carregar();
    }
    setLoading(false);
  }

  return (
    <RequireRole allow={["admin"]}>
      <div className="space-y-4">
        <PageTitle title="Participantes" subtitle="Cadastro de participantes por Programa e Grupo (Meritus)." />

        <Card>
          <div className="grid md:grid-cols-3 gap-3 items-end">
            <div>
              <label className="text-xs text-black/50">Programa</label>
              <Select value={programaId} onChange={(e) => setProgramaId(e.target.value)}>
                {programas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </Select>
              {!programaAtual ? <div className="mt-1 text-[11px] text-black/45">Cadastre um programa primeiro.</div> : null}
            </div>

            <div>
              <label className="text-xs text-black/50">Grupo (filtro)</label>
              <Select value={grupoId} onChange={(e) => setGrupoId(e.target.value)}>
                <option value="__ALL__">Todos</option>
                {grupos.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
              </Select>
            </div>

            <div>
              <label className="text-xs text-black/50">Novo participante</label>
              <Input value={novo.nome} onChange={(e) => setNovo((s) => ({ ...s, nome: e.target.value }))} placeholder="Nome" />
              <div className="mt-2 flex items-center gap-3">
                <label className="text-sm text-black/70 flex items-center gap-2">
                  <input type="checkbox" checked={!!novo.ativo} onChange={(e) => setNovo((s) => ({ ...s, ativo: e.target.checked }))} />
                  Ativo
                </label>
                <Button onClick={criar} disabled={loading || !programaId}>Criar</Button>
                <Button variant="ghost" onClick={carregar} disabled={loading || !programaId}>Atualizar</Button>
              </div>
            </div>
          </div>

          {erro ? <div className="mt-3 text-sm text-red-600">{erro}</div> : null}
          {ok ? <div className="mt-3 text-sm text-emerald-700">{ok}</div> : null}
        </Card>

        {editId ? (
          <Card>
            <div className="flex items-center justify-between gap-2">
              <div className="font-semibold">Editar participante</div>
              <Button variant="ghost" onClick={cancelEdit}>Fechar</Button>
            </div>

            <div className="mt-3 grid md:grid-cols-3 gap-3 items-end">
              <div className="md:col-span-2">
                <label className="text-xs text-black/50">Nome</label>
                <Input value={edit.nome} onChange={(e) => setEdit((s) => ({ ...s, nome: e.target.value }))} />
              </div>

              <div>
                <label className="text-xs text-black/50">Grupo</label>
                <Select value={edit.grupo_id} onChange={(e) => setEdit((s) => ({ ...s, grupo_id: e.target.value }))}>
                  <option value="">Selecione</option>
                  {grupos.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
                </Select>
              </div>

              <div className="flex items-center gap-3">
                <label className="text-sm text-black/70 flex items-center gap-2">
                  <input type="checkbox" checked={!!edit.ativo} onChange={(e) => setEdit((s) => ({ ...s, ativo: e.target.checked }))} />
                  Ativo
                </label>
                <Button onClick={salvarEdit} disabled={loading}>Salvar</Button>
              </div>
            </div>
          </Card>
        ) : null}

        <Card>
          {loading ? (
            <div className="text-sm text-black/60">Carregando…</div>
          ) : !programaId ? (
            <div className="text-sm text-black/60">Selecione um programa.</div>
          ) : rows.length === 0 ? (
            <div className="text-sm text-black/60">Nenhum participante.</div>
          ) : (
            <div className="overflow-auto">
              <table className="min-w-[820px] w-full text-sm">
                <thead>
                  <tr className="text-left text-black/50 border-b">
                    <th className="py-2 pr-3">Nome</th>
                    <th className="py-2 pr-3">Ativo</th>
                    <th className="py-2 pr-3">Criado</th>
                    <th className="py-2 pr-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b last:border-b-0">
                      <td className="py-2 pr-3 font-medium">{r.nome}</td>
                      <td className="py-2 pr-3">{r.ativo ? "Sim" : "Não"}</td>
                      <td className="py-2 pr-3">{r.criado_em ? new Date(r.criado_em).toLocaleString("pt-BR") : ""}</td>
                      <td className="py-2 pr-3 text-right">
                        <Button variant="ghost" onClick={() => startEdit(r)}>Editar</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </RequireRole>
  );
}
