"use client";

import { useEffect, useState } from "react";
import RequireRole from "../../../../components/admin/RequireRole";
import { supabase } from "../../../../src/lib/supabaseClient";
import { Button, Card, Input, PageTitle } from "../../../../components/admin/ui";

export default function OrganizacaoPage() {
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [org, setOrg] = useState(null);

  const [form, setForm] = useState({ nome: "", slug: "", ativo: true });

  async function carregar() {
    setLoading(true);
    setErro(null);

    const { data, error } = await supabase.from("organizacoes").select("id,nome,slug,ativo").limit(1).single();
    if (error) {
      setErro(error.message);
      setLoading(false);
      return;
    }
    setOrg(data);
    setForm({ nome: data?.nome || "", slug: data?.slug || "", ativo: !!data?.ativo });
    setLoading(false);
  }

  useEffect(() => {
    carregar();
  }, []);

  async function salvar(e) {
    e.preventDefault();
    setErro(null);
    if (!org?.id) return setErro("Organização não encontrada para este usuário.");

    const payload = {
      nome: form.nome?.trim(),
      slug: form.slug?.trim() || null,
      ativo: !!form.ativo,
    };

    const { error } = await supabase.from("organizacoes").update(payload).eq("id", org.id);
    if (error) return setErro(error.message);

    await carregar();
  }

  return (
    <RequireRole allow={["admin"]}>
      <div className="space-y-4">
        <PageTitle title="Organização" subtitle="Configurações do tenant atual (somente admin)." />
        {erro ? (
          <div className="rounded-2xl border border-black/10 bg-white p-4 text-sm text-red-600">{erro}</div>
        ) : null}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <form onSubmit={salvar} className="space-y-3">
              <div>
                <label className="text-xs text-black/60">Nome</label>
                <Input value={form.nome} onChange={(e) => setForm((s) => ({ ...s, nome: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-black/60">Slug</label>
                <Input value={form.slug} onChange={(e) => setForm((s) => ({ ...s, slug: e.target.value }))} />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!form.ativo}
                  onChange={(e) => setForm((s) => ({ ...s, ativo: e.target.checked }))}
                />
                Ativa
              </label>
              <div className="pt-2">
                <Button type="submit">{loading ? "Carregando..." : "Salvar"}</Button>
              </div>
            </form>
          </Card>

          <Card>
            <div className="text-sm font-semibold">Informações</div>
            <div className="mt-2 text-sm text-black/70">
              <div><span className="text-black/50">ID:</span> {org?.id || "—"}</div>
              <div><span className="text-black/50">Status:</span> {org?.ativo ? "Ativa" : "Inativa"}</div>
            </div>
          </Card>
        </div>
      </div>
    </RequireRole>
  );
}
