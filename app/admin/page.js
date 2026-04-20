"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/src/lib/supabase";

export default function Dashboard() {
  const [rows, setRows] = useState([]);
  const [rowsFiltrados, setRowsFiltrados] = useState([]);
  const [loading, setLoading] = useState(true);

  const [grupos, setGrupos] = useState([]);
  const [grupoSel, setGrupoSel] = useState("__ALL__");

  const [modal, setModal] = useState({
    open: false,
    tipo: null,
    nome: "",
    data: [],
  });

  useEffect(() => {
    carregar();
  }, []);

  useEffect(() => {
    aplicarFiltro();
  }, [grupoSel, rows]);

  function aplicarFiltro() {
    if (grupoSel === "__ALL__") {
      setRowsFiltrados(rows);
    } else {
      setRowsFiltrados(rows.filter((r) => r.grupo_id === grupoSel));
    }
  }

  async function carregar() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    // 🔥 pega vínculo do usuário
    const { data: usuario } = await supabase
      .from("usuarios")
      .select("perfil, grupo_id")
      .eq("id", user.id)
      .single();

    const isAdmin = usuario?.perfil === "admin";

    // 🔥 grupos disponíveis
    const { data: gruposData } = await supabase
      .from("meritus_grupos")
      .select("id,nome")
      .eq("ativo", true);

    let gruposPermitidos = gruposData || [];

    if (!isAdmin && usuario?.grupo_id) {
      gruposPermitidos = gruposPermitidos.filter(
        (g) => g.id === usuario.grupo_id
      );
      setGrupoSel(usuario.grupo_id);
    }

    setGrupos(gruposPermitidos);

    // 🔥 PARTICIPANTES + GRUPO
const { data: participantes } = await supabase
  .from("meritus_participantes")
  .select(`
    id,
    nome,
    grupo_id,
    programa_id,
    meritus_grupos!inner(
      id,
      nome,
      ativo,
      programa_id
    )
  `)
  .eq("ativo", true)
  .eq("meritus_grupos.ativo", true);

    // 🔥 LANÇAMENTOS
    const { data: lancs } = await supabase
      .from("meritus_lancamentos")
      .select("participante_id");

    // 🔥 PONTOS
    const { data: pontosView } = await supabase
      .from("vw_pontos_participante")
      .select("participante_id, pontos");

    // 🔥 PENDÊNCIAS
    const { data: pendencias } = await supabase
      .from("vw_pendencias_participante")
      .select("participante_id");

    const map = new Map();

    participantes.forEach((p) => {
      map.set(p.id, {
        participante_id: p.id,
        nome: p.nome,
        grupo: p.meritus_grupos?.nome || "-",
        grupo_id: p.grupo_id,
        pontos: 0,
        lancamentos: 0,
        pendencias: 0,
      });
    });

    // lançamentos
    lancs.forEach((l) => {
      const p = map.get(l.participante_id);
      if (!p) return;
      p.lancamentos += 1;
    });

    // pontos
    pontosView.forEach((pv) => {
      const p = map.get(pv.participante_id);
      if (!p) return;
      p.pontos = Number(pv.pontos || 0);
    });

    // pendências
    pendencias.forEach((p) => {
      const row = map.get(p.participante_id);
      if (!row) return;
      row.pendencias += 1;
    });

    setRows([...map.values()]);
    setLoading(false);
  }

  async function abrirLancamentos(p) {
    const { data } = await supabase
      .from("meritus_lancamentos")
      .select(`
        pontos_calculados,
        criado_em,
        meritus_criterios(nome),
        meritus_periodos(rotulo)
      `)
      .eq("participante_id", p.participante_id)
      .order("criado_em", { ascending: false });

    setModal({
      open: true,
      tipo: "lanc",
      nome: p.nome,
      data: data || [],
    });
  }

  async function abrirPendencias(p) {
    const { data } = await supabase
      .from("vw_pendencias_participante")
      .select("*")
      .eq("participante_id", p.participante_id);

    setModal({
      open: true,
      tipo: "pend",
      nome: p.nome,
      data: data || [],
    });
  }

  if (loading) return <div className="p-6">Carregando...</div>;

  return (
    <div className="p-6 text-white">
      <h1 className="text-xl mb-4">Dashboard</h1>

      {/* 🔥 FILTRO DE GRUPO */}
      <div className="mb-4">
        <select
  className="px-3 py-2 rounded-lg bg-zinc-900 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
  value={grupoSel}
  onChange={(e) => setGrupoSel(e.target.value)}
>
  <option value="__ALL__" className="bg-zinc-900 text-white">
    Todos os grupos
  </option>

  {grupos.map((g) => (
    <option key={g.id} value={g.id} className="bg-zinc-900 text-white">
      {g.nome}
    </option>
  ))}
</select>
      </div>

      <table className="w-full text-sm">
<thead>
  <tr className="border-b border-white/20 text-white/70 text-xs uppercase tracking-wide">
    <th className="py-2 text-left">Nome</th>
    <th className="py-2 text-left">Grupo</th>
    <th className="py-2 text-left">Pontos</th>
    <th className="py-2 text-left">Lançamentos</th>
    <th className="py-2 text-left">Pendência</th>
  </tr>
</thead>

        <tbody>
          {rowsFiltrados.map((p) => (
            <tr key={p.participante_id} className="border-b border-white/10">
              <td>{p.nome}</td>
              <td>{p.grupo}</td>
              <td>{p.pontos}</td>

              <td>
                <button
                  className="text-blue-400 underline"
                  onClick={() => abrirLancamentos(p)}
                >
                  {p.lancamentos}
                </button>
              </td>

              <td>
                <button
                  className={
                    p.pendencias > 0
                      ? "text-red-400 underline"
                      : "text-green-400 underline"
                  }
                  onClick={() => abrirPendencias(p)}
                >
                  {p.pendencias > 0 ? p.pendencias : "OK"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* MODAL */}
      {modal.open && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center">
          <div className="bg-zinc-900 p-6 rounded-xl w-[700px] max-h-[80vh] overflow-auto">
            <div className="flex justify-between mb-4">
              <h2 className="font-bold">
                {modal.tipo === "lanc" ? "Lançamentos" : "Pendências"} — {modal.nome}
              </h2>
              <button onClick={() => setModal({ open: false })}>✕</button>
            </div>

            {modal.tipo === "lanc" &&
              modal.data.map((l, i) => (
                <div key={i} className="mb-2 border-b border-white/10 pb-1">
                  {l.meritus_periodos?.rotulo} | {l.meritus_criterios?.nome} | {l.pontos_calculados}
                </div>
              ))}

            {modal.tipo === "pend" &&
              modal.data.map((l, i) => (
                <div key={i} className="mb-2 border-b border-white/10 pb-1 text-red-400">
                  {l.periodo} | {l.criterio} | {l.tipo_pendencia}
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}