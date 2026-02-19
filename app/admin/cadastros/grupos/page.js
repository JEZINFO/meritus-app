"use client";

import { useEffect, useState } from "react";
import RequireRole from "../../../../components/admin/RequireRole";
import { Card, PageTitle, Button, Input } from "../../../../components/admin/ui";
import { supabase } from "@/src/lib/supabase";
import { getProfile } from "@/src/lib/profile";

export default function CadGrupos() {
  const [orgId, setOrgId] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);
  const [rows, setRows] = useState([]);

  const [novo, setNovo] = useState({ nome: "", ordem: 0, ativo: true });

  const [editId, setEditId] = useState(null);
  const [edit, setEdit] = useState({ nome: "", ordem: 0, ativo: true });

  useEffect(() => {
    (async () => {
      const res = await getProfile();
      if (res.ok) setOrgId(res.profile.organizacao_id);
    })();
  }, []);

  useEffect(() => {
    if (!orgId) return;
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  async function carregar() {
    setErro(null);
    setLoading(true);
    const { data, error } = await supabase
      .from("grupos")
      .select("id,nome,ativo,ordem,criado_em,organizacao_id")
      .eq("organizacao_id", orgId)
      .order("ordem", { ascending: true })
      .order("nome", { ascending: true })
      .limit(2000);

    if (error) setErro(error.message);
    setRows(data || []);
    setLoading(false);
  }

  function startEdit(r) {
    setEditId(r.id);
    setEdit({ nome: r.nome || "", ordem: Number(r.ordem || 0), ativo: !!r.ativo });
  }
  function cancelEdit() {
    setEditId(null);
    setEdit({ nome: "", ordem: 0, ativo: true });
  }

  async function criar() {
    if (!orgId) return;
    setErro(null);
    const nome = (novo.nome || "").trim();
    if (!nome) return setErro("Informe o nome.");
    const ordem = Number(novo.ordem || 0);

    setLoading(true);
    const { error } = await supabase.from("grupos").insert({
      organizacao_id: orgId,
      nome,
      ordem,
      ativo: true,
    });

    if (error) setErro(error.message);
    setNovo({ nome: "", ordem: 0, ativo: true });
    await carregar();
    setLoading(false);
  }

  async function salvar() {
    if (!editId) return;
    setErro(null);
    const nome = (edit.nome || "").trim();
    if (!nome) return setErro("Informe o nome.");
    const ordem = Number(edit.ordem || 0);

    setLoading(true);
    const { error } = await supabase.from("grupos").update({ nome, ordem, ativo: !!edit.ativo }).eq("id", editId);
    if (error) setErro(error.message);
    cancelEdit();
    await carregar();
    setLoading(false);
  }

  async function toggleAtivo(r) {
    setErro(null);
    setLoading(true);
    const { error } = await supabase.from("grupos").update({ ativo: !r.ativo }).eq("id", r.id);
    if (error) setErro(error.message);
    await carregar();
    setLoading(false);
  }

  return (
    <RequireRole allow={["admin"]}>
      <div className="space-y-4">
        <PageTitle title="Cadastros • Grupos" subtitle="Grupos (unidades) usados para organizar participantes e filtros." />

        <Card className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="md:col-span-2">
              <div className="text-xs text-black/60 mb-1">Nome</div>
              <Input value={novo.nome} onChange={(e) => setNovo((s) => ({ ...s, nome: e.target.value }))} placeholder="Ex: UCB • Desbravadores • Juvenis" />
            </div>
            <div>
              <div className="text-xs text-black/60 mb-1">Ordem</div>
              <Input type="number" value={novo.ordem} onChange={(e) => setNovo((s) => ({ ...s, ordem: e.target.value }))} />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={criar} disabled={loading || !orgId}>Criar</Button>
            <Button variant="secondary" onClick={carregar} disabled={loading || !orgId}>Recarregar</Button>
          </div>

          {erro ? <div className="text-sm text-red-600">{erro}</div> : null}
        </Card>

        <Card className="p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-black/10 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">Lista</div>
              <div className="text-xs text-black/50">Ordenação por campo ordem (asc).</div>
            </div>
            <div className="text-xs text-black/50">{loading ? "Atualizando..." : `${rows.length} grupos`}</div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-black/5 text-black/60">
                  <th className="text-left px-5 py-3">Nome</th>
                  <th className="text-right px-5 py-3">Ordem</th>
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
                      <td className="px-5 py-3 text-right">
                        {editing ? <Input type="number" value={edit.ordem} onChange={(e) => setEdit((s) => ({ ...s, ordem: e.target.value }))} /> : (r.ordem ?? 0)}
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
                    <td colSpan={4} className="px-5 py-10 text-center text-black/60">{loading ? "Carregando..." : "Nenhum grupo cadastrado."}</td>
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
