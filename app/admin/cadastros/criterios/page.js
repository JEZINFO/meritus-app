"use client";

import { useEffect, useMemo, useState } from "react";
import RequireRole from "../../../../components/admin/RequireRole";
import { Card, PageTitle, Button, Input, Select } from "../../../../components/admin/ui";
import { supabase } from "@/src/lib/supabase";
import { getProfile } from "@/src/lib/profile";

const TIPOS = [
  { value: "boolean", label: "Booleano (sim/não)" },
  { value: "nota", label: "Nota" },
  { value: "quantidade", label: "Quantidade" },
];

export default function CadCriterios() {
  const [orgId, setOrgId] = useState("");
  const [programas, setProgramas] = useState([]);
  const [programaId, setProgramaId] = useState("");

  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);
  const [ok, setOk] = useState(null);
  const [rows, setRows] = useState([]);

  const [novo, setNovo] = useState({ nome: "", tipo: "boolean", pontos_base: 1, peso_padrao: 1, ordem: 1000, ativo: true });
  const [editId, setEditId] = useState(null);
  const [edit, setEdit] = useState({ nome: "", tipo: "boolean", pontos_base: 1, peso_padrao: 1, ordem: 1000, ativo: true });

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
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programaId]);

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

  async function carregar() {
    setErro(null);
    setOk(null);
    setLoading(true);

    const { data, error } = await supabase
      .from("meritus_criterios")
      .select("id,nome,tipo,peso_padrao,pontos_base,ativo,ordem,criado_em,programa_id")
      .eq("programa_id", programaId)
      .order("ordem", { ascending: true })
      .order("nome", { ascending: true })
      .limit(5000);

    if (error) setErro(error.message);
    setRows(data || []);
    setLoading(false);
  }

  async function criar() {
    setErro(null);
    setOk(null);

    const nome = String(novo.nome || "").trim();
    if (!programaId) return setErro("Selecione um programa.");
    if (!nome) return setErro("Informe o nome do critério.");

    const payload = {
      programa_id: programaId,
      nome,
      tipo: novo.tipo,
      pontos_base: Number(novo.pontos_base || 0),
      peso_padrao: Number(novo.peso_padrao || 0),
      ordem: Number(novo.ordem || 0),
      ativo: !!novo.ativo,
    };

    setLoading(true);
    const { error } = await supabase.from("meritus_criterios").insert([payload]);
    if (error) setErro(error.message);
    else {
      setOk("Critério criado.");
      setNovo({ nome: "", tipo: "boolean", pontos_base: 1, peso_padrao: 1, ordem: 1000, ativo: true });
      await carregar();
    }
    setLoading(false);
  }

  function startEdit(r) {
    setEditId(r.id);
    setEdit({
      nome: r.nome || "",
      tipo: r.tipo || "boolean",
      pontos_base: Number(r.pontos_base || 0),
      peso_padrao: Number(r.peso_padrao || 0),
      ordem: Number(r.ordem || 0),
      ativo: !!r.ativo,
    });
  }
  function cancelEdit() {
    setEditId(null);
    setEdit({ nome: "", tipo: "boolean", pontos_base: 1, peso_padrao: 1, ordem: 1000, ativo: true });
  }

  async function salvarEdit() {
    setErro(null);
    setOk(null);

    const nome = String(edit.nome || "").trim();
    if (!nome) return setErro("Informe o nome.");

    setLoading(true);
    const { error } = await supabase
      .from("meritus_criterios")
      .update({
        nome,
        tipo: edit.tipo,
        pontos_base: Number(edit.pontos_base || 0),
        peso_padrao: Number(edit.peso_padrao || 0),
        ordem: Number(edit.ordem || 0),
        ativo: !!edit.ativo,
      })
      .eq("id", editId);

    if (error) setErro(error.message);
    else {
      setOk("Critério atualizado.");
      cancelEdit();
      await carregar();
    }
    setLoading(false);
  }

  return (
    <RequireRole allow={["admin"]}>
      <div className="space-y-4">
        <PageTitle title="Critérios" subtitle="Cadastro de critérios por Programa (Meritus)." />

        <Card>
          <div className="grid md:grid-cols-3 gap-3 items-end">
            <div>
              <label className="text-xs text-white/55">Programa</label>
              <Select value={programaId} onChange={(e) => setProgramaId(e.target.value)}>
                {programas.map((p) => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </Select>
              {!programaAtual ? <div className="mt-1 text-[11px] text-black/45">Cadastre um programa primeiro.</div> : null}
            </div>

            <div className="md:col-span-2">
              <label className="text-xs text-white/55">Novo critério</label>
              <Input value={novo.nome} onChange={(e) => setNovo((s) => ({ ...s, nome: e.target.value }))} placeholder="Ex.: Presença" />
            </div>

            <div>
              <label className="text-xs text-white/55">Tipo</label>
              <Select value={novo.tipo} onChange={(e) => setNovo((s) => ({ ...s, tipo: e.target.value }))}>
                {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </Select>
            </div>

            <div>
              <label className="text-xs text-white/55">Pontos base</label>
              <Input type="number" value={novo.pontos_base} onChange={(e) => setNovo((s) => ({ ...s, pontos_base: e.target.value }))} />
            </div>

            <div>
              <label className="text-xs text-white/55">Peso padrão</label>
              <Input type="number" value={novo.peso_padrao} onChange={(e) => setNovo((s) => ({ ...s, peso_padrao: e.target.value }))} />
            </div>

            <div>
              <label className="text-xs text-white/55">Ordem</label>
              <Input type="number" value={novo.ordem} onChange={(e) => setNovo((s) => ({ ...s, ordem: e.target.value }))} />
            </div>

            <div className="flex items-center gap-3">
              <label className="text-sm text-white/70 flex items-center gap-2">
                <input type="checkbox" checked={!!novo.ativo} onChange={(e) => setNovo((s) => ({ ...s, ativo: e.target.checked }))} />
                Ativo
              </label>
              <Button onClick={criar} disabled={loading || !programaId}>Criar</Button>
              <Button variant="ghost" onClick={carregar} disabled={loading || !programaId}>Atualizar</Button>
            </div>
          </div>

          {erro ? <div className="mt-3 text-sm text-red-600">{erro}</div> : null}
          {ok ? <div className="mt-3 text-sm text-emerald-700">{ok}</div> : null}
        </Card>

        {editId ? (
          <Card>
            <div className="flex items-center justify-between gap-2">
              <div className="font-semibold">Editar critério</div>
              <Button variant="ghost" onClick={cancelEdit}>Fechar</Button>
            </div>

            <div className="mt-3 grid md:grid-cols-3 gap-3 items-end">
              <div className="md:col-span-2">
                <label className="text-xs text-white/55">Nome</label>
                <Input value={edit.nome} onChange={(e) => setEdit((s) => ({ ...s, nome: e.target.value }))} />
              </div>

              <div>
                <label className="text-xs text-white/55">Tipo</label>
                <Select value={edit.tipo} onChange={(e) => setEdit((s) => ({ ...s, tipo: e.target.value }))}>
                  {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </Select>
              </div>

              <div>
                <label className="text-xs text-white/55">Pontos base</label>
                <Input type="number" value={edit.pontos_base} onChange={(e) => setEdit((s) => ({ ...s, pontos_base: e.target.value }))} />
              </div>

              <div>
                <label className="text-xs text-white/55">Peso padrão</label>
                <Input type="number" value={edit.peso_padrao} onChange={(e) => setEdit((s) => ({ ...s, peso_padrao: e.target.value }))} />
              </div>

              <div>
                <label className="text-xs text-white/55">Ordem</label>
                <Input type="number" value={edit.ordem} onChange={(e) => setEdit((s) => ({ ...s, ordem: e.target.value }))} />
              </div>

              <div className="flex items-center gap-3">
                <label className="text-sm text-white/70 flex items-center gap-2">
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
            <div className="text-sm text-white/60">Carregando…</div>
          ) : !programaId ? (
            <div className="text-sm text-white/60">Selecione um programa.</div>
          ) : rows.length === 0 ? (
            <div className="text-sm text-white/60">Nenhum critério cadastrado.</div>
          ) : (
            <div className="overflow-auto">
              <table className="min-w-[980px] w-full text-sm">
                <thead>
                  <tr className="text-left text-white/55 border-b">
                    <th className="py-2 pr-3">Nome</th>
                    <th className="py-2 pr-3">Tipo</th>
                    <th className="py-2 pr-3">Pontos</th>
                    <th className="py-2 pr-3">Peso</th>
                    <th className="py-2 pr-3">Ordem</th>
                    <th className="py-2 pr-3">Ativo</th>
                    <th className="py-2 pr-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b last:border-b-0">
                      <td className="py-2 pr-3 font-medium">{r.nome}</td>
                      <td className="py-2 pr-3">{r.tipo}</td>
                      <td className="py-2 pr-3">{String(r.pontos_base)}</td>
                      <td className="py-2 pr-3">{String(r.peso_padrao)}</td>
                      <td className="py-2 pr-3">{String(r.ordem)}</td>
                      <td className="py-2 pr-3">{r.ativo ? "Sim" : "Não"}</td>
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
