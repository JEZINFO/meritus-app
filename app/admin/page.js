"use client";

import { useEffect, useMemo, useState } from "react";
import RequireRole from "../../components/admin/RequireRole";
import { supabase } from "../../src/lib/supabase";
import { useProgram } from "../../components/admin/ProgramContext";
import { Card, PageTitle, Button, Badge, Select } from "../../components/admin/ui";

function fmtDate(d) {
  if (!d) return "-";
  try {
    return new Date(d).toLocaleDateString("pt-BR");
  } catch {
    return String(d);
  }
}

function fmtNum(n) {
  const v = Number(n || 0);
  return v.toLocaleString("pt-BR");
}

function fmtPts(n) {
  const v = Number(n || 0);
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export default function AdminHome() {
  const { programas, programaId, setProgramaId, loadingProgramas } = useProgram();

  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);

  const [periodoAberto, setPeriodoAberto] = useState(null);
  const [kpis, setKpis] = useState({
    participantes: 0,
    grupos: 0,
    lancamentos: 0,
    pontos: 0,
    ultimaAtividade: null,
  });

  const [topParticipantes, setTopParticipantes] = useState([]);
  const [topGrupos, setTopGrupos] = useState([]);

  const programaAtual = useMemo(() => programas.find((p) => p.id === programaId) || null, [programas, programaId]);

  async function carregar() {
    if (!programaId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setErro(null);

    // 1) Período aberto mais recente
    const { data: per, error: perErr } = await supabase
      .from("meritus_periodos")
      .select("id,rotulo,inicio,fim,status")
      .eq("programa_id", programaId)
      .eq("status", "aberto")
      .order("inicio", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (perErr) {
      setErro(perErr.message);
      setLoading(false);
      return;
    }

    setPeriodoAberto(per || null);

    // 2) Counts simples
    const [{ count: cPart, error: ePart }, { count: cGrupos, error: eGr }, { count: cLanc, error: eLanc }] =
      await Promise.all([
        supabase
          .from("meritus_participantes")
          .select("id", { count: "exact", head: true })
          .eq("programa_id", programaId)
          .eq("ativo", true),
        supabase
          .from("meritus_grupos")
          .select("id", { count: "exact", head: true })
          .eq("programa_id", programaId)
          .eq("ativo", true),
        per?.id
          ? supabase
              .from("meritus_lancamentos")
              .select("id", { count: "exact", head: true })
              .eq("programa_id", programaId)
              .eq("periodo_id", per.id)
          : Promise.resolve({ count: 0, error: null }),
      ]);

    if (ePart || eGr || eLanc) {
      setErro((ePart || eGr || eLanc).message);
      setLoading(false);
      return;
    }

    // 3) Para pontos/top: trazemos dados do período aberto (se existir)
    let pontosTotal = 0;
    let ultimaAtividade = null;
    let topsP = [];
    let topsG = [];

    if (per?.id) {
      // Lancamentos (limit razoável) + joins separados para nomes
      const { data: lancs, error: eL } = await supabase
        .from("meritus_lancamentos")
        .select("id,participante_id,pontos_calculados,criado_em")
        .eq("programa_id", programaId)
        .eq("periodo_id", per.id)
        .order("criado_em", { ascending: false })
        .limit(5000);

      if (eL) {
        setErro(eL.message);
        setLoading(false);
        return;
      }

      const byPart = new Map();
      for (const l of lancs || []) {
        const pts = Number(l.pontos_calculados || 0);
        pontosTotal += pts;
        const pid = l.participante_id;
        byPart.set(pid, (byPart.get(pid) || 0) + pts);
        if (!ultimaAtividade) ultimaAtividade = l.criado_em;
      }

      // Top participantes (IDs -> nomes)
      const topPartIds = [...byPart.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([id]) => id);

      if (topPartIds.length) {
        const { data: parts, error: eP } = await supabase
          .from("meritus_participantes")
          .select("id,nome,grupo_id")
          .in("id", topPartIds);

        if (eP) {
          setErro(eP.message);
          setLoading(false);
          return;
        }

        const partMap = new Map((parts || []).map((p) => [p.id, p]));
        topsP = topPartIds.map((id) => ({
          id,
          nome: partMap.get(id)?.nome || "Participante",
          pontos: byPart.get(id) || 0,
          grupo_id: partMap.get(id)?.grupo_id || null,
        }));
      }

      // Top grupos (via participantes->grupo)
      const groupScore = new Map();
      for (const t of topsP) {
        if (!t.grupo_id) continue;
        groupScore.set(t.grupo_id, (groupScore.get(t.grupo_id) || 0) + Number(t.pontos || 0));
      }

      // Se quisermos mais real, buscar TODOS participantes do programa para agregar por grupo
      // (mantemos leve: agregamos usando todos lancamentos mapeando participantes->grupo)
      const partIdsAll = [...new Set((lancs || []).map((l) => l.participante_id))].slice(0, 4000);
      if (partIdsAll.length) {
        const { data: partsAll, error: ePA } = await supabase
          .from("meritus_participantes")
          .select("id,grupo_id")
          .in("id", partIdsAll);

        if (!ePA) {
          const pid2g = new Map((partsAll || []).map((p) => [p.id, p.grupo_id]));
          const gScore = new Map();
          for (const l of lancs || []) {
            const gid = pid2g.get(l.participante_id);
            if (!gid) continue;
            gScore.set(gid, (gScore.get(gid) || 0) + Number(l.pontos_calculados || 0));
          }

          const topGids = [...gScore.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id]) => id);

          if (topGids.length) {
            const { data: gs, error: eG } = await supabase.from("meritus_grupos").select("id,nome").in("id", topGids);
            if (!eG) {
              const gMap = new Map((gs || []).map((g) => [g.id, g.nome]));
              topsG = topGids.map((id) => ({ id, nome: gMap.get(id) || "Grupo", pontos: gScore.get(id) || 0 }));
            }
          }
        }
      }
    }

    setKpis({
      participantes: cPart || 0,
      grupos: cGrupos || 0,
      lancamentos: cLanc || 0,
      pontos: pontosTotal,
      ultimaAtividade,
    });

    setTopParticipantes(topsP);
    setTopGrupos(topsG);

    setLoading(false);
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programaId]);

  return (
    <RequireRole allow={["admin", "fiscal", "relatorio"]}>
      <div className="space-y-4">
        <PageTitle title="Dashboard Executivo" subtitle="Visão rápida: saúde do programa, período e destaques." />

        <Card>
          <div className="flex flex-col md:flex-row gap-3 md:items-end md:justify-between">
            <div className="flex-1">
              <label className="text-xs text-black/50">Programa</label>
              <Select
                value={programaId || ""}
                onChange={(e) => setProgramaId(e.target.value)}
                disabled={loadingProgramas}
              >
                {(programas || []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex items-center gap-2">
              {programaAtual ? <Badge>{programaAtual.nome}</Badge> : null}
              <Button onClick={carregar} disabled={loading || !programaId}>
                Atualizar
              </Button>
            </div>
          </div>

          {erro ? <div className="mt-3 text-sm text-red-600">{erro}</div> : null}
        </Card>

        <div className="grid md:grid-cols-4 gap-3">
          <Card>
            <div className="text-xs text-black/50">Período aberto</div>
            <div className="mt-1 text-lg font-semibold">{periodoAberto?.rotulo || "—"}</div>
            <div className="mt-1 text-xs text-black/60">
              {periodoAberto ? `${fmtDate(periodoAberto.inicio)} → ${fmtDate(periodoAberto.fim)}` : "Sem período aberto"}
            </div>
          </Card>

          <Card>
            <div className="text-xs text-black/50">Participantes ativos</div>
            <div className="mt-1 text-2xl font-semibold">{fmtNum(kpis.participantes)}</div>
          </Card>

          <Card>
            <div className="text-xs text-black/50">Grupos ativos</div>
            <div className="mt-1 text-2xl font-semibold">{fmtNum(kpis.grupos)}</div>
          </Card>

          <Card>
            <div className="text-xs text-black/50">Pontos no período aberto</div>
            <div className="mt-1 text-2xl font-semibold">{fmtPts(kpis.pontos)}</div>
            <div className="mt-1 text-xs text-black/60">{fmtNum(kpis.lancamentos)} lançamentos</div>
          </Card>
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <Card>
            <div className="flex items-center justify-between">
              <div className="font-semibold">Top participantes</div>
              <div className="text-xs text-black/50">
                Última atividade: {kpis.ultimaAtividade ? new Date(kpis.ultimaAtividade).toLocaleString("pt-BR") : "—"}
              </div>
            </div>

            <div className="mt-3 space-y-2">
              {topParticipantes?.length ? (
                topParticipantes.map((p, idx) => (
                  <div key={p.id} className="flex items-center justify-between rounded-xl border border-black/10 px-3 py-2">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-xl bg-black text-white flex items-center justify-center text-sm">
                        {idx + 1}
                      </div>
                      <div>
                        <div className="text-sm font-medium">{p.nome}</div>
                        <div className="text-xs text-black/50">#{String(p.id).slice(0, 8)}</div>
                      </div>
                    </div>
                    <div className="text-sm font-semibold">{fmtPts(p.pontos)}</div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-black/60">Sem dados (abra um período e faça lançamentos).</div>
              )}
            </div>
          </Card>

          <Card>
            <div className="font-semibold">Top grupos</div>
            <div className="mt-3 space-y-2">
              {topGrupos?.length ? (
                topGrupos.map((g, idx) => (
                  <div key={g.id} className="flex items-center justify-between rounded-xl border border-black/10 px-3 py-2">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-xl bg-black/10 flex items-center justify-center text-sm font-semibold">
                        {idx + 1}
                      </div>
                      <div className="text-sm font-medium">{g.nome}</div>
                    </div>
                    <div className="text-sm font-semibold">{fmtPts(g.pontos)}</div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-black/60">Sem dados suficientes para ranking de grupos.</div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </RequireRole>
  );
}
