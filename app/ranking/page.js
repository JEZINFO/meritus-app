"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../src/lib/supabase";

export default function RankingPage() {
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [rows, setRows] = useState([]);

  // Por enquanto, você vai informar manualmente via URL:
  // /ranking?programa=<uuid>&periodo=<uuid>
  const [programaId, setProgramaId] = useState("");
  const [periodoId, setPeriodoId] = useState("");

  useEffect(() => {
    const url = new URL(window.location.href);
    setProgramaId(url.searchParams.get("programa") || "");
    setPeriodoId(url.searchParams.get("periodo") || "");
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

    const { data, error } = await supabase
      .from("vw_meritus_ranking_periodo")
      .select("participante_id,total_pontos,qtd_lancamentos,grupo_id")
      .eq("programa_id", programaId)
      .eq("periodo_id", periodoId)
      .order("total_pontos", { ascending: false });

    if (error) {
      setErro(error.message);
      setRows([]);
      setLoading(false);
      return;
    }

    setRows(data || []);
    setLoading(false);
  }

  return (
    <main style={{ padding: 24, maxWidth: 1000, margin: "0 auto", fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Ranking</h1>

      <p style={{ opacity: 0.8 }}>
        Use: <code>/ranking?programa=&lt;uuid&gt;&amp;periodo=&lt;uuid&gt;</code>
      </p>

      {!programaId || !periodoId ? (
        <div style={{ marginTop: 16, padding: 12, border: "1px solid rgba(0,0,0,.15)", borderRadius: 10 }}>
          <b>Faltam parâmetros.</b>
          <div style={{ marginTop: 6 }}>
            Informe <code>programa</code> e <code>periodo</code> na URL.
          </div>
        </div>
      ) : null}

      {loading ? <p style={{ marginTop: 16 }}>Carregando…</p> : null}
      {erro ? (
        <p style={{ marginTop: 16, color: "crimson" }}>
          Erro: {erro}
        </p>
      ) : null}

      {!loading && !erro ? (
        <div style={{ marginTop: 16, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>#</th>
                <th style={th}>Participante (ID)</th>
                <th style={th}>Pontos</th>
                <th style={th}>Lançamentos</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={r.participante_id}>
                  <td style={td}>{idx + 1}</td>
                  <td style={td}><code>{r.participante_id}</code></td>
                  <td style={td}>{Number(r.total_pontos || 0)}</td>
                  <td style={td}>{r.qtd_lancamentos}</td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td style={td} colSpan={4}>Sem dados para este período.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}
    </main>
  );
}

const th = { textAlign: "left", padding: 10, borderBottom: "1px solid rgba(0,0,0,.15)" };
const td = { padding: 10, borderBottom: "1px solid rgba(0,0,0,.08)" };

