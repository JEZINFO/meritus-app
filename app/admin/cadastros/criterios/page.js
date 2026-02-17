"use client";

import { useEffect, useMemo, useState } from "react";
import RequireRole from "../../../../components/admin/RequireRole";
import { supabase } from "../../../../src/lib/supabaseClient";
import { Button, Card, Input, PageTitle } from "../../../../components/admin/ui";

export default function Page() {
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [itens, setItens] = useState([]);
  const [q, setQ] = useState("");

  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ nome: "", descricao: "", ordem: 0, ativo: true });

  const filtrados = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return itens;
    return itens.filter((x) => (x.nome || "").toLowerCase().includes(s));
  }, [itens, q]);

  async function carregar() {
    setLoading(true);
    setErro(null);

    const { data, error } = await supabase
      .from("criterios")
      .select("id,nome,descricao,ativo,ordem,criado_em")
      .order("ordem", { ascending: true })
      .order("nome", { ascending: true });

    if (error) {
      setErro(error.message);
      setLoading(false);
      return;
    }

    setItens(data || []);
    setLoading(false);
  }

  useEffect(() => {
    carregar();
  }, []);

  function novo() {
    setEditId(null);
    setForm({ nome: "", descricao: "", ordem: 0, ativo: true });
  }

  function editar(item) {
    setEditId(item.id);
    setForm({
      nome: item.nome || "",
      descricao: item.descricao || "",
      ordem: item.ordem ?? 0,
      ativo: !!item.ativo,
    });
  }

  async function salvar(e) {
    e.preventDefault();
    setErro(null);

    const payload = {
      nome: form.nome?.trim(),
      descricao: form.descricao?.trim() || null,
      ordem: Number(form.ordem || 0),
      ativo: !!form.ativo,
    };

    if (!payload.nome) {
      setErro("Nome é obrigatório.");
      return;
    }

    if (editId) {
      const { error } = await supabase.from("criterios").update(payload).eq("id", editId);
      if (error) return setErro(error.message);
    } else {
      const { error } = await supabase.from("criterios").insert(payload);
      if (error) return setErro(error.message);
    }

    await carregar();
    novo();
  }

  async function remover(id) {
    if (!confirm("Remover este registro?")) return;
    const { error } = await supabase.from("criterios").delete().eq("id", id);
    if (error) return setErro(error.message);
    await carregar();
  }

  return (
    <RequireRole allow={["admin"]}>
      <div className="space-y-4">
        <PageTitle
          title="Critérios"
          subtitle="Cadastro de critérios (ordenados por campo ordem)."
          right={
            <div className="flex items-center gap-2">
              <Input placeholder="Buscar..." value={q} onChange={(e) => setQ(e.target.value)} className="w-48" />
              <Button variant="soft" onClick={novo}>
                Novo
              </Button>
            </div>
          }
        />

        {erro ? (
          <div className="rounded-2xl border border-black/10 bg-white p-4 text-sm text-red-600">{erro}</div>
        ) : null}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card>
            <form onSubmit={salvar} className="space-y-3">
              <div>
                <label className="text-xs text-black/60">Nome</label>
                <Input value={form.nome} onChange={(e) => setForm((s) => ({ ...s, nome: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-black/60">Descrição</label>
                <Input value={form.descricao} onChange={(e) => setForm((s) => ({ ...s, descricao: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-black/60">Ordem</label>
                  <Input type="number" value={form.ordem} onChange={(e) => setForm((s) => ({ ...s, ordem: e.target.value }))} />
                </div>
                <label className="flex items-center gap-2 text-sm pt-6">
                  <input type="checkbox" checked={!!form.ativo} onChange={(e) => setForm((s) => ({ ...s, ativo: e.target.checked }))} />
                  Ativo
                </label>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <Button type="submit">{editId ? "Salvar" : "Criar"}</Button>
                {editId ? (
                  <Button type="button" variant="soft" onClick={novo}>
                    Cancelar
                  </Button>
                ) : null}
              </div>
              <div className="text-xs text-black/50">{editId ? "Editando registro existente." : "Criando novo registro."}</div>
            </form>
          </Card>

          <div className="lg:col-span-2">
            <Card>
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">Lista</div>
                <div className="text-xs text-black/50">{loading ? "Carregando..." : `${filtrados.length} itens`}</div>
              </div>

              <div className="mt-3 divide-y divide-black/5">
                {filtrados.map((item) => (
                  <div key={item.id} className="py-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium">{item.nome}</div>
                      <div className="text-xs text-black/50">
                        Ordem: {item.ordem ?? 0} • {item.ativo ? "ativo" : "inativo"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="soft" onClick={() => editar(item)}>
                        Editar
                      </Button>
                      <Button variant="soft" onClick={() => remover(item.id)}>
                        Remover
                      </Button>
                    </div>
                  </div>
                ))}
                {!loading && filtrados.length === 0 ? <div className="py-8 text-center text-sm text-black/50">Nada por aqui ainda.</div> : null}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </RequireRole>
  );
}
