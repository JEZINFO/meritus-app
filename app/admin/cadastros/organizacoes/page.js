"use client";

import { useEffect, useState } from "react";
import RequireRole from "../../../../components/admin/RequireRole";
import { Card, PageTitle, Button, Input } from "../../../../components/admin/ui";
import { supabase } from "@/src/lib/supabase";

function slugify(v) {
  return String(v || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export default function CadOrganizacoes() {
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);
  const [rows, setRows] = useState([]);

  const [novo, setNovo] = useState({ nome: "", slug: "", ativo: true });

  const [editId, setEditId] = useState(null);
  const [edit, setEdit] = useState({ nome: "", slug: "", ativo: true });

  useEffect(() => {
    carregar();
  }, []);

  async function carregar() {
    setErro(null);
    setLoading(true);
    const { data, error } = await supabase
      .from("organizacoes")
      .select("id,nome,slug,ativo,criado_em")
      .order("criado_em", { ascending: false })
      .limit(500);
    if (error) setErro(error.message);
    setRows(data || []);
    setLoading(false);
  }

  function startEdit(r) {
    setEditId(r.id);
    setEdit({ nome: r.nome || "", slug: r.slug || "", ativo: !!r.ativo });
  }
  function cancelEdit() {
    setEditId(null);
    setEdit({ nome: "", slug: "", ativo: true });
  }

  async function criar() {
    setErro(null);
    const nome = (novo.nome || "").trim();
    if (!nome) return setErro("Informe o nome.");
    const slug = (novo.slug || "").trim() || slugify(nome);

    setLoading(true);
    const { error } = await supabase.from("organizacoes").insert({ nome, slug, ativo: true });
    if (error) setErro(error.message);
    setNovo({ nome: "", slug: "", ativo: true });
    await carregar();
    setLoading(false);
  }

  async function salvar() {
    if (!editId) return;
    setErro(null);
    const nome = (edit.nome || "").trim();
    if (!nome) return setErro("Informe o nome.");
    const slug = (edit.slug || "").trim() || slugify(nome);

    setLoading(true);
    const { error } = await supabase.from("organizacoes").update({ nome, slug, ativo: !!edit.ativo }).eq("id", editId);
    if (error) setErro(error.message);
    cancelEdit();
    await carregar();
    setLoading(false);
  }

  async function toggleAtivo(r) {
    setErro(null);
    setLoading(true);
    const { error } = await supabase.from("organizacoes").update({ ativo: !r.ativo }).eq("id", r.id);
    if (error) setErro(error.message);
    await carregar();
    setLoading(false);
  }

  return (
    <RequireRole allow={["admin"]}>
      <div className="space-y-4">
        <PageTitle title="Cadastros • Organizações" subtitle="Multi-tenant: cada organização tem seus programas, usuários e dados." />

        <Card className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="md:col-span-2">
              <div className="text-xs text-black/60 mb-1">Nome</div>
              <Input value={novo.nome} onChange={(e) => setNovo((s) => ({ ...s, nome: e.target.value, slug: s.slug || slugify(e.target.value) }))} placeholder="Ex: IASD Central - Artur Nogueira" />
            </div>
            <div>
              <div className="text-xs text-black/60 mb-1">Slug</div>
              <Input value={novo.slug} onChange={(e) => setNovo((s) => ({ ...s, slug: e.target.value }))} placeholder="iasd-central-artur-nogueira" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={criar} disabled={loading}>Criar</Button>
            <Button variant="secondary" onClick={carregar} disabled={loading}>Recarregar</Button>
          </div>
          {erro ? <div className="text-sm text-red-600">{erro}</div> : null}
        </Card>

        <Card className="p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-black/10 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">Lista</div>
              <div className="text-xs text-black/50">Ative/desative conforme necessário.</div>
            </div>
            <div className="text-xs text-black/50">{loading ? "Atualizando..." : `${rows.length} organizações`}</div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-black/5 text-black/60">
                  <th className="text-left px-5 py-3">Nome</th>
                  <th className="text-left px-5 py-3">Slug</th>
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
                      <td className="px-5 py-3 text-black/60">
                        {editing ? <Input value={edit.slug} onChange={(e) => setEdit((s) => ({ ...s, slug: e.target.value }))} /> : r.slug}
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
                    <td colSpan={4} className="px-5 py-10 text-center text-black/60">{loading ? "Carregando..." : "Nenhuma organização cadastrada."}</td>
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
