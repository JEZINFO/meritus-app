"use client";

import { useEffect, useState } from "react";
import RequireRole from "../../../../components/admin/RequireRole";
import { Card, PageTitle, Button, Input } from "../../../../components/admin/ui";
import { supabase } from "@/src/lib/supabase";

export default function CadOrganizacoes() {
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);
  const [ok, setOk] = useState(null);
  const [rows, setRows] = useState([]);

  const [novo, setNovo] = useState({ nome: "", ativo: true });

  const [editId, setEditId] = useState(null);
  const [edit, setEdit] = useState({ nome: "", ativo: true });

  useEffect(() => {
    carregar();
  }, []);

  async function carregar() {
    setErro(null);
    setOk(null);
    setLoading(true);

    const { data, error } = await supabase
      .from("meritus_organizacoes")
      .select("id,nome,ativo,criado_em")
      .order("criado_em", { ascending: false })
      .limit(500);

    if (error) setErro(error.message);
    setRows(data || []);
    setLoading(false);
  }

  async function criar() {
    setErro(null);
    setOk(null);
    const nome = String(novo.nome || "").trim();
    if (!nome) return setErro("Informe o nome da organização.");

    setLoading(true);
    const { error } = await supabase.from("meritus_organizacoes").insert([{ nome, ativo: !!novo.ativo }]);
    if (error) setErro(error.message);
    else {
      setOk("Organização criada.");
      setNovo({ nome: "", ativo: true });
      await carregar();
    }
    setLoading(false);
  }

  function startEdit(r) {
    setEditId(r.id);
    setEdit({ nome: r.nome || "", ativo: !!r.ativo });
  }
  function cancelEdit() {
    setEditId(null);
    setEdit({ nome: "", ativo: true });
  }

  async function salvarEdit() {
    setErro(null);
    setOk(null);
    const nome = String(edit.nome || "").trim();
    if (!nome) return setErro("Informe o nome.");

    setLoading(true);
    const { error } = await supabase
      .from("meritus_organizacoes")
      .update({ nome, ativo: !!edit.ativo })
      .eq("id", editId);

    if (error) setErro(error.message);
    else {
      setOk("Organização atualizada.");
      cancelEdit();
      await carregar();
    }
    setLoading(false);
  }

  return (
    <RequireRole allow={["admin"]}>
      <div className="space-y-4">
        <PageTitle title="Organizações" subtitle="Cadastro de organizações (Meritus)." />

        <Card>
          <div className="grid md:grid-cols-3 gap-3 items-end">
            <div className="md:col-span-2">
              <label className="text-xs text-black/50">Nome</label>
              <Input value={novo.nome} onChange={(e) => setNovo((s) => ({ ...s, nome: e.target.value }))} placeholder="Ex.: IASD Central" />
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm text-black/70 flex items-center gap-2">
                <input type="checkbox" checked={!!novo.ativo} onChange={(e) => setNovo((s) => ({ ...s, ativo: e.target.checked }))} />
                Ativo
              </label>
              <Button onClick={criar} disabled={loading}>Criar</Button>
              <Button variant="ghost" onClick={carregar} disabled={loading}>Atualizar</Button>
            </div>
          </div>

          {erro ? <div className="mt-3 text-sm text-red-600">{erro}</div> : null}
          {ok ? <div className="mt-3 text-sm text-emerald-700">{ok}</div> : null}
        </Card>

        {editId ? (
          <Card>
            <div className="flex items-center justify-between gap-2">
              <div className="font-semibold">Editar</div>
              <Button variant="ghost" onClick={cancelEdit}>Fechar</Button>
            </div>
            <div className="mt-3 grid md:grid-cols-3 gap-3 items-end">
              <div className="md:col-span-2">
                <label className="text-xs text-black/50">Nome</label>
                <Input value={edit.nome} onChange={(e) => setEdit((s) => ({ ...s, nome: e.target.value }))} />
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
          ) : rows.length === 0 ? (
            <div className="text-sm text-black/60">Nenhuma organização.</div>
          ) : (
            <div className="overflow-auto">
              <table className="min-w-[640px] w-full text-sm">
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
