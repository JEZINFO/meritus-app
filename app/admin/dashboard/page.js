"use client";

import { useEffect, useMemo, useState } from "react";
import RequireRole from "@/components/admin/RequireRole";
import { supabase } from "@/src/lib/supabase";
import { useProgram } from "@/components/admin/ProgramContext";
import { Card, PageTitle, Button, Badge, Select, Input } from "@/components/admin/ui";

/**
 * Dashboard Executivo (v6) — visão GLOBAL (independente de período)
 *
 * ✅ Default: "Todos os períodos" (agrega tudo do programa)
 * ✅ Ainda permite filtrar por um período específico se quiser
 * ✅ Detecta presença/material/uniforme via heurística de nomes de critérios
 * ✅ Destaca:
 *   - "Nunca veio" (presenças = 0)
 *   - "Muitas faltas" (presenças muito abaixo do máximo observado)
 *   - Material/Uniforme pendente (último status conhecido no histórico)
 *
 * Compatível com schema:
 * meritus_lancamentos: valor, pontos_calculados, observacao, criado_em
 */

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
function norm(v) {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}
function asBoolFromValor(v) {
  const num = Number(v);
  if (!Number.isNaN(num)) return num > 0;
  const s = String(v ?? "").toLowerCase().trim();
  if (["1", "true", "sim", "ok", "yes"].includes(s)) return true;
  if (["0", "false", "nao", "não", "no"].includes(s)) return false;
  return !!v;
}
function statusPill(ok) {
  return ok
    ? "inline-flex items-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-200"
    : "inline-flex items-center rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-200";
}
function alertPill(level) {
  if (level === "high")
    return "inline-flex items-center rounded-xl border border-[var(--m-danger)]/30 bg-[var(--m-danger)]/10 px-3 py-1 text-xs font-semibold text-[var(--m-danger)]";
  if (level === "mid")
    return "inline-flex items-center rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-200";
  return "inline-flex items-center rounded-xl border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/70";
}
function findIdsByNeedles(criterios, needles) {
  const ns = (needles || []).map((x) => norm(x)).filter(Boolean);
  return (criterios || [])
    .filter((c) => {
      const n = norm(c?.nome);
      return ns.some((needle) => n.includes(needle));
    })
    .map((c) => c.id);
}

