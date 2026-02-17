"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../src/lib/supabase";

export default function LancamentosPage() {
  const router = useRouter();

  // auth / perfil
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [perfil, setPerfil] = useState(null); // admin | responsavel | leitura
  const [usuarioRow, setUsuarioRow] = useState(null);

  // filtros
  const [programas, setProgramas] = useState([]);
  const [programaId, setProgramaId] = useState("");

  const [grupos, setGrupos] = useState([]);
  const [grupoId, setGrupoId] = useState("");

  const [periodos, setPeriodos] = useState([]);
  const [periodoId, setPeriodoId] = useState("");

  // dados
  const [criterios, setCriterios] = useState([]);
  const [participantes, setParticipantes] = useState([]);

  // lançamentos existentes (map)
  const [lancMap, setLancMap] = useState({}); // key: participanteId|criterioId => { id, valor, peso_aplicado }
  const [erro, setErro] = useState(null);
  const [loadingGrid, setLoadingGrid] = useState(false);

  // status por célula (salvando/salvo/erro)
  const [cellStatus, setCellStatus] = useState({}); // key => 'saving'|'saved'|'error'
  const [cellMsg, setCellMsg] = useState({}); // key => message

  // -------------------------
  // 1) Auth + carregar perfil
  // -------------------------
  useEffect(() => {
    (async () => {
      setAuthLoading(true);
      setErro(null);

      const { data: uData, error: uErr } = await supabase.auth.getUser();
      if (uErr) {
        setErro(uErr.message);
        setAuthLoading(false);
        return;
      }

      const u = uData?.user || null;
      if (!u) {
        // você já tem /login, então redireciona
        router.replace("/login");
        return;
      }

      setUser(u);

      // buscar perfil em meritus_usuarios
      const { data: usr, error: usrErr } = await supabase
        .from("meritus_usuarios")
        .select("id,perfil,organizacao_id,programa_id,grupo_id,ativo")
        .eq("id", u.id)
        .maybeSingle();

      if (usrErr) {
        setErro(usrErr.message);
        setAuthLoading(false);
        return;
      }

      if (!usr || usr.ativo === false) {
        setErro("Usuário não cadastrado/ativo no Meritus (meritus_usuarios).");
        setAuthLoading(false);
        return;
      }

      setUsuarioRow(usr);
      setPerfil(usr.perfil);

      // carregar programas (admin vê todos da org; responsavel pode estar preso num programa ou não)
      await carregarProgramasESelecionarDefault(usr);

      setAuthLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function carregarProgramasESelecionarDefault(usr) {
    setErro(null);

    // Programas visíveis pela RLS: admin/responsavel/leitura
    const { data: progs, error } = await supabase
      .from("meritus_programas")
      .select("id,nome,ativo,organizacao_id")
      .eq("ativo", true)
      .order("criado_em", { ascending: false });

    if (error) {
      setErro(error.message);
      return;
    }

    setProgramas(progs || []);

    // default programa:
    // - se meritus_usuarios.programa_id vier preenchido, usa ele
    // - senão, usa o primeiro
    const preferred = usr.programa_id || progs?.[0]?.id || "";
    setProgramaId(preferred);
  }

  // -------------------------
  // 2) Quando muda Programa -> carregar Grupos, Critérios, Períodos
  // -------------------------
  useEffect(() => {
    if (!programaId || !perfil || !usuarioRow) return;
    (async () => {
      setErro(null);
      setLoadingGrid(true);

      // carregar critérios ativos
      const criteriosReq = supabase
        .from("meritus_criterios")
        .select("id,nome,tipo,peso_padrao,ativo")
        .eq("programa_id", programaId)
        .eq("ativo", true)
        .order("nome", { ascending: true });

      // carregar períodos (prioriza abertos)
      const periodosReq = supabase
        .from("meritus_periodos")
        .select("id,rotulo,inicio,fim,status")
        .eq("programa_id", programaId)
        .order("inicio", { ascending: false })
        .limit(24);

      // carregar grupos
      // - responsavel: trava no grupo dele
      // - admin: lista todos do programa
      const gruposReq =
        perfil === "responsavel" && usuarioRow.grupo_id
          ? supabase
              .from("meritus_grupos")
              .select("id,nome,ativo,programa_id")
              .eq("id", usuarioRow.grupo_id)
              .maybeSingle()
          : supabase
              .from("meritus_grupos")
              .select("id,nome,ativo,programa_id")
              .eq("programa_id", programaId)
              .eq("ativo", true)
              .order("nome", { ascending: true });

      const [crRes, peRes, grRes] = await Promise.all([criteriosReq, periodosReq, gruposReq]);

      if (crRes.error) setErro(crRes.error.message);
      if (peRes.error) setErro((prev) => (prev ? prev + " | " + peRes.error.message : peRes.error.message));

      // grupos: tratar retorno dependendo se veio single ou list
      let grList = [];
      if (perfil === "responsavel" && usuarioRow.grupo_id) {
        if (grRes.error) setErro((prev) => (prev ? prev + " | " + grRes.error.message : grRes.error.message));
        grList = grRes.data ? [grRes.data] : [];
      } else {
        if (grRes.error) setErro((prev) => (prev ? prev + " | " + grRes.error.message : grRes.error.message));
        grList = grRes.data || [];
      }

      setCriterios(crRes.data || []);
      setPeriodos(peRes.data || []);
      setGrupos(grList);

      // defaults:
      // grupo:
      const gDefault = (perfil === "responsavel" && usuarioRow.grupo_id) ? usuarioRow.grupo_id : (grList?.[0]?.id || "");
      setGrupoId(gDefault);

      // período: primeiro ABERTO; se não houver, o mais recente
      const aberto = (peRes.data || []).find((p) => p.status === "aberto");
      setPeriodoId(aberto?.id || (peRes.data?.[0]?.id || ""));

      // limpar grid antigo
      setParticipantes([]);
      setLancMap({});
      setCellStatus({});
      setCellMsg({});

      setLoadingGrid(false);
    })();
  }, [programaId, perfil, usuarioRow]);

  // -------------------------
  // 3) Quando muda Grupo/Período -> carregar Participantes + Lançamentos existentes
  // -------------------------
  useEffect(() => {
    if (!programaId || !grupoId || !periodoId) return;
    (async () => {
      setErro(null);
      setLoadingGrid(true);

      // participantes ativos do grupo
      const { data: part, error: pErr } = await supabase
        .from("meritus_participantes")
        .select("id,nome,ativo,grupo_id,programa_id")
        .eq("programa_id", programaId)
        .eq("grupo_id", grupoId)
        .eq("ativo", true)
        .order("nome", { ascending: true });

      if (pErr) {
        setErro(pErr.message);
        setParticipantes([]);
        setLancMap({});
        setLoadingGrid(false);
        return;
      }

      const partIds = (part || []).map((x) => x.id);

      // lançamentos existentes desse período + participantes
      // (se não houver participantes, não chama)
      let lMap = {};
      if (partIds.length > 0) {
        const { data: lanc, error: lErr } = await supabase
          .from("meritus_lancamentos")
          .select("id,participante_id,criterio_id,valor,peso_aplicado,periodo_id")
          .eq("programa_id", programaId)
          .eq("periodo_id", periodoId)
          .in("participante_id", partIds);

        if (lErr) {
          setErro(lErr.message);
          setParticipantes(part || []);
          setLancMap({});
          setLoadingGrid(false);
          return;
        }

        (lanc || []).forEach((r) => {
          const key = `${r.participante_id}|${r.criterio_id}`;
          lMap[key] = { id: r.id, valor: r.valor, peso_aplicado: r.peso_aplicado };
        });
      }

      setParticipantes(part || []);
      setLancMap(lMap);
      setCellStatus({});
      setCellMsg({});
      setLoadingGrid(false);
    })();
  }, [programaId, grupoId, periodoId]);

  const periodoSelecionado = useMemo(() => {
    return periodos.find((p) => p.id === periodoId) || null;
  }, [periodos, periodoId]);

  const podeEditar = useMemo(() => {
    if (!perfil) return false;
    if (perfil === "admin") return true;
    if (perfil === "responsavel") return periodoSelecionado?.status === "aberto";
    return false;
  }, [perfil, periodoSelecionado]);

  // -------------------------
  // 4) Helpers: ler/mostrar valor
  // -------------------------
  function getValor(participanteId, criterio) {
    const key = `${participanteId}|${criterio.id}`;
    const item = lancMap[key];
    if (!item) return criterio.tipo === "boolean" ? 0 : "";
    return item.valor ?? (criterio.tipo === "boolean" ? 0 : "");
  }

  function setStatus(key, status, message) {
    setCellStatus((prev) => ({ ...prev, [key]: status }));
    if (message) setCellMsg((prev) => ({ ...prev, [key]: message }));
    if (status === "saved") {
      // limpa o "salvo" depois de um tempinho
      setTimeout(() => {
        setCellStatus((prev) => {
          const copy = { ...prev };
          if (copy[key] === "saved") delete copy[key];
          return copy;
        });
        setCellMsg((prev) => {
          const copy = { ...prev };
          delete copy[key];
          return copy;
        });
      }, 1200);
    }
  }

  // -------------------------
  // 5) Salvar célula (upsert)
  // -------------------------
  async function salvarCelula(participanteId, criterio, rawValor) {
    if (!podeEditar) return;

    const key = `${participanteId}|${criterio.id}`;
    setStatus(key, "saving");

    // normaliza valor
    let valor;
    if (criterio.tipo === "boolean") {
      valor = rawValor ? 1 : 0;
    } else {
      const n = Number(rawValor);
      if (Number.isNaN(n)) {
        // se campo vazio, considera 0 (ou você pode decidir não salvar)
        valor = 0;
      } else {
        valor = n;
      }
    }

    // peso aplicado sempre pelo critério (histórico consistente)
    const peso = Number(criterio.peso_padrao ?? 1);

    const payload = {
      programa_id: programaId,
      periodo_id: periodoId,
      participante_id: participanteId,
      criterio_id: criterio.id,
      valor,
      peso_aplicado: peso,
      preenchido_por: user.id,
    };

    const { data, error } = await supabase
      .from("meritus_lancamentos")
      .upsert(payload, { onConflict: "periodo_id,participante_id,criterio_id" })
      .select("id,participante_id,criterio_id,valor,peso_aplicado")
      .maybeSingle();

    if (error) {
      setStatus(key, "error", error.message);
      return;
    }

    // atualiza map local
    setLancMap((prev) => {
      const copy = { ...prev };
      copy[key] = { id: data?.id || prev[key]?.id, valor, peso_aplicado: peso };
      return copy;
    });

    setStatus(key, "saved");
  }

  // -------------------------
  // UI
  // -------------------------
  if (authLoading) {
    return (
      <main style={page}>
        <h1 style={h1}>Lançamentos</h1>
        <p>Carregando…</p>
      </main>
    );
  }

  return (
    <main style={page}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={h1}>Lançamentos</h1>
          <p style={muted}>
            Modo planilha • salva automático • {perfil === "admin" ? "Admin" : perfil === "responsavel" ? "Responsável" : "Leitura"}
            {periodoSelecionado ? ` • Período: ${periodoSelecionado.status}` : ""}
          </p>
        </div>

        <button
          onClick={async () => {
            await supabase.auth.signOut();
            router.replace("/login");
          }}
          style={btnGhost}
        >
          Sair
        </button>
      </div>

      {erro ? (
        <div style={alertErr}>
          <b>Erro:</b> {erro}
        </div>
      ) : null}

      {/* Filtros */}
      <div style={filters}>
        <label style={field}>
          <div style={label}>Programa</div>
          <select
            value={programaId}
            onChange={(e) => setProgramaId(e.target.value)}
            style={select}
            disabled={perfil === "responsavel" && !!usuarioRow?.programa_id}
            title={perfil === "responsavel" && !!usuarioRow?.programa_id ? "Responsável travado no programa" : ""}
          >
            {programas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
            {programas.length === 0 ? <option value="">(nenhum)</option> : null}
          </select>
        </label>

        <label style={field}>
          <div style={label}>Grupo</div>
          <select
            value={grupoId}
            onChange={(e) => setGrupoId(e.target.value)}
            style={select}
            disabled={perfil === "responsavel"}
            title={perfil === "responsavel" ? "Responsável travado no próprio grupo" : ""}
          >
            {grupos.map((g) => (
              <option key={g.id} value={g.id}>
                {g.nome}
              </option>
            ))}
            {grupos.length === 0 ? <option value="">(nenhum)</option> : null}
          </select>
        </label>

        <label style={field}>
          <div style={label}>Período</div>
          <select value={periodoId} onChange={(e) => setPeriodoId(e.target.value)} style={select}>
            {periodos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.rotulo} {p.status === "aberto" ? "(aberto)" : "(fechado)"}
              </option>
            ))}
            {periodos.length === 0 ? <option value="">(nenhum)</option> : null}
          </select>
        </label>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={pill}>
            Participantes: <b>{participantes.length}</b>
          </span>
          <span style={pill}>
            Critérios: <b>{criterios.length}</b>
          </span>
          <span style={pill}>
            Edição: <b>{podeEditar ? "ON" : "OFF"}</b>
          </span>
        </div>
      </div>

      {/* Grid */}
      <div style={{ marginTop: 14, border: "1px solid rgba(0,0,0,.12)", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ padding: 12, borderBottom: "1px solid rgba(0,0,0,.08)", background: "rgba(0,0,0,.02)" }}>
          <b>Planilha</b> <span style={muted}>— clique no checkbox / edite números e saia do campo para salvar</span>
          {!podeEditar ? (
            <div style={{ marginTop: 6, fontSize: 13, color: "crimson" }}>
              {perfil === "responsavel" && periodoSelecionado?.status !== "aberto"
                ? "Período fechado: responsável não pode editar."
                : perfil === "leitura"
                ? "Perfil leitura: não pode editar."
                : ""}
            </div>
          ) : null}
        </div>

        {loadingGrid ? (
          <div style={{ padding: 14 }}>Carregando dados…</div>
        ) : participantes.length === 0 ? (
          <div style={{ padding: 14 }}>Sem participantes para este grupo.</div>
        ) : criterios.length === 0 ? (
          <div style={{ padding: 14 }}>Sem critérios cadastrados no programa.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
              <thead>
                <tr>
                  <th style={thSticky}>Participante</th>
                  {criterios.map((c) => (
                    <th key={c.id} style={th}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <span>{c.nome}</span>
                        <span style={{ fontSize: 12, opacity: 0.7 }}>
                          {c.tipo} • peso {Number(c.peso_padrao ?? 1)}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {participantes.map((p) => (
                  <tr key={p.id}>
                    <td style={tdSticky}>{p.nome}</td>

                    {criterios.map((c) => {
                      const key = `${p.id}|${c.id}`;
                      const status = cellStatus[key];
                      const msg = cellMsg[key];
                      const v = getValor(p.id, c);

                      return (
                        <td key={c.id} style={td}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            {c.tipo === "boolean" ? (
                              <input
                                type="checkbox"
                                checked={Number(v) === 1}
                                disabled={!podeEditar}
                                onChange={(e) => salvarCelula(p.id, c, e.target.checked)}
                                style={{ width: 18, height: 18, cursor: podeEditar ? "pointer" : "not-allowed" }}
                                title={!podeEditar ? "Edição desativada" : "Clique para marcar/desmarcar"}
                              />
                            ) : (
                              <input
                                type="number"
                                step="1"
                                inputMode="numeric"
                                defaultValue={v === "" ? "" : Number(v)}
                                disabled={!podeEditar}
                                onBlur={(e) => salvarCelula(p.id, c, e.target.value)}
                                style={{
                                  ...numInput,
                                  borderColor:
                                    status === "error"
                                      ? "crimson"
                                      : status === "saving"
                                      ? "rgba(0,0,0,.35)"
                                      : "rgba(0,0,0,.2)",
                                }}
                                title={!podeEditar ? "Edição desativada" : "Edite e saia do campo para salvar"}
                              />
                            )}

                            <StatusDot status={status} msg={msg} />
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}

function StatusDot({ status, msg }) {
  let text = "";
  let title = "";
  if (status === "saving") {
    text = "⏳";
    title = "Salvando…";
  } else if (status === "saved") {
    text = "✅";
    title = "Salvo";
  } else if (status === "error") {
    text = "⚠️";
    title = msg || "Erro ao salvar";
  } else {
    return <span style={{ width: 18 }} />;
  }
  return (
    <span style={{ width: 18, textAlign: "center" }} title={title}>
      {text}
    </span>
  );
}

// Styles (simples, sem libs)
const page = { padding: 24, maxWidth: 1250, margin: "0 auto", fontFamily: "system-ui" };
const h1 = { fontSize: 28, marginBottom: 6 };
const muted = { fontSize: 14, opacity: 0.75 };

const alertErr = {
  marginTop: 12,
  padding: 12,
  borderRadius: 12,
  border: "1px solid rgba(220,20,60,.35)",
  background: "rgba(220,20,60,.06)",
};

const filters = {
  marginTop: 14,
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
  alignItems: "flex-end",
  padding: 12,
  borderRadius: 14,
  border: "1px solid rgba(0,0,0,.12)",
  background: "rgba(0,0,0,.02)",
};

const field = { display: "flex", flexDirection: "column", gap: 6 };
const label = { fontSize: 12, opacity: 0.75 };
const select = { padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(0,0,0,.2)", minWidth: 240 };

const pill = {
  padding: "8px 10px",
  borderRadius: 999,
  border: "1px solid rgba(0,0,0,.12)",
  background: "white",
  fontSize: 13,
};

const btnGhost = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,.15)",
  background: "white",
  cursor: "pointer",
};

const th = { textAlign: "left", padding: 10, borderBottom: "1px solid rgba(0,0,0,.12)", whiteSpace: "nowrap" };
const td = { padding: 10, borderBottom: "1px solid rgba(0,0,0,.06)" };

const thSticky = {
  ...th,
  position: "sticky",
  left: 0,
  background: "white",
  zIndex: 2,
  minWidth: 220,
  maxWidth: 320,
};

const tdSticky = {
  ...td,
  position: "sticky",
  left: 0,
  background: "white",
  zIndex: 1,
  minWidth: 220,
  maxWidth: 320,
  fontWeight: 600,
};

const numInput = {
  width: 90,
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid rgba(0,0,0,.2)",
};
