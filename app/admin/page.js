"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/src/lib/supabase";

/**
 * /admin (Home)
 * - Conteúdo apenas (layout global faz auth/admin gate)
 */

export default function AdminHomePage() {
  const [programas, setProgramas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErro(null);

      const { data, error } = await supabase
        .from("meritus_programas")
        .select("id,nome,ativo,criado_em")
        .eq("ativo", true)
        .order("criado_em", { ascending: false })
        .limit(50);

      if (error) setErro(error.message);
      setProgramas(data || []);
      setLoading(false);
    })();
  }, []);

  const total = useMemo(() => programas.length, [programas]);

  return (
    <div style={S.wrap}>
      {erro ? (
        <div style={S.alertErr}>
          <b>Erro:</b> {erro}
        </div>
      ) : null}

      <div style={S.grid}>
        <Card title="Atalhos">
          <div style={S.links}>
            <a href="/admin/periodos" style={S.linkCard}>
              Períodos (abrir/fechar semanas)
            </a>
            <a href="/lancamentos" style={S.linkCard}>
              Lançamentos (checkbox no celular)
            </a>
            <a href="/ranking" style={S.linkCard}>
              Ranking (placar)
            </a>
          </div>
          <div style={{ marginTop: 10, ...S.tip }}>
            <b>Retroativo (modelo seguro):</b> Abra a semana em <b>Períodos</b>, ajuste em <b>Lançamentos</b> e feche.
          </div>
        </Card>

        <Card title="O que já temos">
          <div style={S.kpiRow}>
            <Kpi label="Programas ativos" value={loading ? "…" : total} />
            <Kpi label="Telas" value="Admin / Períodos / Lançamentos / Ranking" />
          </div>

          <div style={{ marginTop: 12 }}>
            <div style={S.mutedSmall}>Programas</div>
            {loading ? (
              <div style={{ marginTop: 10 }}>Carregando…</div>
            ) : (
              <div style={S.list}>
                {programas.map((p) => (
                  <div key={p.id} style={S.listRow} title={p.id}>
                    <div style={{ fontWeight: 950 }}>{p.nome}</div>
                    <div style={S.mutedSmall}>{p.id.slice(0, 8)}…</div>
                  </div>
                ))}
                {programas.length === 0 ? <div style={{ marginTop: 10 }}>Nenhum programa ativo.</div> : null}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Card({ title, children }) {
  return (
    <section style={S.card}>
      <div style={S.cardHeader}>
        <b>{title}</b>
      </div>
      <div style={S.cardBody}>{children}</div>
    </section>
  );
}

function Kpi({ label, value }) {
  return (
    <div style={S.kpi}>
      <div style={S.kpiLabel}>{label}</div>
      <div style={S.kpiValue}>{value}</div>
    </div>
  );
}

const S = {
  wrap: { maxWidth: 1200, margin: "0 auto" },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
  },

  card: {
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,.12)",
    background: "rgba(255,255,255,.06)",
    backdropFilter: "blur(10px)",
    overflow: "hidden",
  },
  cardHeader: {
    padding: 12,
    borderBottom: "1px solid rgba(255,255,255,.10)",
  },
  cardBody: { padding: 12 },

  links: { display: "grid", gap: 10 },
  linkCard: {
    padding: "12px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,.14)",
    background: "rgba(17,24,39,.40)",
    textDecoration: "none",
    color: "inherit",
    fontWeight: 950,
  },

  kpiRow: { display: "grid", gap: 10, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" },
  kpi: {
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,.14)",
    background: "rgba(17,24,39,.40)",
    padding: 12,
  },
  kpiLabel: { fontSize: 12, opacity: 0.75 },
  kpiValue: { fontSize: 16, fontWeight: 950, marginTop: 4 },

  list: { marginTop: 8, display: "grid", gap: 8 },
  listRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,.10)",
    background: "rgba(255,255,255,.04)",
  },

  mutedSmall: { opacity: 0.75, fontSize: 12 },
  tip: {
    padding: 12,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,.12)",
    background: "rgba(255,255,255,.05)",
    opacity: 0.95,
  },
  alertErr: {
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    border: "1px solid rgba(220,38,38,.35)",
    background: "rgba(220,38,38,.12)",
  },
};
