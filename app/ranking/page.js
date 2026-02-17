"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/src/lib/supabase";

/**
 * Ranking (Premium)
 * - lê ?programa= & ?periodo= (URL)
 * - se faltar programa, tenta localStorage do Admin
 * - placa top 3 + tabela completa
 */

const ADMIN_STORAGE_KEY = "meritus_admin_programaId";

export default function RankingPage() {
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);

  const [rows, setRows] = useState([]);
  const [programaId, setProgramaId] = useState("");
  const [periodoId, setPeriodoId] = useState("");

  const [periodoInfo, setPeriodoInfo] = useState(null);
  const [grupoMap, setGrupoMap] = useState({}); // grupo_id -> nome

  useEffect(() => {
    const url = new URL(window.location.href);
    const p = url.searchParams.get("programa") || "";
    const pe = url.searchParams.get("periodo") || "";
    const fallback = safeGetLocal(ADMIN_STORAGE_KEY) || "";
    setProgramaId(p || fallback);
    setPeriodoId(pe);
  }, []);

  useEffect(() => {
    if (!programaId || !periodoId) {
      setLoading(false);
      return;
    }
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programaId, periodoId]);

  async function carregar() {
    setLoading(true);
    setErro(null);

    // periodo info
    const { data: peInfo, error: peErr } = await supabase
      .from("meritus_periodos")
      .select("id,rotulo,inicio,fim,status")
      .eq("id", periodoId)
      .maybeSingle();

    if (peErr) {
      setErro(peErr.message);
      setLoading(false);
      return;
    }
    setPeriodoInfo(peInfo || null);

    // ranking agregado
    const { data: ranking, error: e1 } = await supabase
      .from("vw_meritus_ranking_periodo")
      .select("participante_id,total_pontos,qtd_lancamentos,grupo_id")
      .eq("programa_id", programaId)
      .eq("periodo_id", periodoId)
      .order("total_pontos", { ascending: false });

    if (e1) {
      setErro(e1.message);
      setRows([]);
      setLoading(false);
      return;
    }

    if (!ranking || ranking.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }

    // buscar nomes dos participantes
    const ids = ranking.map((r) => r.participante_id);

    const { data: participantes, error: e2 } = await supabase
      .from("meritus_participantes")
      .select("id,nome,grupo_id")
      .in("id", ids);

    if (e2) {
      setErro(e2.message);
      setRows([]);
      setLoading(false);
      return;
    }

    const pmap = {};
    const gset = new Set();
    (participantes || []).forEach((p) => {
      pmap[p.id] = p.nome;
      if (p.grupo_id) gset.add(p.grupo_id);
    });

    // grupos (opcional)
    if (gset.size > 0) {
      const gids = Array.from(gset);
      const { data: grupos, error: gErr } = await supabase
        .from("meritus_grupos")
        .select("id,nome")
        .in("id", gids);

      if (!gErr) {
        const gmap = {};
        (grupos || []).forEach((g) => (gmap[g.id] = g.nome));
        setGrupoMap(gmap);
      }
    }

    // junta
    const rowsFinal = ranking.map((r) => ({
      ...r,
      nome: pmap[r.participante_id] || "—",
    }));

    setRows(rowsFinal);
    setLoading(false);
  }

  const top3 = useMemo(() => rows.slice(0, 3), [rows]);

  return (
    <main style={S.page}>
      <div style={S.bgGlowA} />
      <div style={S.bgGlowB} />

      <div style={S.shell}>
        <header style={S.header}>
          <div style={{ minWidth: 0 }}>
            <div style={S.kicker}>Meritus</div>
            <h1 style={S.h1}>Ranking</h1>

            <div style={S.sub}>
              {periodoInfo ? (
                <span style={S.pill}>
                  {periodoInfo.rotulo || "Período"} • {periodoInfo.status === "aberto" ? "ABERTO" : "FECHADO"}
                </span>
              ) : (
                <span style={S.pill}>Período</span>
              )}
              <span style={S.mutedSmall}>
                {programaId ? `Programa: ${programaId.slice(0, 8)}…` : "Sem programa"}
              </span>
            </div>
          </div>

          <div style={S.actions}>
            <a href="/lancamentos" style={S.btnSoft}>Voltar aos lançamentos</a>
            <a href="/admin/periodos" style={S.btnGhost}>Períodos</a>
          </div>
        </header>

        {!programaId || !periodoId ? (
          <div style={S.card}>
            <div style={S.cardHeader}>
              <b>Faltam parâmetros</b>
              <span style={S.badge}>URL</span>
            </div>
            <div style={S.cardBody}>
              Informe na URL:
              <div style={{ marginTop: 8 }}>
                <code style={S.code}>/ranking?programa=&lt;uuid&gt;&amp;periodo=&lt;uuid&gt;</code>
              </div>
              <div style={{ marginTop: 10, opacity: 0.85 }}>
                Dica: abra o ranking pela tela de <b>Lançamentos</b> (botão “Ranking”).
              </div>
            </div>
          </div>
        ) : null}

        {loading ? (
          <div style={S.card}>
            <div style={S.cardBody}>Carregando…</div>
          </div>
        ) : null}

        {erro ? (
          <div style={S.alertErr}>
            <b>Erro:</b> {erro}
          </div>
        ) : null}

        {!loading && !erro && programaId && periodoId ? (
          <>
            {/* Podium */}
            <section style={S.card}>
              <div style={S.cardHeader}>
                <b>Placar</b>
                <span style={S.badge}>Top 3</span>
              </div>

              <div style={S.cardBody}>
                {top3.length === 0 ? (
                  <div style={S.empty}>
                    <div style={S.emptyTitle}>Sem dados</div>
                    <div style={S.emptyDesc}>Ainda não há lançamentos para este período.</div>
                  </div>
                ) : (
                  <div style={S.podium}>
                    {top3.map((r, idx) => (
                      <div key={r.participante_id} style={idx === 0 ? S.podiumFirst : S.podiumCard}>
                        <div style={S.rankBadge(idx + 1)}>{idx + 1}</div>
                        <div style={{ minWidth: 0 }}>
                          <div style={S.podiumName}>{r.nome}</div>
                          <div style={S.mutedSmall}>
                            {grupoMap[r.grupo_id] ? grupoMap[r.grupo_id] : r.grupo_id ? `Grupo ${r.grupo_id.slice(0, 6)}…` : "—"}
                          </div>
                        </div>
                        <div style={S.podiumScore}>
                          <div style={S.mutedSmall}>Pontos</div>
                          <div style={S.scoreBig}>{Number(r.total_pontos || 0)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* Table */}
            <section style={S.card}>
              <div style={S.cardHeader}>
                <b>Ranking completo</b>
                <span style={S.badge}>{rows.length} participantes</span>
              </div>

              <div style={S.cardBody}>
                <div style={{ overflowX: "auto" }}>
                  <table style={S.table}>
                    <thead>
                      <tr>
                        <th style={S.th}>#</th>
                        <th style={S.thLeft}>Participante</th>
                        <th style={S.th}>Pontos</th>
                        <th style={S.th}>Lançamentos</th>
                        <th style={S.thLeft}>Grupo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, idx) => (
                        <tr key={r.participante_id} style={idx < 3 ? S.trTop : undefined}>
                          <td style={S.td}>{idx + 1}</td>
                          <td style={S.tdLeft}><b>{r.nome}</b></td>
                          <td style={S.td}>{Number(r.total_pontos || 0)}</td>
                          <td style={S.td}>{r.qtd_lancamentos}</td>
                          <td style={S.tdLeft}>{grupoMap[r.grupo_id] || (r.grupo_id ? r.grupo_id.slice(0, 8) + "…" : "—")}</td>
                        </tr>
                      ))}

                      {rows.length === 0 ? (
                        <tr>
                          <td style={S.td} colSpan={5}>Sem dados para este período.</td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}

function safeGetLocal(k) {
  try { return window.localStorage.getItem(k); } catch { return ""; }
}

const S = {
  page: {
    minHeight: "100vh",
    background: "#070a12",
    color: "#e5e7eb",
    padding: 14,
    position: "relative",
    overflow: "hidden",
    fontFamily: "system-ui",
  },
  bgGlowA: {
    position: "absolute",
    inset: "-30% auto auto -30%",
    width: 520,
    height: 520,
    borderRadius: 999,
    background: "radial-gradient(circle at 30% 30%, rgba(34,197,94,.20), rgba(34,197,94,0) 60%)",
    filter: "blur(8px)",
    pointerEvents: "none",
  },
  bgGlowB: {
    position: "absolute",
    inset: "auto -30% -35% auto",
    width: 640,
    height: 640,
    borderRadius: 999,
    background: "radial-gradient(circle at 70% 60%, rgba(99,102,241,.20), rgba(99,102,241,0) 60%)",
    filter: "blur(10px)",
    pointerEvents: "none",
  },
  shell: { maxWidth: 1100, margin: "0 auto", padding: 10, position: "relative", zIndex: 1, display: "grid", gap: 12 },

  header: {
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,.12)",
    background: "rgba(255,255,255,.06)",
    backdropFilter: "blur(14px)",
    padding: 14,
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  kicker: { fontSize: 12, opacity: 0.72, fontWeight: 900, letterSpacing: 0.3, textTransform: "uppercase" },
  h1: { fontSize: 22, margin: 0, letterSpacing: -0.3, fontWeight: 950 },
  sub: { marginTop: 8, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" },
  mutedSmall: { opacity: 0.74, fontSize: 12 },

  actions: { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" },
  btnSoft: {
    padding: "10px 12px",
    borderRadius: 14,
    background: "rgba(255,255,255,.10)",
    border: "1px solid rgba(255,255,255,.16)",
    color: "inherit",
    fontWeight: 950,
    textDecoration: "none",
  },
  btnGhost: {
    padding: "10px 12px",
    borderRadius: 14,
    background: "transparent",
    border: "1px solid rgba(255,255,255,.16)",
    color: "inherit",
    fontWeight: 900,
    textDecoration: "none",
  },

  card: {
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,.12)",
    background: "rgba(255,255,255,.06)",
    backdropFilter: "blur(14px)",
    overflow: "hidden",
  },
  cardHeader: {
    padding: 12,
    borderBottom: "1px solid rgba(255,255,255,.10)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  badge: {
    fontSize: 12,
    padding: "6px 10px",
    borderRadius: 999,
    background: "rgba(255,255,255,.08)",
    border: "1px solid rgba(255,255,255,.14)",
    fontWeight: 900,
  },
  cardBody: { padding: 12 },
  code: { padding: 10, borderRadius: 12, background: "rgba(17,24,39,.55)", border: "1px solid rgba(255,255,255,.12)", display: "inline-block" },

  alertErr: { padding: 12, borderRadius: 16, border: "1px solid rgba(220,38,38,.35)", background: "rgba(220,38,38,.12)" },

  podium: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 10 },
  podiumCard: {
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,.12)",
    background: "rgba(17,24,39,.40)",
    padding: 12,
    display: "flex",
    gap: 12,
    alignItems: "center",
    justifyContent: "space-between",
  },
  podiumFirst: {
    borderRadius: 18,
    border: "1px solid rgba(34,197,94,.30)",
    background: "linear-gradient(180deg, rgba(34,197,94,.12), rgba(17,24,39,.35))",
    padding: 12,
    display: "flex",
    gap: 12,
    alignItems: "center",
    justifyContent: "space-between",
    boxShadow: "0 0 0 4px rgba(34,197,94,.06)",
  },
  rankBadge: (n) => ({
    width: 34,
    height: 34,
    borderRadius: 12,
    display: "grid",
    placeItems: "center",
    fontWeight: 950,
    border: "1px solid rgba(255,255,255,.14)",
    background: n === 1 ? "rgba(34,197,94,.16)" : "rgba(255,255,255,.08)",
  }),
  podiumName: { fontWeight: 950, letterSpacing: -0.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 220 },
  podiumScore: { textAlign: "right" },
  scoreBig: { fontSize: 20, fontWeight: 950, letterSpacing: -0.3 },

  table: { width: "100%", borderCollapse: "separate", borderSpacing: 0, minWidth: 720 },
  th: { padding: 12, borderBottom: "1px solid rgba(255,255,255,.10)", background: "rgba(17,24,39,.55)", textAlign: "center", whiteSpace: "nowrap" },
  thLeft: { padding: 12, borderBottom: "1px solid rgba(255,255,255,.10)", background: "rgba(17,24,39,.55)", textAlign: "left", whiteSpace: "nowrap" },
  td: { padding: 12, borderBottom: "1px solid rgba(255,255,255,.06)", textAlign: "center" },
  tdLeft: { padding: 12, borderBottom: "1px solid rgba(255,255,255,.06)", textAlign: "left" },
  trTop: { background: "rgba(34,197,94,.06)" },

  empty: { padding: 18, borderRadius: 16, border: "1px dashed rgba(255,255,255,.18)", background: "rgba(17,24,39,.28)" },
  emptyTitle: { fontWeight: 950, fontSize: 15 },
  emptyDesc: { marginTop: 6, opacity: 0.8, fontSize: 13, lineHeight: 1.35 },
};
