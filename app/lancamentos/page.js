"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../src/lib/supabase";

export default function LancamentosPage() {
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);

  const [programas, setProgramas] = useState([]);
  const [programaId, setProgramaId] = useState("");

  const [periodos, setPeriodos] = useState([]);
  const [criterios, setCriterios] = useState([]);

  useEffect(() => {
    iniciar();
  }, []);

  async function iniciar() {
    setLoading(true);
    setErro(null);

    const { data: prog, error: e1 } = await supabase
      .from("meritus_programas")
      .select("id,nome")
      .eq("ativo", true)
      .order("criado_em", { ascending: false });

    if (e1) {
      setErro(e1.message);
      setLoading(false);
      return;
    }

    setProgramas(prog || []);
    const first = prog?.[0]?.id || "";
    setProgramaId(first);
    setLoading(false);
  }

  useEffect(() => {
    if (!programaId) return;
    carregarPrograma(programaId);
  }, [programaId]);

  async function carregarPrograma(pid) {
    setErro(null);

    const [{ data: per, error: e2 }, { data: cri, error: e3 }] = await Promise.all([
      supabase
        .from("meritus_periodos")
        .select("id,rotulo,inicio,fim,status")
        .eq("programa_id", pid)
        .order("inicio", { ascending: false })
        .limit(12),
      supabase
        .from("meritus_criterios")
        .select("id,nome,tipo,peso_padrao")
        .eq("programa_id", pid)
        .eq("ativo", true)
        .order("nome", { ascending: true }),
    ]);

    if (e2) setErro(e2.message);
    if (e3) setErro((prev) => (prev ? prev + " | " + e3.message : e3.message));

    setPeriodos(per || []);
    setCriterios(cri || []);
  }

  return (
    <main style={{ padding: 24, maxWidth: 1100, margin: "0 auto", fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Lançamentos</h1>
      <p style={{ opacity: 0.8, marginBottom: 16 }}>
        MVP: selecionar programa e visualizar períodos + critérios. Próximo passo: planilha de participantes e upsert.
      </p>

      {loading ? <p>Carregando…</p> : null}
      {erro ? <p style={{ color: "crimson" }}>Erro: {erro}</p> : null}

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <label>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Programa</div>
          <select value={programaId} onChange={(e) => setProgramaId(e.target.value)} style={selectStyle}>
            {programas.map((p) => (
              <option key={p.id} value={p.id}>{p.nome}</option>
            ))}
            {programas.length === 0 ? <option value="">(nenhum)</option> : null}
          </select>
        </label>
      </div>

      <section style={{ marginTop: 18 }}>
        <h2 style={{ fontSize: 18, marginBottom: 8 }}>Períodos (últimos 12)</h2>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>Rotulo</th>
                <th style={th}>Início</th>
                <th style={th}>Fim</th>
                <th style={th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {periodos.map((p) => (
                <tr key={p.id}>
                  <td style={td}>{p.rotulo}</td>
                  <td style={td}>{p.inicio}</td>
                  <td style={td}>{p.fim}</td>
                  <td style={td}>{p.status}</td>
                </tr>
              ))}
              {periodos.length === 0 ? (
                <tr><td style={td} colSpan={4}>Sem períodos cadastrados.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section style={{ marginTop: 18 }}>
        <h2 style={{ fontSize: 18, marginBottom: 8 }}>Critérios</h2>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>Nome</th>
                <th style={th}>Tipo</th>
                <th style={th}>Peso</th>
              </tr>
            </thead>
            <tbody>
              {criterios.map((c) => (
                <tr key={c.id}>
                  <td style={td}>{c.nome}</td>
                  <td style={td}>{c.tipo}</td>
                  <td style={td}>{Number(c.peso_padrao)}</td>
                </tr>
              ))}
              {criterios.length === 0 ? (
                <tr><td style={td} colSpan={3}>Sem critérios cadastrados.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

const selectStyle = { padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(0,0,0,.2)" };
const th = { textAlign: "left", padding: 10, borderBottom: "1px solid rgba(0,0,0,.15)" };
const td = { padding: 10, borderBottom: "1px solid rgba(0,0,0,.08)" };