export default function AdminHome() {
  const { programas, programaId, setProgramaId, loadingProgramas } = useProgram();

  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);

  // filtros
  const [periodos, setPeriodos] = useState([]);
  const [periodoIdSel, setPeriodoIdSel] = useState("__ALL__"); // default GLOBAL
  const [grupos, setGrupos] = useState([]);
  const [grupoId, setGrupoId] = useState("__ALL__");
  const [participantes, setParticipantes] = useState([]);
  const [participanteId, setParticipanteId] = useState("__ALL__");
  const [qNome, setQNome] = useState("");

  const [agruparPorGrupo, setAgruparPorGrupo] = useState(true);

  const [kpis, setKpis] = useState({
    participantes: 0,
    grupos: 0,
    lancamentos: 0,
    pontos: 0,
    ultimaAtividade: null,
    nuncaVeio: 0,
    alertaFaltas: 0,
    materialPendente: 0,
    uniformePendente: 0,
  });

  const [evolucao, setEvolucao] = useState({
    maxPresencas: 0,
    rows: [],
    criterioDebug: [],
  });

  const programaAtual = useMemo(
    () => (programas || []).find((p) => p.id === programaId) || null,
    [programas, programaId]
  );

  const periodoSelecionado = useMemo(() => {
    if (periodoIdSel === "__ALL__") return { id: "__ALL__", rotulo: "Todos os períodos", status: "global" };
    return (periodos || []).find((p) => p.id === periodoIdSel) || null;
  }, [periodos, periodoIdSel]);

  const gruposMap = useMemo(() => new Map((grupos || []).map((g) => [g.id, g.nome])), [grupos]);
  const partsMap = useMemo(() => new Map((participantes || []).map((p) => [p.id, p])), [participantes]);

  const participantesFiltrados = useMemo(() => {
    let out = participantes || [];
    if (grupoId && grupoId !== "__ALL__") out = out.filter((p) => p.grupo_id === grupoId);
    const q = norm(qNome);
    if (q) out = out.filter((p) => norm(p.nome).includes(q));
    return out;
  }, [participantes, grupoId, qNome]);

  const evolucaoFiltrada = useMemo(() => {
    let out = evolucao.rows || [];
    if (grupoId && grupoId !== "__ALL__") out = out.filter((r) => r.grupo_id === grupoId);
    if (participanteId && participanteId !== "__ALL__") out = out.filter((r) => r.id === participanteId);
    const q = norm(qNome);
    if (q) out = out.filter((r) => norm(r.nome).includes(q));
    return out;
  }, [evolucao.rows, grupoId, participanteId, qNome]);

  const evolucaoPorGrupo = useMemo(() => {
    const map = new Map();
    for (const r of evolucaoFiltrada) {
      const key = r.grupo_nome || "—";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(r);
    }
    const entries = [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], "pt-BR"));
    for (const [, arr] of entries) {
      arr.sort((a, b) => {
        // prioridade executiva: nunca veio, depois alertas, depois pontos
        if (a.nuncaVeio !== b.nuncaVeio) return b.nuncaVeio - a.nuncaVeio;
        const aAlert = a.alert === "high" ? 2 : a.alert === "mid" ? 1 : 0;
        const bAlert = b.alert === "high" ? 2 : b.alert === "mid" ? 1 : 0;
        if (aAlert !== bAlert) return bAlert - aAlert;
        if (a.pontos !== b.pontos) return b.pontos - a.pontos;
        return a.nome.localeCompare(b.nome, "pt-BR");
      });
    }
    return entries;
  }, [evolucaoFiltrada]);

  const resumoPorGrupo = useMemo(() => {
    const byG = new Map();
    for (const r of evolucaoFiltrada) {
      const gid = r.grupo_id || "__NONE__";
      const nome = r.grupo_nome || "—";
      if (!byG.has(gid)) {
        byG.set(gid, {
          grupo_id: gid,
          grupo_nome: nome,
          participantes: 0,
          pontos: 0,
          nuncaVeio: 0,
          alertHigh: 0,
          alertMid: 0,
          materialPendente: 0,
          uniformePendente: 0,
        });
      }
      const g = byG.get(gid);
      g.participantes += 1;
      g.pontos += Number(r.pontos || 0);
      if (r.nuncaVeio) g.nuncaVeio += 1;
      if (r.alert === "high") g.alertHigh += 1;
      else if (r.alert === "mid") g.alertMid += 1;
      if (r.materialOk === false) g.materialPendente += 1;
      if (r.uniformeOk === false) g.uniformePendente += 1;
    }
    const arr = [...byG.values()].sort((a, b) => b.pontos - a.pontos || a.grupo_nome.localeCompare(b.grupo_nome, "pt-BR"));
    for (const g of arr) g.mediaPorParticipante = g.participantes ? g.pontos / g.participantes : 0;
    return arr;
  }, [evolucaoFiltrada]);

  async function carregarBase() {
    if (!programaId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setErro(null);

    // períodos (para opcionalmente filtrar)
    const { data: pers, error: ePer } = await supabase
      .from("meritus_periodos")
      .select("id,rotulo,inicio,fim,status")
      .eq("programa_id", programaId)
      .order("inicio", { ascending: false })
      .limit(200);

    if (ePer) {
      setErro(ePer.message);
      setLoading(false);
      return;
    }
    setPeriodos(pers || []);

    // grupos + participantes
    const [{ data: gs, error: eG }, { data: ps, error: eP }] = await Promise.all([
      supabase
        .from("meritus_grupos")
        .select("id,nome,ativo")
        .eq("programa_id", programaId)
        .eq("ativo", true)
        .order("nome", { ascending: true })
        .limit(5000),
      supabase
        .from("meritus_participantes")
        .select("id,nome,ativo,grupo_id,programa_id")
        .eq("programa_id", programaId)
        .eq("ativo", true)
        .order("nome", { ascending: true })
        .limit(5000),
    ]);

    if (eG || eP) {
      setErro((eG || eP).message);
      setLoading(false);
      return;
    }

    setGrupos(gs || []);
    setParticipantes(ps || []);

    setLoading(false);
  }

  async function carregarEvolucaoGlobal() {
    if (!programaId) {
      setEvolucao({ maxPresencas: 0, rows: [], criterioDebug: [] });
      setKpis((k) => ({ ...k, lancamentos: 0, pontos: 0, ultimaAtividade: null }));
      return;
    }

    setErro(null);
    setLoading(true);

    // critérios: para detectar presença/material/uniforme
    let criterios = [];
    let criterioDebug = [];
    const { data: critData, error: eC } = await supabase
      .from("meritus_criterios")
      .select("id,nome,ordem,ativo,tipo")
      .eq("programa_id", programaId)
      .eq("ativo", true)
      .order("ordem", { ascending: true })
      .limit(4000);

    if (!eC) {
      criterios = critData || [];
      criterioDebug = (criterios || []).slice(0, 10).map((c) => c.nome);
    }

    const presencaIds = findIdsByNeedles(criterios, ["presenc", "frequen", "assidu", "chamada", "reuniao", "reunião", "encontro"]);
    const uniformeIds = findIdsByNeedles(criterios, ["uniform"]);
    const materialIds = findIdsByNeedles(criterios, ["material", "apostila", "caderno", "classe"]);

    // participantes alvo
    let pids = participantesFiltrados.map((p) => p.id);
    if (participanteId && participanteId !== "__ALL__") pids = pids.filter((id) => id === participanteId);

    const baseRows = pids.map((id) => {
      const p = partsMap.get(id);
      return {
        id,
        nome: p?.nome || "Participante",
        grupo_id: p?.grupo_id || null,
        grupo_nome: p?.grupo_id ? gruposMap.get(p.grupo_id) || "—" : "—",
        pontos: 0,
        lancamentos: 0,
        presencas: 0,
        uniformeOk: null,
        materialOk: null,
        lastUniformeAt: null,
        lastMaterialAt: null,
        nuncaVeio: 0,
        alert: "none",
      };
    });

    // Se ninguém no filtro, encerra
    if (!baseRows.length) {
      setEvolucao({ maxPresencas: 0, rows: [], criterioDebug });
      setKpis((k) => ({ ...k, lancamentos: 0, pontos: 0, ultimaAtividade: null }));
      setLoading(false);
      return;
    }

    // Query lançamentos — GLOBAL ou por período selecionado
    const per = periodoSelecionado;
    let q = supabase
      .from("meritus_lancamentos")
      .select("id,participante_id,criterio_id,valor,pontos_calculados,criado_em")
      .eq("programa_id", programaId)
      .in("participante_id", pids)
      .order("criado_em", { ascending: false })
      .limit(50000);

    if (per && per.id && per.id !== "__ALL__") q = q.eq("periodo_id", per.id);

    const { data: lancs, error: eL } = await q;

    if (eL) {
      setErro(eL.message);
      setEvolucao({ maxPresencas: 0, rows: baseRows, criterioDebug });
      setLoading(false);
      return;
    }

    const agg = new Map();
    for (const id of pids) {
      agg.set(id, {
        pontos: 0,
        lancamentos: 0,
        presencas: 0,
        uniformeOk: null,
        materialOk: null,
        lastUniformeAt: null,
        lastMaterialAt: null,
      });
    }

    const isIn = (arr, id) => (arr?.length ? arr.includes(id) : false);

    let pontosTotal = 0;
    let ultimaAtividade = null;

    for (const l of lancs || []) {
      const a = agg.get(l.participante_id);
      if (!a) continue;

      a.lancamentos += 1;
      const pts = Number(l.pontos_calculados || 0);
      a.pontos += pts;

      pontosTotal += pts;
      if (!ultimaAtividade) ultimaAtividade = l.criado_em;

      // presença: contamos lançamentos de critério de presença com valor > 0
      if (isIn(presencaIds, l.criterio_id)) {
        if (asBoolFromValor(l.valor)) a.presencas += 1;
      }

      // status: último valor do histórico (order desc => primeiro define)
      if (isIn(uniformeIds, l.criterio_id)) {
        if (a.uniformeOk === null) {
          a.uniformeOk = asBoolFromValor(l.valor);
          a.lastUniformeAt = l.criado_em || null;
        }
      }
      if (isIn(materialIds, l.criterio_id)) {
        if (a.materialOk === null) {
          a.materialOk = asBoolFromValor(l.valor);
          a.lastMaterialAt = l.criado_em || null;
        }
      }
    }

    const maxPresencas = Math.max(0, ...[...agg.values()].map((a) => Number(a.presencas || 0)));

    // define alertas globais: nunca veio / muitas faltas
    const rows = baseRows
      .map((r) => {
        const a = agg.get(r.id) || {};
        const presencas = Number(a.presencas || 0);
        const nuncaVeio = presencas === 0 ? 1 : 0;

        let alert = "none";
        if (nuncaVeio) {
          alert = "high";
        } else if (maxPresencas >= 6) {
          // thresholds simples: abaixo de 60% do "melhor" vira alerta; 60–75% atenção
          const ratio = maxPresencas ? presencas / maxPresencas : 1;
          if (ratio < 0.6) alert = "high";
          else if (ratio < 0.75) alert = "mid";
        }

        return {
          ...r,
          pontos: Number(a.pontos || 0),
          lancamentos: Number(a.lancamentos || 0),
          presencas,
          uniformeOk: a.uniformeOk ?? null,
          materialOk: a.materialOk ?? null,
          lastUniformeAt: a.lastUniformeAt ?? null,
          lastMaterialAt: a.lastMaterialAt ?? null,
          nuncaVeio,
          alert,
        };
      })
      .sort((a, b) => {
        if (a.nuncaVeio !== b.nuncaVeio) return b.nuncaVeio - a.nuncaVeio;
        const aAlert = a.alert === "high" ? 2 : a.alert === "mid" ? 1 : 0;
        const bAlert = b.alert === "high" ? 2 : b.alert === "mid" ? 1 : 0;
        if (aAlert !== bAlert) return bAlert - aAlert;
        if (a.pontos !== b.pontos) return b.pontos - a.pontos;
        return a.nome.localeCompare(b.nome, "pt-BR");
      });

    // KPIs executivos derivados
    const nuncaVeioCount = rows.filter((r) => r.nuncaVeio).length;
    const alertaFaltasCount = rows.filter((r) => r.alert === "high").length;
    const materialPend = rows.filter((r) => r.materialOk === false).length;
    const uniformePend = rows.filter((r) => r.uniformeOk === false).length;

    // contagens base
    const participantesAtivos = participantes.length;
    const gruposAtivos = grupos.length;

    setEvolucao({ maxPresencas, rows, criterioDebug });

    setKpis({
      participantes: participantesAtivos,
      grupos: gruposAtivos,
      lancamentos: (lancs || []).length,
      pontos: pontosTotal,
      ultimaAtividade,
      nuncaVeio: nuncaVeioCount,
      alertaFaltas: alertaFaltasCount,
      materialPendente: materialPend,
      uniformePendente: uniformePend,
    });

    setLoading(false);
  }

  // troca programa
  useEffect(() => {
    setPeriodoIdSel("__ALL__"); // GLOBAL por padrão
    setGrupoId("__ALL__");
    setParticipanteId("__ALL__");
    setQNome("");
    setAgruparPorGrupo(true);
    carregarBase();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programaId]);

  // Em "Todos", força agrupado
  useEffect(() => {
    if (grupoId === "__ALL__") setAgruparPorGrupo(true);
  }, [grupoId]);

  // recalcula quando base/filtros mudam
  useEffect(() => {
    // só roda após termos participantes carregados (evita “tela vazia”)
    if (!programaId) return;
    if (!participantes.length && !grupos.length) return;
    carregarEvolucaoGlobal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programaId, periodos.length, periodoIdSel, grupoId, participanteId, qNome, participantes.length, grupos.length]);

  return (
    <RequireRole allow={["admin", "fiscal", "relatorio"]}>
      <div className="relative space-y-4">
        <div className="pointer-events-none absolute -top-6 -right-10 opacity-[0.03] hidden md:block">
          <img src="/brand/meritus-mark.png" alt="" className="w-[420px]" />
        </div>

        <PageTitle
          title="Dashboard Executivo"
          subtitle="Visão global do programa: quem nunca veio, quem está com pendências e evolução de pontos."
        />

        <Card>
          <div className="grid md:grid-cols-6 gap-3 items-end">
            <div>
              <label className="text-xs text-white/55">Programa</label>
              <Select value={programaId || ""} onChange={(e) => setProgramaId(e.target.value)} disabled={loadingProgramas}>
                {(programas || []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="text-xs text-white/55">Período</label>
              <Select value={periodoIdSel} onChange={(e) => setPeriodoIdSel(e.target.value)} disabled={loading || !programaId}>
                <option value="__ALL__">Todos os períodos (global)</option>
                {(periodos || []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.rotulo || fmtDate(p.inicio)} — {p.status}
                  </option>
                ))}
              </Select>
           
            </div>

            <div>
              <label className="text-xs text-white/55">Grupo</label>
              <Select value={grupoId} onChange={(e) => setGrupoId(e.target.value)} disabled={loading || !programaId}>
                <option value="__ALL__">Todos (visão agrupada)</option>
                {grupos.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nome}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="text-xs text-white/55">Desbravador</label>
              <Select value={participanteId} onChange={(e) => setParticipanteId(e.target.value)} disabled={loading || !programaId}>
                <option value="__ALL__">Todos</option>
                {participantesFiltrados.slice(0, 2000).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="text-xs text-white/55">Filtro por nome</label>
              <Input value={qNome} onChange={(e) => setQNome(e.target.value)} placeholder="Digite para localizar" disabled={loading || !programaId} />
            </div>

            <div>
              <label className="text-xs text-white/55">Exibição</label>
              <Select
                value={agruparPorGrupo ? "sim" : "nao"}
                onChange={(e) => setAgruparPorGrupo(e.target.value === "sim")}
                disabled={grupoId === "__ALL__"}
              >
                <option value="sim">Agrupado</option>
                <option value="nao">Lista única</option>
              </Select>
              <div className="mt-1 text-[11px] text-white/45">{grupoId === "__ALL__" ? "Bloqueado em Agrupado." : "Opcional."}</div>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              {programaAtual ? <Badge>{programaAtual.nome}</Badge> : null}
              {periodoSelecionado?.rotulo ? <Badge>Período: <b className="ml-1">{periodoSelecionado.rotulo}</b></Badge> : <Badge>Sem período</Badge>}
            </div>

            <Button onClick={carregarEvolucaoGlobal} disabled={loading || !programaId}>
              Recalcular
            </Button>
          </div>

          {erro ? <div className="mt-3 text-sm text-[var(--m-danger)]">{erro}</div> : null}
        </Card>

        {/* KPIs principais */}
        <div className="grid md:grid-cols-4 gap-3">
          <Card className="relative overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(212,175,55,.55),transparent)]" />
            <div className="text-xs text-white/55">Participantes ativos</div>
            <div className="mt-1 text-2xl font-semibold">{fmtNum(kpis.participantes)}</div>
            <div className="mt-1 text-xs text-white/55">Grupos: {fmtNum(kpis.grupos)}</div>
          </Card>

          <Card className="relative overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(212,175,55,.55),transparent)]" />
            <div className="text-xs text-white/55">Pontos (escopo atual)</div>
            <div className="mt-1 text-2xl font-semibold">{fmtPts(kpis.pontos)}</div>
            <div className="mt-1 text-xs text-white/60">{fmtNum(kpis.lancamentos)} lançamentos</div>
          </Card>

          <Card className="relative overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(212,175,55,.55),transparent)]" />
            <div className="text-xs text-white/55">Nunca veio</div>
            <div className="mt-1 text-2xl font-semibold">{fmtNum(kpis.nuncaVeio)}</div>
            <div className="mt-1 text-xs text-white/60">Presenças = 0</div>
          </Card>

          <Card className="relative overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(212,175,55,.55),transparent)]" />
            <div className="text-xs text-white/55">Pendências</div>
            <div className="mt-1 text-sm text-white/70">
              <span className="inline-flex items-center gap-2">
                <span className="font-semibold">{fmtNum(kpis.materialPendente)}</span> material pendente
              </span>
            </div>
            <div className="mt-1 text-sm text-white/70">
              <span className="inline-flex items-center gap-2">
                <span className="font-semibold">{fmtNum(kpis.uniformePendente)}</span> uniforme pendente
              </span>
            </div>
          </Card>
        </div>

        {/* Resumo por grupo */}
        {grupoId === "__ALL__" && participanteId === "__ALL__" ? (
          <Card className="p-0 overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10">
              <div className="text-sm font-semibold">Resumo por grupo</div>
              <div className="text-xs text-white/55">Ideal para liderança: onde estão os problemas (nunca veio / pendências) e desempenho (pontos).</div>
            </div>

            {resumoPorGrupo.length === 0 ? (
              <div className="px-5 py-8 text-sm text-white/60">Sem dados para o escopo atual.</div>
            ) : (
              <div className="grid md:grid-cols-3 gap-3 p-5">
                {resumoPorGrupo.map((g) => (
                  <div key={g.grupo_id} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="font-semibold">{g.grupo_nome}</div>
                      <div className="text-xs text-white/55">{fmtNum(g.participantes)} part.</div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                        <div className="text-[11px] text-white/55">Pontos</div>
                        <div className="text-lg font-semibold">{fmtPts(g.pontos)}</div>
                        <div className="text-[11px] text-white/45">Média: {fmtPts(g.mediaPorParticipante)}</div>
                      </div>

                      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                        <div className="text-[11px] text-white/55">Nunca veio</div>
                        <div className="text-lg font-semibold">{fmtNum(g.nuncaVeio)}</div>
                        <div className="text-[11px] text-white/45">Alerta alto: {fmtNum(g.alertHigh)}</div>
                      </div>

                      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                        <div className="text-[11px] text-white/55">Material pendente</div>
                        <div className="text-lg font-semibold">{fmtNum(g.materialPendente)}</div>
                      </div>

                      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                        <div className="text-[11px] text-white/55">Uniforme pendente</div>
                        <div className="text-lg font-semibold">{fmtNum(g.uniformePendente)}</div>
                      </div>
                    </div>

                    <div className="mt-3 text-[11px] text-white/45">
                      Dica: selecione este grupo no filtro para ver o detalhe (lista única).
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        ) : null}

        {/* Detalhe por desbravador */}
        <Card className="p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-sm font-semibold">Desbravadores (executivo)</div>
              <div className="text-xs text-white/55">
                Destaque: quem nunca veio, quem tem pendências, e pontos no escopo selecionado.
              </div>
            </div>
            <div className="text-xs text-white/55">
              Max presenças observado (proxy): <b className="text-white/70">{evolucao.maxPresencas}</b>
            </div>
          </div>

          {!programaId ? (
            <div className="px-5 py-8 text-sm text-white/60">Selecione um programa.</div>
          ) : evolucaoFiltrada.length === 0 ? (
            <div className="px-5 py-8 text-sm text-white/60">Sem participantes para os filtros atuais.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[1180px] w-full text-sm">
                <thead>
                  <tr className="text-left text-white/55 border-b border-white/10 bg-white/[0.02]">
                    <th className="py-3 px-5">Desbravador</th>
                    <th className="py-3 px-5">Grupo</th>
                    <th className="py-3 px-5">Presenças</th>
                    <th className="py-3 px-5">Pontos</th>
                    <th className="py-3 px-5">Lançamentos</th>
                    <th className="py-3 px-5">Material</th>
                    <th className="py-3 px-5">Uniforme</th>
                    <th className="py-3 px-5">Últ. material</th>
                    <th className="py-3 px-5">Últ. uniforme</th>
                    <th className="py-3 px-5 text-right">Alerta</th>
                  </tr>
                </thead>

                <tbody>
                  {agruparPorGrupo
                    ? evolucaoPorGrupo.flatMap(([gNome, arr]) => [
                        <tr key={`g-${gNome}`} className="border-b border-white/10 bg-white/[0.035]">
                          <td className="py-3 px-5 font-semibold" colSpan={10}>
                            {gNome} <span className="text-white/55 font-normal">({arr.length})</span>
                          </td>
                        </tr>,
                        ...arr.map((r) => (
                          <tr key={r.id} className="border-b border-white/10 last:border-b-0 hover:bg-white/[0.02]">
                            <td className="py-3 px-5 font-medium">
                              {r.nome}
                              {r.nuncaVeio ? <span className="ml-2 text-xs text-[var(--m-danger)]">• nunca veio</span> : null}
                            </td>
                            <td className="py-3 px-5 text-white/70">{r.grupo_nome}</td>
                            <td className="py-3 px-5">{fmtNum(r.presencas)}</td>
                            <td className="py-3 px-5 font-semibold">{fmtPts(r.pontos)}</td>
                            <td className="py-3 px-5">{fmtNum(r.lancamentos)}</td>
                            <td className="py-3 px-5">
                              {r.materialOk === null ? (
                                <span className="text-white/55">—</span>
                              ) : (
                                <span className={statusPill(r.materialOk)}>{r.materialOk ? "em dia" : "pendente"}</span>
                              )}
                            </td>
                            <td className="py-3 px-5">
                              {r.uniformeOk === null ? (
                                <span className="text-white/55">—</span>
                              ) : (
                                <span className={statusPill(r.uniformeOk)}>{r.uniformeOk ? "ok" : "pendente"}</span>
                              )}
                            </td>
                            <td className="py-3 px-5 text-white/60">{r.lastMaterialAt ? fmtDate(r.lastMaterialAt) : "—"}</td>
                            <td className="py-3 px-5 text-white/60">{r.lastUniformeAt ? fmtDate(r.lastUniformeAt) : "—"}</td>
                            <td className="py-3 px-5 text-right">
                              {r.alert === "high" ? (
                                <span className={alertPill("high")}>{r.nuncaVeio ? "Nunca veio" : "Muitas faltas"}</span>
                              ) : r.alert === "mid" ? (
                                <span className={alertPill("mid")}>Atenção</span>
                              ) : (
                                <span className={alertPill("none")}>OK</span>
                              )}
                            </td>
                          </tr>
                        )),
                      ])
                    : evolucaoFiltrada.map((r) => (
                        <tr key={r.id} className="border-b border-white/10 last:border-b-0 hover:bg-white/[0.02]">
                          <td className="py-3 px-5 font-medium">
                            {r.nome}
                            {r.nuncaVeio ? <span className="ml-2 text-xs text-[var(--m-danger)]">• nunca veio</span> : null}
                          </td>
                          <td className="py-3 px-5 text-white/70">{r.grupo_nome}</td>
                          <td className="py-3 px-5">{fmtNum(r.presencas)}</td>
                          <td className="py-3 px-5 font-semibold">{fmtPts(r.pontos)}</td>
                          <td className="py-3 px-5">{fmtNum(r.lancamentos)}</td>
                          <td className="py-3 px-5">
                            {r.materialOk === null ? (
                              <span className="text-white/55">—</span>
                            ) : (
                              <span className={statusPill(r.materialOk)}>{r.materialOk ? "em dia" : "pendente"}</span>
                            )}
                          </td>
                          <td className="py-3 px-5">
                            {r.uniformeOk === null ? (
                              <span className="text-white/55">—</span>
                            ) : (
                              <span className={statusPill(r.uniformeOk)}>{r.uniformeOk ? "ok" : "pendente"}</span>
                            )}
                          </td>
                          <td className="py-3 px-5 text-white/60">{r.lastMaterialAt ? fmtDate(r.lastMaterialAt) : "—"}</td>
                          <td className="py-3 px-5 text-white/60">{r.lastUniformeAt ? fmtDate(r.lastUniformeAt) : "—"}</td>
                          <td className="py-3 px-5 text-right">
                            {r.alert === "high" ? (
                              <span className={alertPill("high")}>{r.nuncaVeio ? "Nunca veio" : "Muitas faltas"}</span>
                            ) : r.alert === "mid" ? (
                              <span className={alertPill("mid")}>Atenção</span>
                            ) : (
                              <span className={alertPill("none")}>OK</span>
                            )}
                          </td>
                        </tr>
                      ))}
                </tbody>
              </table>

              <div className="px-5 py-4 text-[11px] text-white/45 border-t border-white/10">
                <div>
                  <b>Leituras executivas:</b> presenças são contadas por critério (se existir). Material/Uniforme usam o último valor do histórico.
                  Pontos = soma de <code className="px-1 py-0.5 bg-white/10 rounded">pontos_calculados</code>.
                </div>
                {evolucao.criterioDebug?.length ? (
                  <div className="mt-1">
                    <b>Critérios detectados (amostra):</b> {evolucao.criterioDebug.join(" · ")}
                  </div>
                ) : (
                  <div className="mt-1">
                    <b>Critérios:</b> não consegui ler meritus_criterios (ou RLS bloqueou). Mesmo assim, pontos/lançamentos funcionam.
                  </div>
                )}
              </div>
            </div>
          )}
        </Card>
      </div>
    </RequireRole>
  );
}
