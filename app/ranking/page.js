"use client";

/**
 * Meritus — Ranking Público (Pais) (Fluxo simplificado)
 * Rota: app/ranking/page.js
 *
 * Ajuste pedido:
 * - Manter o filtro de busca, mas ao filtrar (digitar), NÃO renumerar posições.
 *   Ou seja: exibe apenas os encontrados, porém mantendo o número de posição ORIGINAL no ranking geral.
 *
 * RPCs:
 * - public_programas(p_codigo)
 * - public_ranking(p_codigo, p_programa_id, p_periodo_id, p_grupo_id)
 */

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/src/lib/supabase";
import { Card, PageTitle, Button, Input, Select } from "@/components/admin/ui";

function Badge({ children }) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs font-medium text-white/80">
      {children}
    </span>
  );
}

function fmtNumber(n) {
  const v = Number(n ?? 0);
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function norm(v) {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function RaceRow({ posLabel, name, group, points, maxPoints }) {
  const pct = maxPoints > 0 ? Math.max(0, Math.min(100, (Number(points || 0) / maxPoints) * 100)) : 0;
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="w-14 text-sm font-semibold text-white/85">{posLabel}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-white">{name}</div>
            <div className="truncate text-xs text-white/55">{group}</div>
          </div>
          <div className="text-sm font-semibold text-white tabular-nums">{fmtNumber(points)}</div>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full border border-white/10 bg-white/[0.03]">
          <div
            className="h-full rounded-full bg-[var(--m-gold)] transition-all duration-700 ease-out"
            style={{ width: `${pct}%` }}
            aria-label={`Progresso ${pct.toFixed(1)}%`}
          />
        </div>
      </div>
    </div>
  );
}

export default function PublicRankingPage() {
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  const [codigo, setCodigo] = useState("");
  const [codigoOk, setCodigoOk] = useState(false);

  const [programas, setProgramas] = useState([]);
  const [programaId, setProgramaId] = useState("");

  const [rows, setRows] = useState([]);
  const [busca, setBusca] = useState("");

  async function acessar() {
    const code = String(codigo || "").trim().toLowerCase();
    if (!code) return;

    setErro("");
    setLoading(true);
    setCodigoOk(false);
    setProgramas([]);
    setProgramaId("");
    setRows([]);
    setBusca("");

    const { data, error } = await supabase.rpc("public_programas", { p_codigo: code });

    if (error) {
      setErro(error.message || "Erro ao validar código.");
      setLoading(false);
      return;
    }

    const ps = Array.isArray(data) ? data : [];
    if (!ps.length) {
      setErro("Código inválido ou sem programas ativos.");
      setLoading(false);
      return;
    }

    setProgramas(ps);
    setProgramaId(ps[0]?.id || "");
    setCodigoOk(true);
    setLoading(false);
  }

  // carregar ranking depois que acessou
  useEffect(() => {
    let alive = true;

    async function loadRanking() {
      if (!codigoOk || !programaId) return;

      const code = String(codigo || "").trim().toLowerCase();
      if (!code) return;

      setErro("");
      setLoading(true);

      const { data, error } = await supabase.rpc("public_ranking", {
        p_codigo: code,
        p_programa_id: programaId,
        p_periodo_id: null,
        p_grupo_id: null,
      });

      if (!alive) return;

      if (error) {
        setErro(error.message || "Erro ao carregar ranking.");
        setRows([]);
        setLoading(false);
        return;
      }

      const r = Array.isArray(data) ? data : [];
      setRows(
        r.map((x) => ({
          participante_id: x.participante_id,
          participante_nome: x.participante_nome,
          grupo_nome: x.grupo_nome,
          pontos: Number(x.pontos ?? 0),
        }))
      );

      setLoading(false);
    }

    loadRanking();
    return () => {
      alive = false;
    };
  }, [codigoOk, programaId]);

  // Ranking geral (ordenado) com posição fixa (rank)
  const rankedRows = useMemo(
    () =>
      (rows || []).map((r, idx) => ({
        ...r,
        rank: idx + 1, // posição ORIGINAL no ranking
      })),
    [rows]
  );

  const q = useMemo(() => norm(busca), [busca]);
  const filtered = useMemo(() => {
    if (!q) return rankedRows;
    return rankedRows.filter((r) => norm(r.participante_nome).includes(q) || norm(r.grupo_nome).includes(q));
  }, [rankedRows, q]);

  const top3Global = rankedRows.slice(0, 3);
  const listForRace = filtered.slice(0, 10);

  // Para a corrida, o "máximo" deve ser do líder global (pra escala ficar consistente mesmo filtrando)
  const maxPoints = useMemo(() => Math.max(0, ...top3Global.map((r) => Number(r.pontos || 0)), ...rankedRows.slice(0, 10).map((r) => Number(r.pontos || 0))), [
    rankedRows,
    top3Global,
  ]);

  // --- TELA 1: somente acesso ---
  if (!codigoOk) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/brand/meritus-mark.png" alt="Meritus" className="h-9 w-9" />
            <div>
              <div className="text-sm font-semibold text-white">Meritus</div>
              <div className="text-xs text-white/55">Ranking público (pais)</div>
            </div>
          </div>
          <Badge>Sem login</Badge>
        </div>

        <PageTitle title="Ranking" subtitle="Digite o código do clube para visualizar a classificação." />

        <Card>
          <div className="space-y-2">
            <div className="text-xs font-medium text-white/60">Código do clube</div>
            <div className="flex gap-2">
              <Input
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                placeholder="Ex.: amigosparaiso"
                autoCapitalize="none"
                onKeyDown={(e) => {
                  if (e.key === "Enter") acessar();
                }}
              />
              <Button onClick={acessar} disabled={loading || !codigo.trim()}>
                {loading ? "Acessando…" : "Acessar"}
              </Button>
            </div>
            <div className="text-[11px] text-white/45">
              Peça ao líder o <b>código</b> para acompanhar o ranking.
            </div>

            {erro ? <div className="pt-2 text-sm text-[var(--m-danger)]">{erro}</div> : null}
          </div>
        </Card>
      </div>
    );
  }

  // --- TELA 2: ranking ---
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/brand/meritus-mark.png" alt="Meritus" className="h-9 w-9" />
          <div>
            <div className="text-sm font-semibold text-white">Meritus</div>
            <div className="text-xs text-white/55">Ranking público (pais)</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge>Código: {String(codigo || "").trim().toLowerCase()}</Badge>
          <Button
            variant="secondary"
            onClick={() => {
              setCodigoOk(false);
              setRows([]);
              setBusca("");
              setErro("");
            }}
          >
            Trocar código
          </Button>
        </div>
      </div>

      <PageTitle title="Ranking" subtitle="Classificação por pontos (posições fixas ao filtrar)." />

      {/* Se houver mais de um programa, permite trocar (se só 1, fica discreto) */}
      {programas.length > 1 ? (
        <Card>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div>
              <div className="text-xs font-medium text-white/60 mb-1">Programa</div>
              <Select value={programaId} onChange={(e) => setProgramaId(e.target.value)} disabled={loading}>
                {(programas || []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </Select>
            </div>
            <div className="md:col-span-2">
              <div className="text-xs font-medium text-white/60 mb-1">Buscar</div>
              <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Digite um nome..." />
              {q ? <div className="mt-1 text-[11px] text-white/45">Mostrando resultados com posição original no ranking.</div> : null}
            </div>
          </div>
          {erro ? <div className="mt-3 text-sm text-[var(--m-danger)]">{erro}</div> : null}
        </Card>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-white/60">{programas[0]?.nome ? <Badge>Programa: {programas[0].nome}</Badge> : null}</div>
          <div className="w-full max-w-sm">
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome..." />
            {q ? <div className="mt-1 text-[11px] text-white/45">Resultados mantêm a posição original.</div> : null}
          </div>
        </div>
      )}

      {/* Corrida (Top 10) */}
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-white">Corrida (Top 10)</div>
            <div className="text-xs text-white/60">{q ? "Filtrado (posições originais)." : "Barras proporcionais ao líder."}</div>
          </div>
          {loading ? <div className="text-xs text-white/60">Atualizando…</div> : null}
        </div>

        <div className="mt-2 divide-y divide-white/10">
          {listForRace.length === 0 ? (
            <div className="py-6 text-sm text-white/60">Nenhum participante encontrado.</div>
          ) : (
            listForRace.map((r) => (
              <RaceRow
                key={r.participante_id}
                posLabel={`#${r.rank}`}
                name={r.participante_nome}
                group={r.grupo_nome}
                points={r.pontos}
                maxPoints={maxPoints}
              />
            ))
          )}
        </div>
      </Card>

      {/* Top 3 global (não muda ao filtrar) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[1, 2, 3].map((pos) => {
          const r = top3Global[pos - 1];
          return (
            <Card key={pos}>
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-white">#{pos}</div>
                <Badge>{pos === 1 ? "Top 1" : pos === 2 ? "Top 2" : "Top 3"}</Badge>
              </div>

              <div className="mt-3">
                <div className="text-lg font-semibold truncate text-white">{r?.participante_nome || "—"}</div>
                <div className="text-sm text-white/60 truncate">{r?.grupo_nome || "—"}</div>
                <div className="mt-2 text-2xl font-semibold text-white">{fmtNumber(r?.pontos ?? 0)}</div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Tabela */}
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-white">Classificação</div>
            <div className="text-xs text-white/60">{q ? "Filtrado (posições originais)." : "Ranking completo."}</div>
          </div>
          {loading ? <div className="text-xs text-white/60">Carregando…</div> : null}
        </div>

        <div className="mt-3 overflow-auto">
          <table className="min-w-[700px] w-full text-sm">
            <thead>
              <tr className="text-left text-white/60">
                <th className="py-2 pr-3 w-[90px]">Pos.</th>
                <th className="py-2 pr-3">Desbravador</th>
                <th className="py-2 pr-3">Grupo</th>
                <th className="py-2 pr-3 w-[140px] text-right">Pontos</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td className="py-6 text-white/60" colSpan={4}>
                    Nenhum desbravador encontrado.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.participante_id} className="border-t border-white/10">
                    <td className="py-2 pr-3 font-medium text-white">#{r.rank}</td>
                    <td className="py-2 pr-3">
                      <div className="font-medium text-white">{r.participante_nome}</div>
                    </td>
                    <td className="py-2 pr-3 text-white/70">{r.grupo_nome}</td>
                    <td className="py-2 pr-3 text-right font-semibold text-white">{fmtNumber(r.pontos)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-3 text-[11px] text-white/45">
          Observação: esta página mostra apenas pontuação. Dados internos (presença/uniforme/material) ficam restritos ao acesso interno.
        </div>
      </Card>
    </div>
  );
}
