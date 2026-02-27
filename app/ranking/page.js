"use client";

// Meritus - Ranking Público (Somente Lista Final) — Premium UI
// - Fluxo: código -> lista
// - Mantém filtro e posições originais ao filtrar
// - Visual premium: header forte, card de acesso "hero", busca com limpar, sticky bar,
//   zebra/hover na tabela, badges Top 3, skeleton loading, empty state elegante.

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/src/lib/supabase";
import { Card, PageTitle, Button, Input, Select } from "@/components/admin/ui";

function Badge({ children, tone = "neutral" }) {
  const toneClass =
    tone === "gold"
      ? "border-[var(--m-gold)]/30 bg-[var(--m-gold)]/10 text-[var(--m-gold)]"
      : tone === "danger"
      ? "border-[var(--m-danger)]/25 bg-[var(--m-danger)]/10 text-[var(--m-danger)]"
      : "border-white/10 bg-white/[0.04] text-white/80";

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${toneClass}`}>
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

function TopBadge({ rank }) {
  if (rank === 1) return <Badge tone="gold">🥇 #1</Badge>;
  if (rank === 2) return <Badge tone="gold">🥇 #2</Badge>;
  if (rank === 3) return <Badge tone="gold">🥇 #3</Badge>;

  // Medalha para top 30
  if (rank <= 30) {
    return <Badge tone="gold">🏅 #{rank}</Badge>;
  }

  return (
    <span className="text-white/70 font-semibold tabular-nums">
      #{rank}
    </span>
  );
}

function SkeletonRow({ i }) {
  return (
    <tr key={i} className="border-t border-white/10">
      <td className="py-3 pr-3 w-20">
        <div className="h-4 w-12 rounded bg-white/10 animate-pulse" />
      </td>
      <td className="py-3 pr-3">
        <div className="h-4 w-56 rounded bg-white/10 animate-pulse" />
        <div className="mt-2 h-3 w-32 rounded bg-white/5 animate-pulse" />
      </td>
      <td className="py-3 pr-3">
        <div className="h-4 w-40 rounded bg-white/10 animate-pulse" />
      </td>
      <td className="py-3 w-28 text-right">
        <div className="ml-auto h-4 w-16 rounded bg-white/10 animate-pulse" />
      </td>
    </tr>
  );
}

export default function PublicRankingPage() {
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [codigo, setCodigo] = useState("");
  const [codigoOk, setCodigoOk] = useState(false);

  const [programas, setProgramas] = useState([]);
  const [programaId, setProgramaId] = useState("");
  const [programaNome, setProgramaNome] = useState("");

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
    setProgramaNome("");
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
    setProgramaNome(ps[0]?.nome || "");
    setCodigoOk(true);
    setLoading(false);
  }

  useEffect(() => {
    const selected = (programas || []).find((p) => p.id === programaId);
    setProgramaNome(selected?.nome || "");
  }, [programaId, programas]);

  useEffect(() => {
    let alive = true;

    async function loadRanking() {
      if (!codigoOk || !programaId) return;

      setErro("");
      setLoading(true);

      const { data, error } = await supabase.rpc("public_ranking", {
        p_codigo: String(codigo || "").trim().toLowerCase(),
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

      const ranked = (Array.isArray(data) ? data : []).map((r, idx) => ({
        participante_id: r.participante_id,
        participante_nome: r.participante_nome,
        grupo_nome: r.grupo_nome,
        pontos: Number(r.pontos ?? 0),
        rank: idx + 1, // posição ORIGINAL
      }));

      setRows(ranked);
      setLoading(false);
    }

    loadRanking();
    return () => {
      alive = false;
    };
  }, [codigoOk, programaId]);

  const q = useMemo(() => norm(busca), [busca]);

  const filtered = useMemo(() => {
    if (!q) return rows;
    return rows.filter((r) => norm(r.participante_nome).includes(q) || norm(r.grupo_nome).includes(q));
  }, [rows, q]);

  const resultsLabel = useMemo(() => {
    if (!q) return `${rows.length} participantes`;
    return `${filtered.length} resultados (posição original mantida)`;
  }, [q, rows.length, filtered.length]);

  // ============================
  // TELA DE ACESSO (HERO)
  // ============================
  if (!codigoOk) {
    return (
      <div className="space-y-6">
        {/* Brand header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/brand/meritus-mark.png" alt="Meritus" className="h-10 w-10" />
            <div>
              <div className="text-sm font-semibold text-white">Meritus</div>
              <div className="text-xs text-white/55">Ranking público (pais)</div>
            </div>
          </div>
          <Badge>Sem login</Badge>
        </div>

        <PageTitle title="Ranking" subtitle="Digite o código do clube para visualizar a classificação." />

        <div className="grid place-items-center">
          <div className="w-full max-w-xl">
            <Card>
              <div className="p-5 md:p-6 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-base font-semibold text-white">Acesso rápido</div>
                    <div className="text-xs text-white/55">Peça o código ao líder do clube.</div>
                  </div>
                  <Badge>Seguro</Badge>
                </div>

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
                    Dica: use apenas letras e números (sem espaços). Ex.: <b>amigosparaiso</b>
                  </div>

                  {erro ? <div className="pt-2 text-sm text-[var(--m-danger)]">{erro}</div> : null}
                </div>
              </div>
            </Card>
          </div>
        </div>

        <div className="text-[11px] text-white/40 text-center">
          Meritus • Visualização pública somente da pontuação. Dados internos permanecem restritos.
        </div>
      </div>
    );
  }

  // ============================
  // TELA DO RANKING (PREMIUM)
  // ============================
  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <img src="/brand/meritus-mark.png" alt="Meritus" className="h-10 w-10" />
          <div className="min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <div className="text-sm font-semibold text-white">Meritus</div>
              {programaNome ? <Badge>Programa: {programaNome}</Badge> : null}
            </div>
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

      <PageTitle title="Ranking" subtitle="Classificação por pontos. Busca mantém a posição original." />

      {/* Sticky controls */}
      <div className="sticky top-0 z-10 -mx-2 px-2 py-2 bg-black/60 backdrop-blur border-b border-white/10 rounded-md">
        <div className="flex flex-col md:flex-row md:items-end gap-3">
          {programas.length > 1 ? (
            <div className="md:w-72">
              <div className="text-xs font-medium text-white/60 mb-1">Programa</div>
              <Select value={programaId} onChange={(e) => setProgramaId(e.target.value)} disabled={loading}>
                {(programas || []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}

          <div className="flex-1">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-medium text-white/60 mb-1">Buscar</div>
              <div className="text-[11px] text-white/45">{resultsLabel}</div>
            </div>
            <div className="relative">
              <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome ou grupo..." />
              {busca ? (
                <button
                  type="button"
                  onClick={() => setBusca("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-white/55 hover:text-white"
                  aria-label="Limpar busca"
                  title="Limpar"
                >
                  ✕
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {erro ? <div className="mt-2 text-sm text-[var(--m-danger)]">{erro}</div> : null}
      </div>

      <Card>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-white">Classificação</div>
            <div className="text-xs text-white/60">Ordenado por pontos (desc).</div>
          </div>
          {loading ? <div className="text-xs text-white/60">Atualizando…</div> : null}
        </div>

        <div className="mt-3 overflow-auto">
          <table className="min-w-[760px] w-full text-sm">
            <thead>
              <tr className="text-left text-white/60 border-b border-white/10">
                <th className="py-2 pr-3 w-24">Pos.</th>
                <th className="py-2 pr-3">Desbravador</th>
                <th className="py-2 pr-3">Grupo</th>
                <th className="py-2 pr-3 w-28 text-right">Pontos</th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <>
                  {Array.from({ length: 7 }).map((_, i) => (
                    <SkeletonRow key={i} i={i} />
                  ))}
                </>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-10 text-white/60">
                    <div className="text-sm font-semibold text-white/80">Nenhum resultado</div>
                    <div className="text-xs text-white/55">
                      {q ? (
                        <>
                          Não encontramos <b className="text-white/80">“{busca}”</b>. Tente outro nome.
                        </>
                      ) : (
                        "Ainda não há participantes para este programa."
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((r, idx) => (
                  <tr
                    key={r.participante_id}
                    className={`border-t border-white/10 hover:bg-white/[0.03] transition-colors ${
                      idx % 2 === 1 ? "bg-white/[0.015]" : ""
                    }`}
                  >
                    <td className="py-3 pr-3">
                      <TopBadge rank={r.rank} />
                    </td>
                    <td className="py-3 pr-3">
                      <div className="font-semibold text-white">{r.participante_nome}</div>
                      <div className="text-[11px] text-white/45">Posição original mantida ao filtrar</div>
                    </td>
                    <td className="py-3 pr-3 text-white/70">{r.grupo_nome}</td>
                    <td className="py-3 pr-3 text-right font-semibold text-white tabular-nums">{fmtNumber(r.pontos)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-3 text-[11px] text-white/40">
          Meritus • Pontuação pública. Presença / uniforme / material permanecem restritos ao sistema interno.
        </div>
      </Card>
    </div>
  );
}
