"use client";

import { useEffect, useMemo, useState } from "react";
import RequireRole from "@/components/admin/RequireRole";
import { supabase } from "@/src/lib/supabase";
import { PageTitle, Card, Button, Input, Select, Badge } from "@/components/admin/ui";

const PERFIS = [
  { value: "admin", label: "Admin" },
  { value: "fiscal", label: "Fiscal" },
  { value: "relatorio", label: "Relatório" },
];

function fmtTs(v) {
  if (!v) return "";
  const d = new Date(v);
  return isNaN(d.getTime()) ? String(v) : d.toLocaleString("pt-BR");
}

function pickNome(v) {
  return String(v || "").trim();
}

export default function AdminUsuariosPage() {
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [ok, setOk] = useState(null);

  const [q, setQ] = useState("");
  const [somentePendentes, setSomentePendentes] = useState(false);

  const [rows, setRows] = useState([]);

  // edição
  const [editId, setEditId] = useState(null);
  const [editNome, setEditNome] = useState("");
  const [editPerfil, setEditPerfil] = useState("fiscal");
  const [editAtivo, setEditAtivo] = useState(true);

  const filtrados = useMemo(() => {
    const qq = String(q || "").trim().toLowerCase();
    let arr = rows;
    if (somentePendentes) arr = arr.filter((r) => !r.ativo);
    if (!qq) return arr;
    return arr.filter((r) => {
      const nm = String(r.nome || "").toLowerCase();
      const em = String(r.email || "").toLowerCase();
      return nm.includes(qq) || em.includes(qq);
    });
  }, [rows, q, somentePendentes]);

  async function carregar() {
    setLoading(true);
    setErro(null);
    setOk(null);

    const { data, error } = await supabase.rpc("admin_list_meritus_users");
    if (error) {
      setErro(error.message);
      setLoading(false);
      return;
    }

    setRows(data || []);
    setLoading(false);
  }

  useEffect(() => {
    carregar();
  }, []);

  function iniciarEdicao(r) {
    setErro(null);
    setOk(null);
    setEditId(r.id);
    setEditNome(pickNome(r.nome));
    setEditPerfil(r.perfil || "fiscal");
    setEditAtivo(!!r.ativo);
  }

  function cancelarEdicao() {
    setEditId(null);
    setEditNome("");
    setEditPerfil("fiscal");
    setEditAtivo(true);
  }

  async function salvarEdicao() {
    setErro(null);
    setOk(null);

    const nome = pickNome(editNome);
    if (!nome) {
      setErro("Informe o nome.");
      return;
    }

    // 1) Atualiza nome no auth.users (meta) via RPC (admin)
    const { error: e1 } = await supabase.rpc("admin_set_meritus_user_nome", {
      p_user: editId,
      p_nome: nome,
    });

    if (e1) {
      setErro(e1.message);
      return;
    }

    // 2) Atualiza perfil/ativo na tabela meritus_usuarios
    const { error: e2 } = await supabase
      .from("meritus_usuarios")
      .update({ perfil: editPerfil, ativo: editAtivo })
      .eq("id", editId);

    if (e2) {
      setErro(e2.message);
      return;
    }

    setOk("Usuário atualizado.");
    cancelarEdicao();
    await carregar();
  }

  async function aprovarRapido(id) {
    setErro(null);
    setOk(null);
    const { error } = await supabase.from("meritus_usuarios").update({ ativo: true }).eq("id", id);
    if (error) {
      setErro(error.message);
      return;
    }
    setOk("Usuário aprovado.");
    await carregar();
  }

  async function desativarRapido(id) {
    setErro(null);
    setOk(null);
    const { error } = await supabase.from("meritus_usuarios").update({ ativo: false }).eq("id", id);
    if (error) {
      setErro(error.message);
      return;
    }
    setOk("Usuário desativado.");
    await carregar();
  }


async function excluirUsuario(r) {
  const okConfirm = window.confirm(
    `Excluir o usuário?\n\nNome: ${r.nome || ""}\nE-mail: ${r.email || ""}\n\nEssa ação remove o usuário do Meritus e do Supabase Auth.`
  );
  if (!okConfirm) return;

  setErro(null);
  setOk(null);

  const res = await fetch("/api/meritus/admin/delete-user", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: r.id }),
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    setErro(payload?.error || "Falha ao excluir usuário.");
    return;
  }

  setOk("Usuário excluído.");
  if (editId === r.id) cancelarEdicao();
  await carregar();
}

  return (
    <RequireRole allow={["admin"]}>
      <div className="space-y-4">
        <PageTitle
          title="Usuários"
          subtitle="Aprovação e gerenciamento. Nome vem do Auth; permissões ficam no Meritus."
        />

        <Card>
          <div className="flex flex-col md:flex-row gap-2 md:items-end md:justify-between">
            <div className="flex-1">
              <label className="text-xs text-white/55">Buscar (nome ou e-mail)</label>
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Ex.: João ou joao@email.com"
              />
            </div>

            <div className="flex items-center gap-3">
              <label className="text-sm text-white/70 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={somentePendentes}
                  onChange={(e) => setSomentePendentes(e.target.checked)}
                />
                Somente pendentes
              </label>
              <Button onClick={carregar} disabled={loading}>
                Atualizar
              </Button>
            </div>
          </div>

          {erro ? <div className="mt-3 text-sm text-red-600">{erro}</div> : null}
          {ok ? <div className="mt-3 text-sm text-emerald-700">{ok}</div> : null}
        </Card>

        {editId ? (
          <Card>
            <div className="flex items-center justify-between gap-2">
              <div className="font-semibold">Editar usuário</div>
              <Button variant="ghost" onClick={cancelarEdicao}>
                Fechar
              </Button>
            </div>

            <div className="mt-3 grid md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <label className="text-xs text-white/55">Nome</label>
                <Input value={editNome} onChange={(e) => setEditNome(e.target.value)} placeholder="Nome completo" />
                <div className="mt-1 text-[11px] text-black/45">
                  Salvo no <span className="font-mono">auth.users.raw_user_meta_data.nome</span>
                </div>
              </div>

              <div>
                <label className="text-xs text-white/55">Perfil</label>
                <Select value={editPerfil} onChange={(e) => setEditPerfil(e.target.value)}>
                  {PERFIS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="text-xs text-white/55">Status</label>
                <Select
                  value={editAtivo ? "ativo" : "pendente"}
                  onChange={(e) => setEditAtivo(e.target.value === "ativo")}
                >
                  <option value="ativo">Ativo</option>
                  <option value="pendente">Pendente</option>
                </Select>
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={cancelarEdicao}>
                Cancelar
              </Button>
              <Button onClick={salvarEdicao}>Salvar</Button>
            </div>
          </Card>
        ) : null}

        <Card>
          {loading ? (
            <div className="text-sm text-white/60">Carregando…</div>
          ) : filtrados.length === 0 ? (
            <div className="text-sm text-white/60">Nenhum usuário encontrado.</div>
          ) : (
            <div className="overflow-auto">
              <table className="min-w-[860px] w-full text-sm">
                <thead>
                  <tr className="text-left text-white/55 border-b">
                    <th className="py-2 pr-3">Nome</th>
                    <th className="py-2 pr-3">E-mail</th>
                    <th className="py-2 pr-3">Perfil</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Criado</th>
                    <th className="py-2 pr-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((r) => (
                    <tr key={r.id} className="border-b last:border-b-0">
                      <td className="py-2 pr-3">
                        <div className="font-medium">{r.nome || "-"}</div>
                      </td>
                      <td className="py-2 pr-3">{r.email || "-"}</td>
                      <td className="py-2 pr-3">
                        {r.perfil ? <Badge>{r.perfil}</Badge> : <Badge variant="warn">-</Badge>}
                      </td>
                      <td className="py-2 pr-3">
                        {r.ativo ? <Badge>Ativo</Badge> : <Badge variant="warn">Pendente</Badge>}
                      </td>
                      <td className="py-2 pr-3">{fmtTs(r.criado_em)}</td>
                      <td className="py-2 pr-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" onClick={() => iniciarEdicao(r)}>
                            Editar
                          </Button>

<Button
  variant="ghost"
  className="text-red-600 hover:text-red-700"
  onClick={() => excluirUsuario(r)}
>
  Excluir
</Button>
                          {!r.ativo ? (
                            <Button onClick={() => aprovarRapido(r.id)}>Aprovar</Button>
                          ) : (
                            <Button variant="ghost" onClick={() => desativarRapido(r.id)}>
                              Desativar
                            </Button>
                          )}
                        </div>
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
