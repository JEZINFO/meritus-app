"use client";

import { useEffect, useMemo, useState } from "react";
import RequireRole from "../../../../components/admin/RequireRole";
import { supabase } from "../../../../src/lib/supabaseClient";
import { Button, Card, Input, PageTitle, Select } from "../../../../components/admin/ui";

export default function ParticipantesPage() {
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);

  const [grupos, setGrupos] = useState([]);
  const [itens, setItens] = useState([]);
  const [q, setQ] = useState("");

  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ nome: "", grupo_id: "", ativo: true });

  const filtrados = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return itens;
    return itens.filter((x) => (x.nome || "").toLowerCase().includes(s));
  }, [itens, q]);

  async function carregar() {
    setLoading(true);
    setErro(null);

    const { data: g, error: gErr } = await supabase
      .from("grupos")
      .select("id,nome,ordem,ativo")
      .eq("ativo", true)
      .order("ordem", { ascending: true })
      .order("nome", { ascending: true });

    if (gErr) {
      setErro(gErr.message);
      setLoading(false);
      return;
    }

    setGrupos(g || []);

    const { data, error } = await supabase
      .from("participantes")
      .select("id,nome,ativo,grupo_id,grupos(nome)")
      .order("nome", { ascending: true });

    if (error) {
      setErro(error.message);
      setLoading(false);
      return;
    }

    setItens((data || []).map((p) => ({ ...p, grupo_nome: p.grupos?.nome || "" })));
    setLoading(false);
  }

  useEffect(() => {
    carregar();
  }, []);

  function novo() {
    setEditId(null);
    setForm({ nome: "", grupo_id: "", ativo: true });
  }

  function editar(item) {
    setEditId(item.id);
    setForm({ nome: item.nome || "", grupo_id: item.grupo_id || "", ativo: !!item.ativo });
  }

  async function salvar(e) {
    e.preventDefault();
    setErro(null);

    const payload = { nome: form.nome?.trim(), grupo_id: form.grupo_id || null, ativo: !!form.ativo };
    if (!payload.nome) return setErro("Nome é obrigatório.");

    if (editId) {
      const { error } = await supabase.from("participantes").update(payload).eq("id", editId);
      if (error) return setErro(error.message);
    } else {
      const { error } = await supabase.from("participantes").insert(payload);
      if (error) return setErro(error.message);
    }

    await carregar();
    novo();
  }

  async function remover(id) {
    if (!confirm("Remover este participante?")) return;
    const { error } = await supabase.from("participantes").delete().eq("id", id);
    if (error) return setErro(error.message);
    await carregar();
  }

  return (
    <RequireRole allow={["admin"]}>
      <div className="space-y-4">
        <PageTitle
          title="Participantes"
          subtitle="Cadastro de participantes (vinculados a grupos)."
          right={
            <div className="flex items-center gap-2">
              <Input placeholder="Buscar..." value={q} onChange={(e) => setQ(e.target.value)} className="w-56" />
              <Button variant="soft" onClick={novo}>Novo</Button>
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
                <label className="text-xs text-black/60">Grupo</label>
                <Select value={form.grupo_id} onChange={(e) => setForm((s) => ({ ...s, grupo_id: e.target.value }))}>
                  <option value="">(Sem grupo)</option>
                  {grupos.map((g) => (
                    <option key={g.id} value={g.id}>{g.nome}</option>
                  ))}
                </Select>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={!!form.ativo} onChange={(e) => setForm((s) => ({ ...s, ativo: e.target.checked }))} />
                Ativo
              </label>
              <div className="flex items-center gap-2 pt-2">
                <Button type="submit">{editId ? "Salvar" : "Criar"}</Button>
                {editId ? <Button type="button" variant="soft" onClick={novo}>Cancelar</Button> : null}
              </div>
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
                        {item.grupo_nome ? `Grupo: ${item.grupo_nome}` : "Sem grupo"} • {item.ativo ? "ativo" : "inativo"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="soft" onClick={() => editar(item)}>Editar</Button>
                      <Button variant="soft" onClick={() => remover(item.id)}>Remover</Button>
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
