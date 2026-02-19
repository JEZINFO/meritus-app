"use client";

import { useEffect, useMemo, useState } from "react";
import RequireRole from "../../../components/admin/RequireRole";
import { supabase } from "../../../src/lib/supabase";
import { useProgram } from "../../../components/admin/ProgramContext";
import { PageTitle, Card, Button, Input, Select } from "../../../components/admin/ui";

const ALL = "__ALL__";

function Badge({ children }) {
  return (
    <span className="inline-flex items-center rounded-full border border-black/10 bg-black/[0.04] px-2.5 py-1 text-xs font-medium">
      {children}
    </span>
  );
}

function fmtNumber(n) {
  const v = Number(n ?? 0);
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function downloadCsv(filename, rows) {
  const esc = (v) => {
    const s = String(v ?? "");
    if (/[",;\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const csv = rows.map((r) => r.map(esc).join(";")).join("\n") + "\n";
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
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

  const [loading, setLoading] = useState(true);
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
      setErro("");

      const { data: gData, error: gErr } = await supabase
        .from("meritus_grupos")
        .select("id, nome, ativo")
        .eq("programa_id", programaId)
        .order("nome", { ascending: true });

      if (!alive) return;
      if (gErr) {
        setErro(gErr.message || "Erro ao carregar grupos");
        setLoading(false);
        return;
      }

      const { data: pData, error: pErr } = await supabase
        .from("meritus_periodos")
        .select("id, rotulo, inicio, fim, status")
        .eq("programa_id", programaId)
        .order("inicio", { ascending: false });

      if (!alive) return;
      if (pErr) {
        setErro(pErr.message || "Erro ao carregar períodos");
        setLoading(false);
        return;
      }

      setGrupos(Array.isArray(gData) ? gData : []);
      setPeriodos(Array.isArray(pData) ? pData : []);
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

      let partsQuery = supabase
        .from("meritus_participantes")
        .select("id, nome, ativo, grupo_id")
        .eq("programa_id", programaId)
        .eq("ativo", true)
        .order("nome", { ascending: true });

      if (grupoId !== ALL) partsQuery = partsQuery.eq("grupo_id", grupoId);

      const { data: parts, error: partsErr } = await partsQuery;
      if (!alive) return;
      if (partsErr) {
        setErro(partsErr.message || "Erro ao carregar participantes");
        setLoading(false);
        return;
      }

      const partList = Array.isArray(parts) ? parts : [];
      const partIds = partList.map((p) => p.id);

      if (partIds.length === 0) {
        setRows([]);
        setLoading(false);
        return;
      }

      let lQuery = supabase
        .from("meritus_lancamentos")
        .select("participante_id, periodo_id, pontos_calculados")
        .eq("programa_id", programaId)
        .in("participante_id", partIds);

      if (periodoId !== ALL) lQuery = lQuery.eq("periodo_id", periodoId);

      const { data: lancs, error: lErr } = await lQuery;
      if (!alive) return;
      if (lErr) {
        setErro(lErr.message || "Erro ao carregar lançamentos");
        setLoading(false);
        return;
      }

      const pontosPorPart = new Map();
      (Array.isArray(lancs) ? lancs : []).forEach((l) => {
        const k = l.participante_id;
        const cur = Number(pontosPorPart.get(k) ?? 0);
        pontosPorPart.set(k, cur + Number(l.pontos_calculados ?? 0));
      });

      const gruposMap = new Map((Array.isArray(grupos) ? grupos : []).map((g) => [g.id, g.nome]));

      const computed = partList
        .map((p) => ({
          participante_id: p.id,
          participante_nome: p.nome,
          grupo_id: p.grupo_id,
          grupo_nome: gruposMap.get(p.grupo_id) || "—",
          pontos: Number(pontosPorPart.get(p.id) ?? 0),
        }))
        .sort((a, b) => b.pontos - a.pontos || a.participante_nome.localeCompare(b.participante_nome));

      setRows(computed);
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
      (r) => r.participante_nome.toLowerCase().includes(q) || r.grupo_nome.toLowerCase().includes(q)
    );
  }, [rows, busca]);

  const top3 = filtered.slice(0, 3);
  const totalPontos = useMemo(() => filtered.reduce((acc, r) => acc + Number(r.pontos || 0), 0), [filtered]);
  const totalParticipantes = filtered.length;

  function exportarCsv() {
    const now = new Date();
    const stamp =
      now.getFullYear() +
      "-" +
      String(now.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(now.getDate()).padStart(2, "0") +
      "_" +
      String(now.getHours()).padStart(2, "0") +
      String(now.getMinutes()).padStart(2, "0");

    const header = ["Posição", "Participante", "Grupo", "Pontos"];
    const body = filtered.map((r, idx) => [idx + 1, r.participante_nome, r.grupo_nome, fmtNumber(r.pontos)]);
    downloadCsv(`meritus_ranking_${stamp}.csv`, [header, ...body]);
  }

  return (
    <div className="space-y-4">
      <PageTitle title="Ranking" subtitle="Resumo premium de pontuação por participante (com filtros e exportação)." />

      {!programaId && (
        <Card>
          <div className="p-4">
            <div className="text-sm text-black/60">Selecione um programa no topo para visualizar o ranking.</div>
          </div>
        </Card>
      )}

      {programaId && (
        <>
          <Card>
            <div className="space-y-3">
              <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full">
                  <div>
                    <div className="text-xs font-medium text-black/60 mb-1">Grupo</div>
                    <Select value={grupoId} onChange={(e) => setGrupoId(e.target.value)}>
                      <option value={ALL}>Todos</option>
                      {(grupos || [])
                        .filter((g) => g.ativo)
                        .map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.nome}
                          </option>
                        ))}
                    </Select>
                  </div>

                  <div>
                    <div className="text-xs font-medium text-black/60 mb-1">Período</div>
                    <Select value={periodoId} onChange={(e) => setPeriodoId(e.target.value)}>
                      <option value={ALL}>Todos</option>
                      {(periodos || []).map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.rotulo} ({p.status})
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div>
                    <div className="text-xs font-medium text-black/60 mb-1">Buscar</div>
                    <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome ou grupo..." />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button onClick={exportarCsv} variant="secondary">
                    Exportar CSV
                  </Button>
                </div>
              </div>

              {erro ? <div className="text-sm text-red-600">{erro}</div> : null}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Card className="p-3">
                  <div className="text-xs text-black/60">Participantes</div>
                  <div className="text-2xl font-semibold">{fmtNumber(totalParticipantes)}</div>
                </Card>
                <Card className="p-3">
                  <div className="text-xs text-black/60">Pontos totais</div>
                  <div className="text-2xl font-semibold">{fmtNumber(totalPontos)}</div>
                </Card>
                <Card className="p-3">
                  <div className="text-xs text-black/60">Média</div>
                  <div className="text-2xl font-semibold">
                    {totalParticipantes ? fmtNumber(totalPontos / totalParticipantes) : "0"}
                  </div>
                </Card>
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[1, 2, 3].map((pos) => {
              const r = top3[pos - 1];
              return (
                <Card key={pos}>
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold">#{pos}</div>
                    <Badge>{pos === 1 ? "Top 1" : pos === 2 ? "Top 2" : "Top 3"}</Badge>
                  </div>

                  <div className="mt-3">
                    <div className="text-lg font-semibold truncate">{r?.participante_nome || "—"}</div>
                    <div className="text-sm text-black/60 truncate">{r?.grupo_nome || "—"}</div>
                    <div className="mt-2 text-2xl font-semibold">{fmtNumber(r?.pontos ?? 0)}</div>
                  </div>
                </Card>
              );
            })}
          </div>

          <Card>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">Classificação</div>
                <div className="text-xs text-black/60">Ordenado por pontos (desc).</div>
              </div>
              {loading ? <div className="text-xs text-black/60">Carregando…</div> : null}
            </div>

            <div className="mt-3 overflow-auto">
              <table className="min-w-[700px] w-full text-sm">
                <thead>
                  <tr className="text-left text-black/60">
                    <th className="py-2 pr-3 w-[90px]">Pos.</th>
                    <th className="py-2 pr-3">Participante</th>
                    <th className="py-2 pr-3">Grupo</th>
                    <th className="py-2 pr-3 w-[140px] text-right">Pontos</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td className="py-6 text-black/60" colSpan={4}>
                        Nenhum resultado para os filtros atuais.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((r, idx) => (
                      <tr key={r.participante_id} className="border-t border-black/10">
                        <td className="py-2 pr-3 font-medium">#{idx + 1}</td>
                        <td className="py-2 pr-3">
                          <div className="font-medium">{r.participante_nome}</div>
                        </td>
                        <td className="py-2 pr-3">{r.grupo_nome}</td>
                        <td className="py-2 pr-3 text-right font-semibold">{fmtNumber(r.pontos)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
