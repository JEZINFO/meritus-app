"use client";

import { useEffect, useMemo, useState } from "react";
import RequireRole from "../../../../components/admin/RequireRole";
import { supabase } from "../../../../src/lib/supabaseClient";
import { Button, Card, Input, PageTitle, Select } from "../../../../components/admin/ui";

export default function UsuariosPage() {
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [itens, setItens] = useState([]);
  const [q, setQ] = useState("");

  const [form, setForm] = useState({
    user_id: "",
    perfil: "relatorio",
    ativo: true,
    organizacao_id: "",
  });

  const filtrados = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return itens;
    return itens.filter((x) => (x.user_id || "").toLowerCase().includes(s));
  }, [itens, q]);

  async function carregar() {
    setLoading(true);
    setErro(null);

    const { data: me, error: meErr } = await supabase.from("usuarios").select("organizacao_id").limit(1).single();
    if (meErr || !me?.organizacao_id) {
      setErro(meErr?.message || "Não foi possível carregar sua organização.");
      setLoading(false);
      return;
    }

    setForm((s) => ({ ...s, organizacao_id: me.organizacao_id }));

    const { data, error } = await supabase
      .from("usuarios")
      .select("user_id, organizacao_id, perfil, ativo, criado_em")
      .order("criado_em", { ascending: false });

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

  async function criar(e) {
    e.preventDefault();
    setErro(null);

    if (!form.user_id?.trim()) return setErro("user_id (UUID do auth.users) é obrigatório.");

    const payload = {
      user_id: form.user_id.trim(),
      organizacao_id: form.organizacao_id,
      perfil: form.perfil,
      ativo: !!form.ativo,
    };

    const { error } = await supabase.from("usuarios").insert(payload);
    if (error) return setErro(error.message);

    setForm((s) => ({ ...s, user_id: "", perfil: "relatorio", ativo: true }));
    await carregar();
  }

  async function atualizar(user_id, patch) {
    setErro(null);
    const { error } = await supabase.from("usuarios").update(patch).eq("user_id", user_id);
    if (error) return setErro(error.message);
    await carregar();
  }

  async function remover(user_id) {
    if (!confirm("Remover este usuário do tenant?")) return;
    setErro(null);
    const { error } = await supabase.from("usuarios").delete().eq("user_id", user_id);
    if (error) return setErro(error.message);
    await carregar();
  }

  return (
    <RequireRole allow={["admin"]}>
      <div className="space-y-4">
        <PageTitle
          title="Usuários"
          subtitle="Administra perfis de acesso (admin / fiscal / relatorio)."
          right={<Input placeholder="Buscar..." value={q} onChange={(e) => setQ(e.target.value)} className="w-64" />}
        />

        {erro ? (
          <div className="rounded-2xl border border-black/10 bg-white p-4 text-sm text-red-600">{erro}</div>
        ) : null}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card>
            <form onSubmit={criar} className="space-y-3">
              <div>
                <label className="text-xs text-black/60">Auth user_id (UUID)</label>
                <Input value={form.user_id} onChange={(e) => setForm((s) => ({ ...s, user_id: e.target.value }))} />
                <div className="mt-1 text-xs text-black/50">Dica: copie o UUID do usuário em Authentication → Users.</div>
              </div>

              <div>
                <label className="text-xs text-black/60">Perfil</label>
                <Select value={form.perfil} onChange={(e) => setForm((s) => ({ ...s, perfil: e.target.value }))}>
                  <option value="admin">admin</option>
                  <option value="fiscal">fiscal</option>
                  <option value="relatorio">relatorio</option>
                </Select>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={!!form.ativo} onChange={(e) => setForm((s) => ({ ...s, ativo: e.target.checked }))} />
                Ativo
              </label>

              <div className="pt-2">
                <Button type="submit">Adicionar</Button>
              </div>
            </form>
          </Card>

          <div className="lg:col-span-2">
            <Card>
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">Lista</div>
                <div className="text-xs text-black/50">{loading ? "Carregando..." : `${filtrados.length} usuários`}</div>
              </div>

              <div className="mt-3 divide-y divide-black/5">
                {filtrados.map((u) => (
                  <div key={u.user_id} className="py-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium">{u.user_id}</div>
                      <div className="text-xs text-black/50">
                        Perfil: <span className="text-black/70">{u.perfil}</span> • {u.ativo ? "ativo" : "inativo"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Select className="w-36" value={u.perfil} onChange={(e) => atualizar(u.user_id, { perfil: e.target.value })}>
                        <option value="admin">admin</option>
                        <option value="fiscal">fiscal</option>
                        <option value="relatorio">relatorio</option>
                      </Select>
                      <Button variant="soft" onClick={() => atualizar(u.user_id, { ativo: !u.ativo })}>
                        {u.ativo ? "Desativar" : "Ativar"}
                      </Button>
                      <Button variant="soft" onClick={() => remover(u.user_id)}>Remover</Button>
                    </div>
                  </div>
                ))}
                {!loading && filtrados.length === 0 ? <div className="py-8 text-center text-sm text-black/50">Nenhum usuário cadastrado.</div> : null}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </RequireRole>
  );
}
