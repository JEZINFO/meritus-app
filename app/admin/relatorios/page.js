"use client";

import { useEffect, useMemo, useState } from "react";
import RequireRole from "../../../components/admin/RequireRole";
import { Card, PageTitle, Button, Input, Select } from "../../../components/admin/ui";
import { supabase } from "@/src/lib/supabase";
import { useProgram } from "../../../components/admin/ProgramContext";
import { getProfile } from "@/src/lib/profile";

const ALL_GRUPOS = "__ALL__";

function toCsv(rows) {
  const esc = (v) => {
    const s = String(v ?? "");
    if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = rows.map((r) => r.map(esc).join(";"));
  return "\uFEFF" + lines.join("\n");
}

export default function AdminRelatorios() {
  const { programaId, programas } = useProgram();

  const [orgId, setOrgId] = useState("");
  const [erro, setErro] = useState(null);
  const [loading, setLoading] = useState(false);

  const [periodos, setPeriodos] = useState([]);
  const [periodoId, setPeriodoId] = useState("");

  const [grupos, setGrupos] = useState([]);
  const [grupoId, setGrupoId] = useState(ALL_GRUPOS);

  const [busca, setBusca] = useState("");

  const [linhas, setLinhas] = useState([]); // por criterio
  const [resumo, setResumo] = useState({ participantes: 0, criterios: 0, marcacoes: 0, pontos: 0 });

  useEffect(() => {
    (async () => {
      const res = await getProfile();
      if (res.ok) setOrgId(res.profile.organizacao_id);
    })();
  }, []);

  useEffect(() => {
    if (!programaId || !orgId) return;
    (async () => {
      setErro(null);
      setLoading(true);

      const [pRes, gRes] = await Promise.all([
        supabase
          .from("meritus_periodos")
          .select("id,rotulo,inicio,fim,status")
          .eq("programa_id", programaId)
          .order("inicio", { ascending: false })
          .limit(200),
        supabase
          .from("grupos")
          .select("id,nome,ativo,ordem")
          .eq("organizacao_id", orgId)
          .eq("ativo", true)
          .order("ordem", { ascending: true })
          .order("nome", { ascending: true }),
      ]);

      if (pRes.error) setErro(pRes.error.message);
      if (gRes.error) setErro((e) => (e ? e + " | " : "") + gRes.error.message);

      const plist = pRes.data || [];
      setPeriodos(plist);
      const aberto = plist.find((p) => p.status === "aberto");
      setPeriodoId(aberto?.id || plist?.[0]?.id || "");

      setGrupos(gRes.data || []);
      setGrupoId(ALL_GRUPOS);

      setLoading(false);
    })();
  }, [programaId, orgId]);

  useEffect(() => {
    if (!programaId || !periodoId || !orgId) return;
    (async () => {
      setErro(null);
      setLoading(true);

      // participantes filtrados
      let partQuery = supabase
        .from("participantes")
        .select("id,nome,grupo_id,ativo")
        .eq("organizacao_id", orgId)
        .eq("ativo", true);

      if (grupoId !== ALL_GRUPOS) partQuery = partQuery.eq("grupo_id", grupoId);

      const { data: part, error: pErr } = await partQuery.order("nome", { ascending: true }).limit(10000);
      if (pErr) {
        setErro(pErr.message);
        setLinhas([]);
        setLoading(false);
        return;
      }
      const partIds = (part || []).map((x) => x.id);

      // critérios
      const { data: crit, error: cErr } = await supabase
        .from("criterios")
        .select("id,nome,pontos_base,ordem,ativo")
        .eq("organizacao_id", orgId)
        .eq("ativo", true)
        .order("ordem", { ascending: true })
        .order("nome", { ascending: true })
        .limit(5000);

      if (cErr) {
        setErro(cErr.message);
        setLinhas([]);
        setLoading(false);
        return;
      }

      if (partIds.length === 0) {
        setLinhas((crit || []).map((c) => ({ ...c, marcacoes: 0, total_pontos: 0 })));
        setResumo({ participantes: 0, criterios: (crit || []).length, marcacoes: 0, pontos: 0 });
        setLoading(false);
        return;
      }

      const { data: lanc, error: lErr } = await supabase
        .from("meritus_lancamentos")
        .select("participante_id,criterio_id,valor")
        .eq("programa_id", programaId)
        .eq("periodo_id", periodoId)
        .in("participante_id", partIds)
        .limit(100000);

      if (lErr) {
        setErro(lErr.message);
        setLinhas([]);
        setLoading(false);
        return;
      }

      // Contar marcações por criterio (checkbox)
      const countByCrit = {};
      for (const r of lanc || []) {
        const v = Number(r.valor ?? 0);
        if (v >= 1) countByCrit[r.criterio_id] = (countByCrit[r.criterio_id] || 0) + 1;
      }

      let marcacoes = 0;
      let pontos = 0;
      const table = (crit || []).map((c) => {
        const m = countByCrit[c.id] || 0;
        const pb = Number(c.pontos_base ?? 1);
        const tp = m * pb;
        marcacoes += m;
        pontos += tp;
        return { ...c, marcacoes: m, total_pontos: tp, pontos_base: pb };
      });

      setLinhas(table);
      setResumo({ participantes: (part || []).length, criterios: (crit || []).length, marcacoes, pontos });
      setLoading(false);
    })();
  }, [programaId, periodoId, grupoId, orgId]);

  const programaNome = useMemo(
    () => (programas || []).find((p) => p.id === programaId)?.nome || "—",
    [programas, programaId]
  );

  const filtrado = useMemo(() => {
    const q = (busca || "").trim().toLowerCase();
    if (!q) return linhas;
    return linhas.filter((x) => (x.nome || "").toLowerCase().includes(q));
  }, [linhas, busca]);

  function exportarCsv() {
    const head = ["criterio", "pontos_base", "marcacoes", "total_pontos"];
    const body = filtrado.map((c) => [c.nome, c.pontos_base, c.marcacoes, c.total_pontos]);
    const csv = toCsv([head, ...body]);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `meritus_relatorio_${programaId}_${periodoId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <RequireRole allow={["admin", "relatorio"]}>
      <div className="space-y-4">
        <PageTitle
          title="Relatórios"
          subtitle="Resumo por critério (marcação e pontos) para o período selecionado."
          right={
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="secondary" onClick={exportarCsv} disabled={loading || filtrado.length === 0}>
                Exportar CSV
              </Button>
            </div>
          }
        />

        <Card className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <div className="text-xs text-black/60 mb-1">Programa</div>
              <div className="rounded-xl border border-black/10 px-3 py-2 text-sm bg-black/5">{programaNome}</div>
            </div>

            <div>
              <div className="text-xs text-black/60 mb-1">Período</div>
              <Select value={periodoId} onChange={(e) => setPeriodoId(e.target.value)} disabled={!programaId || loading}>
                {periodos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.rotulo} {p.status === "aberto" ? "(aberto)" : "(fechado)"}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <div className="text-xs text-black/60 mb-1">Grupo</div>
              <Select value={grupoId} onChange={(e) => setGrupoId(e.target.value)} disabled={!programaId || loading}>
                <option value={ALL_GRUPOS}>Todos</option>
                {grupos.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nome}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="md:col-span-2">
              <div className="text-xs text-black/60 mb-1">Buscar critério</div>
              <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Digite o nome do critério..." />
            </div>

            <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
              <div className="text-xs text-black/60">Resumo</div>
              <div className="mt-1 text-sm">
                <div className="flex justify-between"><span>Participantes</span><b>{resumo.participantes}</b></div>
                <div className="flex justify-between"><span>Critérios</span><b>{resumo.criterios}</b></div>
                <div className="flex justify-between"><span>Marcações</span><b>{resumo.marcacoes}</b></div>
                <div className="flex justify-between"><span>Pontos</span><b>{resumo.pontos}</b></div>
              </div>
            </div>
          </div>

          {erro ? <div className="text-sm text-red-600">{erro}</div> : null}
        </Card>

        <Card className="p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-black/10 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">Resumo por critério</div>
              <div className="text-xs text-black/50">Marcações contam valor ≥ 1 (checkbox).</div>
            </div>
            <div className="text-xs text-black/50">{loading ? "Atualizando..." : `${filtrado.length} itens`}</div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-black/5 text-black/60">
                  <th className="text-left px-5 py-3">Critério</th>
                  <th className="text-right px-5 py-3">Pontos base</th>
                  <th className="text-right px-5 py-3">Marcações</th>
                  <th className="text-right px-5 py-3">Total pontos</th>
                </tr>
              </thead>
              <tbody>
                {filtrado.map((c) => (
                  <tr key={c.id} className="border-t border-black/5 hover:bg-black/[0.03]">
                    <td className="px-5 py-3 font-medium">{c.nome}</td>
                    <td className="px-5 py-3 text-right">{c.pontos_base}</td>
                    <td className="px-5 py-3 text-right">{c.marcacoes}</td>
                    <td className="px-5 py-3 text-right font-semibold">{c.total_pontos}</td>
                  </tr>
                ))}
                {filtrado.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-10 text-center text-black/60">
                      {loading ? "Carregando..." : "Sem dados para este filtro."}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </RequireRole>
  );
}
