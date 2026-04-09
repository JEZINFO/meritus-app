"use client";

import { useEffect, useMemo, useState } from "react";
import RequireRole from "../../../components/admin/RequireRole";
import { supabase } from "../../../src/lib/supabase";
import { useProgram } from "../../../components/admin/ProgramContext";
import { PageTitle, Card, Button, Input, Select } from "../../../components/admin/ui";

const ALL = "__ALL__";

function fmtNumber(n) {
  const v = Number(n ?? 0);
  return v.toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function downloadCsv(filename, rows) {
  const esc = (v) => {
    const s = String(v ?? "");
    if (/[",;\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const csv = rows.map((r) => r.map(esc).join(";")).join("\n") + "\n";

  const blob = new Blob(["\ufeff" + csv], {
    type: "text/csv;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;

  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

export default function Page() {
  return (
    <RequireRole allow={["admin", "relatorio"]}>
      <RankingPremium />
    </RequireRole>
  );
}

function RankingPremium() {
  const { programaId } = useProgram();

  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  const [grupos, setGrupos] = useState([]);
  const [periodos, setPeriodos] = useState([]);

  const [grupoId, setGrupoId] = useState(ALL);
  const [periodoId, setPeriodoId] = useState(ALL);

  const [busca, setBusca] = useState("");
  const [rows, setRows] = useState([]);

  useEffect(() => {
    let alive = true;

    async function loadBase() {
      if (!programaId) return;

      setLoading(true);

      const { data: gData } = await supabase
        .from("meritus_grupos")
        .select("id,nome")
        .eq("programa_id", programaId)
        .eq("ativo", true)
        .order("nome");

      const { data: pData } = await supabase
        .from("meritus_periodos")
        .select("id,rotulo,status")
        .eq("programa_id", programaId)
        .order("inicio", { ascending: false });

      if (!alive) return;

      setGrupos(gData || []);
      setPeriodos(pData || []);

      setLoading(false);
    }

    loadBase();

    return () => {
      alive = false;
    };
  }, [programaId]);

  useEffect(() => {
    let alive = true;

    async function loadRanking() {
      if (!programaId) return;

      setLoading(true);
      setErro("");

      const { data: prog } = await supabase
        .from("meritus_programas")
        .select("organizacao_id")
        .eq("id", programaId)
        .single();

      const { data: org } = await supabase
        .from("meritus_organizacoes")
        .select("codigo")
        .eq("id", prog.organizacao_id)
        .single();

      const codigo = org.codigo;

      const { data, error } = await supabase.rpc("public_ranking", {
        p_codigo: codigo,
        p_programa_id: programaId,
        p_periodo_id: periodoId === ALL ? null : periodoId,
        p_grupo_id: null,
      });

      if (!alive) return;

      if (error) {
        setErro(error.message);
        setRows([]);
        setLoading(false);
        return;
      }

      const ranked = (data || []).map((r, index) => ({
        posicao: index + 1,
        participante_id: r.participante_id,
        participante_nome: r.participante_nome,
        grupo_nome: r.grupo_nome,
        pontos: Number(r.pontos ?? 0),
      }));

      let finalRows = ranked;

      if (grupoId !== ALL) {
        const grupoSelecionado = grupos.find((g) => g.id === grupoId);
        if (grupoSelecionado) {
          finalRows = ranked.filter(
            (r) => r.grupo_nome === grupoSelecionado.nome
          );
        }
      }

      setRows(finalRows);
      setLoading(false);
    }

    loadRanking();

    return () => {
      alive = false;
    };
  }, [programaId, grupoId, periodoId, grupos]);

  const filtered = useMemo(() => {
    const q = busca.trim().toLowerCase();

    if (!q) return rows;

    return rows.filter(
      (r) =>
        r.participante_nome.toLowerCase().includes(q) ||
        r.grupo_nome.toLowerCase().includes(q)
    );
  }, [rows, busca]);

  function exportarCsv() {
    const header = ["Posição", "Participante", "Grupo", "Pontos"];

    const body = filtered.map((r) => [
      r.posicao,
      r.participante_nome,
      r.grupo_nome,
      fmtNumber(r.pontos),
    ]);

    downloadCsv("ranking_meritus.csv", [header, ...body]);
  }

  return (
    <div className="space-y-4">
      <PageTitle
        title="Ranking"
        subtitle="Resumo de pontuação por participante"
      />

      <Card>
        <div className="grid md:grid-cols-3 gap-3">

          <div>
            <div className="text-xs text-white/60 mb-1">Grupo</div>
            <Select value={grupoId} onChange={(e) => setGrupoId(e.target.value)}>
              <option value={ALL}>Todos</option>
              {grupos.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nome}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <div className="text-xs text-white/60 mb-1">Período</div>
            <Select value={periodoId} onChange={(e) => setPeriodoId(e.target.value)}>
              <option value={ALL}>Todos</option>
              {periodos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.rotulo} ({p.status})
                </option>
              ))}
            </Select>
          </div>

          <div>
            <div className="text-xs text-white/60 mb-1">Buscar</div>
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Nome ou grupo"
            />
          </div>
        </div>

        <div className="mt-3">
          <Button variant="secondary" onClick={exportarCsv}>
            Exportar CSV
          </Button>
        </div>
      </Card>

      <Card>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-white/60">
              <th className="py-2">Pos.</th>
              <th>Participante</th>
              <th>Grupo</th>
              <th className="text-right">Pontos</th>
            </tr>
          </thead>

          <tbody>
            {filtered.map((r) => (
              <tr key={r.participante_id} className="border-t border-white/10">
                <td className="py-2">#{r.posicao}</td>
                <td>{r.participante_nome}</td>
                <td>{r.grupo_nome}</td>
                <td className="text-right font-semibold">
                  {fmtNumber(r.pontos)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}