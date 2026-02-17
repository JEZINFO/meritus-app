"use client";

import { useEffect, useMemo, useState } from "react";
import RequireRole from "../../../../components/admin/RequireRole";
import { supabase } from "../../../../src/lib/supabaseClient";
import { Button, Card, Input, PageTitle, Select } from "../../../../components/admin/ui";

function toISODate(d) {
  if (!d) return "";
  return String(d).slice(0, 10);
}

export default function PeriodosPage() {
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [itens, setItens] = useState([]);
  const [q, setQ] = useState("");

  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ nome: "", data_inicio: "", data_fim: "", status: "aberto" });

  const filtrados = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return itens;
    return itens.filter((x) => (x.nome || "").toLowerCase().includes(s));
  }, [itens, q]);

  async function carregar() {
    setLoading(true);
    setErro(null);

    const { data, error } = await supabase
      .from("periodos")
      .select("id,nome,data_inicio,data_fim,status,criado_em")
      .order("data_inicio", { ascending: false });

    if (error) {
      setErro(error.message);
      setLoading(false);
      return;
    }

    setItens((data || []).map((p) => ({ ...p, data_inicio: toISODate(p.data_inicio), data_fim: toISODate(p.data_fim) })));
    setLoading(false);
  }

  useEffect(() => {
    carregar();
  }, []);

  function novo() {
    setEditId(null);
    setForm({ nome: "", data_inicio: "", data_fim: "", status: "aberto" });
  }

  function editar(item) {
    setEditId(item.id);
    setForm({
      nome: item.nome || "",
      data_inicio: toISODate(item.data_inicio),
      data_fim: toISODate(item.data_fim),
      status: item.status || "aberto",
    });
  }

  async function salvar(e) {
    e.preventDefault();
    setErro(null);

    const payload = {
      nome: form.nome?.trim(),
      data_inicio: form.data_inicio,
      data_fim: form.data_fim,
      status: form.status,
    };

    if (!payload.nome) return setErro("Nome é obrigatório.");
    if (!payload.data_inicio || !payload.data_fim) return setErro("Datas são obrigatórias.");

    if (editId) {
      const { error } = await supabase.from("periodos").update(payload).eq("id", editId);
      if (error) return setErro(error.message);
    } else {
      const { error } = await supabase.from("periodos").insert(payload);
      if (error) return setErro(error.message);
    }

    await carregar();
    novo();
  }

  async function remover(id) {
    if (!confirm("Remover este período?")) return;
    const { error } = await supabase.from("periodos").delete().eq("id", id);
    if (error) return setErro(error.message);
    await carregar();
  }

  return (
    <RequireRole allow={["admin"]}>
      <div className="space-y-4">
        <PageTitle
          title="Períodos"
          subtitle="Semanas (domingo a sábado) com controle aberto/fechado."
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

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-black/60">Início</label>
                  <Input type="date" value={form.data_inicio} onChange={(e) => setForm((s) => ({ ...s, data_inicio: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-black/60">Fim</label>
                  <Input type="date" value={form.data_fim} onChange={(e) => setForm((s) => ({ ...s, data_fim: e.target.value }))} />
                </div>
              </div>

              <div>
                <label className="text-xs text-black/60">Status</label>
                <Select value={form.status} onChange={(e) => setForm((s) => ({ ...s, status: e.target.value }))}>
                  <option value="aberto">aberto</option>
                  <option value="fechado">fechado</option>
                </Select>
              </div>

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
                        {item.data_inicio} → {item.data_fim} • {item.status}
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
