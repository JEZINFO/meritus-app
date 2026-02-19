"use client";

import { useEffect, useMemo, useState } from "react";
import RequireRole from "../../../../components/admin/RequireRole";
import { Card, PageTitle, Button, Input, Select } from "../../../../components/admin/ui";
import { supabase } from "@/src/lib/supabase";
import { getProfile } from "@/src/lib/profile";

const PERFIS = [
  { v: "admin", t: "Admin" },
  { v: "fiscal", t: "Fiscal" },
  { v: "relatorio", t: "Relatório" },
];

export default function CadUsuarios() {
  const [orgId, setOrgId] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);

  const [rows, setRows] = useState([]);
  const [programas, setProgramas] = useState([]);
  const [grupos, setGrupos] = useState([]);

  const [novo, setNovo] = useState({ user_id: "", perfil: "relatorio", programa_id: "", grupo_id: "", ativo: true });

  const [editId, setEditId] = useState(null);
  const [edit, setEdit] = useState({ user_id: "", perfil: "relatorio", programa_id: "", grupo_id: "", ativo: true });

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

    const [uRes, pRes, gRes] = await Promise.all([
      supabase
        .from("meritus_usuarios")
        .select("id,user_id,organizacao_id,perfil,programa_id,grupo_id,ativo,criado_em")
        .eq("organizacao_id", orgId)
        .order("criado_em", { ascending: false })
        .limit(1000),
      supabase
        .from("meritus_programas")
        .select("id,nome,ativo")
        .eq("organizacao_id", orgId)
        .order("nome", { ascending: true })
        .limit(1000),
      supabase
        .from("grupos")
        .select("id,nome,ativo,ordem")
        .eq("organizacao_id", orgId)
        .eq("ativo", true)
        .order("ordem", { ascending: true })
        .order("nome", { ascending: true })
        .limit(2000),
    ]);

    if (uRes.error) setErro(uRes.error.message);
    if (pRes.error) setErro((e) => (e ? e + " | " : "") + pRes.error.message);
    if (gRes.error) setErro((e) => (e ? e + " | " : "") + gRes.error.message);

    setRows(uRes.data || []);
    setProgramas((pRes.data || []).filter((p) => p.ativo));
    setGrupos(gRes.data || []);

    setLoading(false);
  }

  function startEdit(r) {
    setEditId(r.id);
    setEdit({
      user_id: r.user_id || "",
      perfil: r.perfil || "relatorio",
      programa_id: r.programa_id || "",
      grupo_id: r.grupo_id || "",
      ativo: !!r.ativo,
    });
  }
  function cancelEdit() {
    setEditId(null);
    setEdit({ user_id: "", perfil: "relatorio", programa_id: "", grupo_id: "", ativo: true });
  }

  async function criar() {
    if (!orgId) return;
    setErro(null);
    const user_id = (novo.user_id || "").trim();
    if (!user_id) return setErro("Informe o user_id (UUID do auth.users).");

    setLoading(true);
    const payload = {
      user_id,
      organizacao_id: orgId,
      perfil: novo.perfil,
      programa_id: novo.programa_id || null,
      grupo_id: novo.grupo_id || null,
      ativo: true,
    };

    const { error } = await supabase.from("meritus_usuarios").insert(payload);
    if (error) setErro(error.message);

    setNovo({ user_id: "", perfil: "relatorio", programa_id: "", grupo_id: "", ativo: true });
    await carregar();
    setLoading(false);
  }

  async function salvar() {
    if (!editId) return;
    setErro(null);
    const user_id = (edit.user_id || "").trim();
    if (!user_id) return setErro("Informe o user_id.");

    setLoading(true);
    const { error } = await supabase
      .from("meritus_usuarios")
      .update({
        user_id,
        perfil: edit.perfil,
        programa_id: edit.programa_id || null,
        grupo_id: edit.grupo_id || null,
        ativo: !!edit.ativo,
      })
      .eq("id", editId);

    if (error) setErro(error.message);
    cancelEdit();
    await carregar();
    setLoading(false);
  }

  async function toggleAtivo(r) {
    setErro(null);
    setLoading(true);
    const { error } = await supabase.from("meritus_usuarios").update({ ativo: !r.ativo }).eq("id", r.id);
    if (error) setErro(error.message);
    await carregar();
    setLoading(false);
  }

  const programaNome = useMemo(() => Object.fromEntries(programas.map((p) => [p.id, p.nome])), [programas]);
  const grupoNome = useMemo(() => Object.fromEntries(grupos.map((g) => [g.id, g.nome])), [grupos]);

  return (
    <RequireRole allow={["admin"]}>
      <div className="space-y-4">
        <PageTitle
          title="Cadastros • Usuários"
          subtitle="Vínculo do usuário do Supabase Auth (user_id) com perfil e escopo na organização."
          right={
            <Button variant="secondary" onClick={carregar} disabled={loading || !orgId}>
              Recarregar
            </Button>
          }
        />

        <Card className="space-y-3">
          <div className="text-xs text-black/60">
            Dica: o <b>login/senha</b> é gerenciado no Supabase Auth. Aqui você controla <b>perfil</b> e acesso.
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <div className="md:col-span-2">
              <div className="text-xs text-black/60 mb-1">user_id (UUID)</div>
              <Input value={novo.user_id} onChange={(e) => setNovo((s) => ({ ...s, user_id: e.target.value }))} placeholder="UUID do auth.users" />
            </div>

            <div>
              <div className="text-xs text-black/60 mb-1">Perfil</div>
              <Select value={novo.perfil} onChange={(e) => setNovo((s) => ({ ...s, perfil: e.target.value }))}>
                {PERFIS.map((p) => (
                  <option key={p.v} value={p.v}>
                    {p.t}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <div className="text-xs text-black/60 mb-1">Programa (opcional)</div>
              <Select value={novo.programa_id} onChange={(e) => setNovo((s) => ({ ...s, programa_id: e.target.value }))}>
                <option value="">(todos)</option>
                {programas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <div className="md:col-span-2" />
            <div className="md:col-span-2">
              <div className="text-xs text-black/60 mb-1">Grupo (opcional)</div>
              <Select value={novo.grupo_id} onChange={(e) => setNovo((s) => ({ ...s, grupo_id: e.target.value }))}>
                <option value="">(todos)</option>
                {grupos.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nome}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={criar} disabled={loading || !orgId}>
              Adicionar
            </Button>
          </div>

          {erro ? <div className="text-sm text-red-600">{erro}</div> : null}
        </Card>

        <Card className="p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-black/10 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">Lista</div>
              <div className="text-xs text-black/50">Admin vê tudo; Fiscal/Relatório são definidos por perfil.</div>
            </div>
            <div className="text-xs text-black/50">{loading ? "Atualizando..." : `${rows.length} usuários`}</div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-black/5 text-black/60">
                  <th className="text-left px-5 py-3">Perfil</th>
                  <th className="text-left px-5 py-3">user_id</th>
                  <th className="text-left px-5 py-3">Programa</th>
                  <th className="text-left px-5 py-3">Grupo</th>
                  <th className="text-left px-5 py-3">Status</th>
                  <th className="text-right px-5 py-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const editing = editId === r.id;
                  return (
                    <tr key={r.id} className="border-t border-black/5 hover:bg-black/[0.03]">
                      <td className="px-5 py-3">
                        {editing ? (
                          <Select value={edit.perfil} onChange={(e) => setEdit((s) => ({ ...s, perfil: e.target.value }))}>
                            {PERFIS.map((p) => (
                              <option key={p.v} value={p.v}>
                                {p.t}
                              </option>
                            ))}
                          </Select>
                        ) : (
                          <span className="font-semibold">{r.perfil}</span>
                        )}
                      </td>

                      <td className="px-5 py-3 text-black/70">
                        {editing ? <Input value={edit.user_id} onChange={(e) => setEdit((s) => ({ ...s, user_id: e.target.value }))} /> : r.user_id}
                      </td>

                      <td className="px-5 py-3">
                        {editing ? (
                          <Select value={edit.programa_id || ""} onChange={(e) => setEdit((s) => ({ ...s, programa_id: e.target.value }))}>
                            <option value="">(todos)</option>
                            {programas.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.nome}
                              </option>
                            ))}
                          </Select>
                        ) : (
                          <span className="text-black/60">{r.programa_id ? (programaNome[r.programa_id] || "—") : "(todos)"}</span>
                        )}
                      </td>

                      <td className="px-5 py-3">
                        {editing ? (
                          <Select value={edit.grupo_id || ""} onChange={(e) => setEdit((s) => ({ ...s, grupo_id: e.target.value }))}>
                            <option value="">(todos)</option>
                            {grupos.map((g) => (
                              <option key={g.id} value={g.id}>
                                {g.nome}
                              </option>
                            ))}
                          </Select>
                        ) : (
                          <span className="text-black/60">{r.grupo_id ? (grupoNome[r.grupo_id] || "—") : "(todos)"}</span>
                        )}
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
                    <td colSpan={6} className="px-5 py-10 text-center text-black/60">{loading ? "Carregando..." : "Nenhum usuário cadastrado."}</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>

        {erro ? <div className="text-sm text-red-600">{erro}</div> : null}
      </div>
    </RequireRole>
  );
}
