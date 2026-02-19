"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/src/lib/supabase";

/**
 * Lançamentos (Premium)
 * - Mobile first (cards por padrão)
 * - Checkbox/click salva automático (upsert)
 * - Visual consistente com Admin layout premium
 */

const ALL_GRUPOS = "__ALL__";

export default function LancamentosPage() {
  const router = useRouter();

  // auth / perfil
  const [authLoading, setAuthLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [user, setUser] = useState(null);
  const [perfil, setPerfil] = useState(null); // admin | fiscal | relatorio | responsavel | leitura
  const [usuarioRow, setUsuarioRow] = useState(null);
  const [allowedGroupIds, setAllowedGroupIds] = useState([]); // fiscal/responsavel: grupos permitidos

  // responsive
  const [isMobile, setIsMobile] = useState(false);
  const [viewMode, setViewMode] = useState("auto"); // auto | cards | table

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
  const [loadingGrid, setLoadingGrid] = useState(false);

  // status por célula
  const [cellStatus, setCellStatus] = useState({}); // key => 'saving'|'saved'|'error'
  const [cellMsg, setCellMsg] = useState({}); // key => message

  // -------------------------
  // Responsive watcher
  // -------------------------
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 860px)");
    const apply = () => setIsMobile(!!mq.matches);
    apply();
    mq.addEventListener?.("change", apply);
    return () => mq.removeEventListener?.("change", apply);
  }, []);

  const efetivoView = useMemo(() => {
    if (viewMode === "cards") return "cards";
    if (viewMode === "table") return "table";
    return isMobile ? "cards" : "table";
  }, [viewMode, isMobile]);

  // -------------------------
  // 1) Auth + carregar perfil
  // -------------------------
  useEffect(() => {
    (async () => {
      setAuthLoading(true);
      setErro(null);

      const { data: sData, error: sErr } = await supabase.auth.getSession();
      if (sErr) {
        setErro(sErr.message);
        setAuthLoading(false);
        return;
      }

      const u = sData?.session?.user || null;
      if (!u) {
        router.replace("/login?next=/lancamentos");
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

      // Fiscal/Responsável: pode ter acesso a 1+ grupos via tabela meritus_usuario_grupos
      if (usr.perfil === "fiscal") {
        const { data: ug, error: ugErr } = await supabase
          .from("meritus_usuario_grupos")
          .select("grupo_id")
          .eq("usuario_id", usr.id);

        if (ugErr) {
          setErro(ugErr.message);
          setAuthLoading(false);
          return;
        }
        setAllowedGroupIds((ug || []).map((x) => x.grupo_id).filter(Boolean));
      } else {
        setAllowedGroupIds([]);
      }

      await carregarProgramasESelecionarDefault(usr);

      setAuthLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function carregarProgramasESelecionarDefault(usr) {
    setErro(null);

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

      const criteriosReq = (async () => {
        // Resiliente: se a coluna "ordem" ainda não existe (migração não aplicada),
        // faz fallback para ordenação por nome.
        const first = await supabase
          .from("meritus_criterios")
          .select("id,nome,tipo,peso_padrao,pontos_base,ordem,ativo")
          .eq("programa_id", programaId)
          .eq("ativo", true)
          .order("ordem", { ascending: true })
          .order("nome", { ascending: true });

        if (first.error && String(first.error.message || "").toLowerCase().includes('column') && String(first.error.message || "").toLowerCase().includes('ordem')) {
          return await supabase
            .from("meritus_criterios")
            .select("id,nome,tipo,peso_padrao,pontos_base,ativo")
            .eq("programa_id", programaId)
            .eq("ativo", true)
            .order("nome", { ascending: true });
        }

        return first;
      })();

      let periodosReq = supabase
        .from("meritus_periodos")
        .select("id,rotulo,inicio,fim,status")
        .eq("programa_id", programaId)
        // Mostra TODOS os períodos (sem limitar) e ordena por rótulo (alfabético)
        .order("rotulo", { ascending: true })
        // segurança: caso seu programa tenha muitos períodos, mantenha um teto alto
        .limit(500);

      if (perfil === "fiscal") {
        periodosReq = periodosReq.eq("status", "aberto");
      }


      const gruposReq =
        (perfil === "fiscal" || perfil === "fiscal") && (allowedGroupIds?.length || usuarioRow?.grupo_id)
          ? supabase
              .from("meritus_grupos")
              .select("id,nome,ativo,programa_id")
              .eq("programa_id", programaId)
              .eq("ativo", true)
              .in("id", (allowedGroupIds && allowedGroupIds.length > 0) ? allowedGroupIds : [usuarioRow.grupo_id])
              .order("nome", { ascending: true })
          : supabase
              .from("meritus_grupos")
              .select("id,nome,ativo,programa_id")
              .eq("programa_id", programaId)
              .eq("ativo", true)
              .order("nome", { ascending: true });

const [crRes, peRes, grRes] = await Promise.all([criteriosReq, periodosReq, gruposReq]);

      let errAgg = null;
      if (crRes.error) errAgg = crRes.error.message;
      if (peRes.error) errAgg = errAgg ? errAgg + " | " + peRes.error.message : peRes.error.message;

      let grList = [];
      if (perfil === "fiscal" && usuarioRow.grupo_id) {
        if (grRes.error) errAgg = errAgg ? errAgg + " | " + grRes.error.message : grRes.error.message;
        grList = grRes.data ? [grRes.data] : [];
      } else {
        if (grRes.error) errAgg = errAgg ? errAgg + " | " + grRes.error.message : grRes.error.message;
        grList = grRes.data || [];
      }

      if (errAgg) setErro(errAgg);

      setCriterios(crRes.data || []);
      setPeriodos(peRes.data || []);
      setGrupos(grList);

      const gDefault =
        (perfil === "fiscal" || perfil === "fiscal") && (allowedGroupIds?.length || usuarioRow?.grupo_id)
          ? ALL_GRUPOS // "Todos" = todos os grupos permitidos do usuário
          : (perfil === "admin" || perfil === "relatorio" || perfil === "leitura")
          ? ALL_GRUPOS
          : grList?.[0]?.id || ALL_GRUPOS;
      setGrupoId(gDefault);

      const aberto = (peRes.data || []).find((p) => p.status === "aberto");
      setPeriodoId(aberto?.id || (peRes.data?.[0]?.id || ""));

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

      let partQuery = supabase
        .from("meritus_participantes")
        .select("id,nome,ativo,grupo_id,programa_id")
        .eq("programa_id", programaId)
        .eq("ativo", true);

      // Se Grupo != TODOS, filtra por grupo_id
      if (grupoId !== ALL_GRUPOS) {
        partQuery = partQuery.eq("grupo_id", grupoId);
      } else {
        // Fiscal/Responsável: "Todos" = todos os grupos permitidos
        if (perfil === "fiscal" || perfil === "fiscal") {
          if (allowedGroupIds && allowedGroupIds.length > 0) {
            partQuery = partQuery.in("grupo_id", allowedGroupIds);
          } else if (usuarioRow?.grupo_id) {
            partQuery = partQuery.eq("grupo_id", usuarioRow.grupo_id);
          } else {
            // sem grupos atribuídos
            setErro("Fiscal sem grupos atribuídos. Vincule grupos em meritus_usuario_grupos.");
            setParticipantes([]);
            setLancMap({});
            setLoadingGrid(false);
            return;
          }
        }
      }

      const { data: part, error: pErr } = await partQuery.order("nome", { ascending: true });
      if (pErr) {
        setErro(pErr.message);
        setParticipantes([]);
        setLancMap({});
        setLoadingGrid(false);
        return;
      }

      const partIds = (part || []).map((x) => x.id);

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
    if (perfil === "fiscal") return periodoSelecionado?.status === "aberto";
    return false;
  }, [perfil, periodoSelecionado]);

  // -------------------------
  // Helpers: valor / status
  // -------------------------
  function getValor(participanteId, criterioId) {
    const key = `${participanteId}|${criterioId}`;
    const item = lancMap[key];
    if (!item) return 0;
    return Number(item.valor ?? 0);
  }

  function setStatus(key, status, message) {
    setCellStatus((prev) => ({ ...prev, [key]: status }));
    if (message) setCellMsg((prev) => ({ ...prev, [key]: message }));
    if (status === "saved") {
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
      }, 900);
    }
  }

  async function salvarCelula(participanteId, criterio, checked) {
    if (!podeEditar) return;

    const key = `${participanteId}|${criterio.id}`;
    setStatus(key, "saving");

    const valor = checked ? 1 : 0;

    const payload = {
      programa_id: programaId,
      periodo_id: periodoId,
      participante_id: participanteId,
      criterio_id: criterio.id,
      valor,
      peso_aplicado: Number(criterio.peso_padrao ?? 1),
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

    setLancMap((prev) => {
      const copy = { ...prev };
      copy[key] = { id: data?.id || prev[key]?.id, valor, peso_aplicado: payload.peso_aplicado };
      return copy;
    });

    setStatus(key, "saved");
  }

  // Totais (frontend)
  function pontosCelula(participanteId, criterio) {
    const v = getValor(participanteId, criterio.id);
    const base = Number(criterio.pontos_base ?? 1);
    return v >= 1 ? base : 0;
  }

  function totalParticipante(participanteId) {
    return criterios.reduce((acc, c) => acc + pontosCelula(participanteId, c), 0);
  }

  const totalGrupo = useMemo(() => {
    return participantes.reduce((acc, p) => acc + totalParticipante(p.id), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participantes, criterios, lancMap]);

  const linkRanking = useMemo(() => {
    if (!programaId || !periodoId) return "/ranking";
    return `/ranking?programa=${programaId}&periodo=${periodoId}`;
  }, [programaId, periodoId]);

  // -------------------------
  // UI
  // -------------------------
  if (authLoading) {
    return (
      <main style={S.page}>
        <div style={S.bgGlowA} />
        <div style={S.bgGlowB} />
        <div style={S.shell}>
          <div style={S.skelHero} />
          <div style={S.skelLine} />
          <div style={S.skelGrid}>
            <div style={S.skelCard} />
            <div style={S.skelCard} />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main style={S.page}>
      <div style={S.bgGlowA} />
      <div style={S.bgGlowB} />

      <div style={S.shell}>
        {/* Header */}
        <header style={S.header}>
          <div style={{ minWidth: 0 }}>
            <div style={S.kicker}>Meritus</div>
            <div style={S.titleRow}>
              <h1 style={S.h1}>Lançamentos</h1>

              <span style={S.pill}>
                {perfil === "admin" ? "Admin" : perfil === "fiscal" ? "Responsável" : "Leitura"}
              </span>

              {periodoSelecionado ? (
                <span
                  style={{
                    ...S.pill,
                    background:
                      periodoSelecionado.status === "aberto" ? "rgba(34,197,94,.14)" : "rgba(245,158,11,.12)",
                    borderColor:
                      periodoSelecionado.status === "aberto" ? "rgba(34,197,94,.30)" : "rgba(245,158,11,.25)",
                    color: periodoSelecionado.status === "aberto" ? "#eafff1" : "rgba(229,231,235,.92)",
                  }}
                >
                  {periodoSelecionado.status === "aberto" ? "Período aberto" : "Período fechado"}
                </span>
              ) : null}

              <span style={S.mutedSmall}>salva automático</span>
            </div>

            <div style={S.subtitle}>
              Toque para marcar/desmarcar. O peso/pontos vêm do cadastro do programa.
            </div>
          </div>

          <div style={S.headerActions}>
            <a href={linkRanking} style={S.btnSoft} aria-disabled={!programaId || !periodoId}>
              Ranking
            </a>

            <button
              onClick={async () => {
                await supabase.auth.signOut();
                router.replace("/login");
              }}
              style={S.btnGhost}
            >
              Sair
            </button>
          </div>
        </header>

        {erro ? (
          <div style={S.alertErr}>
            <b>Erro:</b> {erro}
          </div>
        ) : null}

        {/* Filters */}
        <section style={S.card}>
          <div style={S.cardHeader}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <b>Filtros</b>
              <span style={S.badge}>rápido</span>
            </div>

            <div style={S.toggle}>
              <button onClick={() => setViewMode("auto")} style={viewMode === "auto" ? S.toggleActive : S.toggleBtn}>
                Auto
              </button>
              <button
                onClick={() => setViewMode("cards")}
                style={viewMode === "cards" ? S.toggleActive : S.toggleBtn}
              >
                Cards
              </button>
              <button
                onClick={() => setViewMode("table")}
                style={viewMode === "table" ? S.toggleActive : S.toggleBtn}
              >
                Tabela
              </button>
            </div>
          </div>

          <div style={S.cardBody}>
            <div style={{ ...S.filtersGrid, gridTemplateColumns: isMobile ? "1fr" : S.filtersGrid.gridTemplateColumns }}>
              <Field label="Programa">
                <select
                  value={programaId}
                  onChange={(e) => setProgramaId(e.target.value)}
                  style={S.select}
                  disabled={perfil === "fiscal" && !!usuarioRow?.programa_id}
                >
                  {programas.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                  {programas.length === 0 ? <option value="">(nenhum)</option> : null}
                </select>
              </Field>

              <Field label="Grupo">
                <select
                  value={grupoId}
                  onChange={(e) => setGrupoId(e.target.value)}
                  style={S.select}
                  disabled={false}
                >
                  {(perfil === "admin" || perfil === "fiscal") ? <option value={ALL_GRUPOS}>Todos</option> : null}
                  {grupos.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.nome}
                    </option>
                  ))}
                  {grupos.length === 0 ? <option value="">(nenhum)</option> : null}
                </select>
              </Field>

              <Field label="Período">
                <select value={periodoId} onChange={(e) => setPeriodoId(e.target.value)} style={S.select}>
                  {periodos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.rotulo} {p.status === "aberto" ? "(aberto)" : "(fechado)"}
                    </option>
                  ))}
                  {periodos.length === 0 ? <option value="">(nenhum)</option> : null}
                </select>
              </Field>
            </div>

            <div
              style={{
                ...S.statsRow,
                gridTemplateColumns: isMobile ? "repeat(2, minmax(0, 1fr))" : S.statsRow.gridTemplateColumns,
              }}
            >
              <Stat title="Participantes" value={participantes.length} />
              <Stat title="Itens" value={criterios.length} />
              <Stat title="Total do grupo" value={totalGrupo} />
              <Stat title="Edição" value={podeEditar ? "ON" : "OFF"} tone={podeEditar ? "ok" : "warn"} />
            </div>

            {!podeEditar ? (
              <div style={S.alertWarn}>
                <b>Atenção:</b>{" "}
                {perfil === "fiscal" && periodoSelecionado?.status !== "aberto"
                  ? "Período fechado — sem edição."
                  : perfil === "leitura"
                  ? "Seu perfil é somente leitura."
                  : "Edição desativada."}
              </div>
            ) : null}
          </div>
        </section>

        {/* Grid */}
        <section style={S.card}>
          <div style={S.cardHeader}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <b>Planilha</b>
              <span style={S.mutedSmall}>toque para marcar • salva automático</span>
            </div>
            <a href={linkRanking} style={S.link} aria-disabled={!programaId || !periodoId}>
              Abrir placar →
            </a>
          </div>

          <div style={S.cardBody}>
            {loadingGrid ? (
              <div style={{ padding: 6 }}>Carregando dados…</div>
            ) : participantes.length === 0 ? (
              <Empty title="Sem participantes" desc="Carregue os participantes deste grupo para começar." />
            ) : criterios.length === 0 ? (
              <Empty title="Sem itens (critérios)" desc="Cadastre critérios/pontos no programa para habilitar a planilha." />
            ) : efetivoView === "cards" ? (
              <CardsView
                participantes={participantes}
                criterios={criterios}
                podeEditar={podeEditar}
                getValor={getValor}
                salvarCelula={salvarCelula}
                totalParticipante={totalParticipante}
                cellStatus={cellStatus}
                cellMsg={cellMsg}
                isMobile={isMobile}
              />
            ) : (
              <TableView
                participantes={participantes}
                criterios={criterios}
                podeEditar={podeEditar}
                getValor={getValor}
                salvarCelula={salvarCelula}
                totalParticipante={totalParticipante}
                cellStatus={cellStatus}
                cellMsg={cellMsg}
              />
            )}
          </div>

          <div style={S.cardFooter}>
            <div style={S.footerRow}>
              <span style={S.mutedSmall}>
                Dica: para ajustes retroativos, o Admin pode abrir semanas em <a href="/admin/periodos" style={S.linkInline}>Períodos</a>.
              </span>
              <span style={S.mutedSmall}>
                Status: <Dot color="rgba(59,130,246,.95)" /> salvando <Dot color="rgba(34,197,94,.95)" /> salvo{" "}
                <Dot color="rgba(220,38,38,.95)" /> erro
              </span>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

/* -------------------- UI pieces -------------------- */

function Field({ label, children }) {
  return (
    <label style={S.field}>
      <div style={S.label}>{label}</div>
      {children}
    </label>
  );
}

function Stat({ title, value, tone }) {
  const style =
    tone === "ok"
      ? { ...S.statCard, borderColor: "rgba(34,197,94,.35)" }
      : tone === "warn"
      ? { ...S.statCard, borderColor: "rgba(245,158,11,.35)" }
      : S.statCard;

  return (
    <div style={style}>
      <div style={S.statTitle}>{title}</div>
      <div style={S.statValue}>{value}</div>
    </div>
  );
}

function Empty({ title, desc }) {
  return (
    <div style={S.empty}>
      <div style={S.emptyTitle}>{title}</div>
      <div style={S.emptyDesc}>{desc}</div>
    </div>
  );
}

function Dot({ color }) {
  return <span style={{ ...S.dot, background: color }} />;
}

function CardsView({
  participantes,
  criterios,
  podeEditar,
  getValor,
  salvarCelula,
  totalParticipante,
  cellStatus,
  cellMsg,
  isMobile,
}) {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {participantes.map((p) => {
        const total = totalParticipante(p.id);
        return (
          <details key={p.id} style={S.pCard} open={isMobile}>
            <summary style={S.pCardHeader}>
              <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                <span style={S.pName}>{p.nome}</span>
                <span style={S.mutedSmall}>{criterios.length} itens</span>
              </div>

              <div style={S.totalPill}>
                <span style={S.mutedSmall}>Total</span>
                <b style={{ fontSize: 16 }}>{total}</b>
              </div>
            </summary>

            <div style={{ ...S.criteriaGrid, gridTemplateColumns: isMobile ? "1fr" : S.criteriaGrid.gridTemplateColumns }}>
              {criterios.map((c) => {
                const key = `${p.id}|${c.id}`;
                const checked = getValor(p.id, c.id) >= 1;
                const status = cellStatus[key];
                const msg = cellMsg[key];

                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => salvarCelula(p.id, c, !checked)}
                    disabled={!podeEditar}
                    style={{ ...(checked ? S.critOn : S.critOff), opacity: !podeEditar ? 0.62 : 1 }}
                    title={!podeEditar ? "Edição desativada" : c.nome}
                  >
                    <div style={S.critRow}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                        <span style={S.critName}>{c.nome}</span>
                        <span style={S.mutedSmall}>{Number(c.pontos_base ?? 1)} pts</span>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={S.checkMark}>{checked ? "✓" : ""}</span>
                        <StatusDot status={status} msg={msg} />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </details>
        );
      })}
    </div>
  );
}

function TableView({
  participantes,
  criterios,
  podeEditar,
  getValor,
  salvarCelula,
  totalParticipante,
  cellStatus,
  cellMsg,
}) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={S.table}>
        <thead>
          <tr>
            <th style={S.thSticky}>Participante</th>
            {criterios.map((c) => (
              <th key={c.id} style={S.th}>
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  <span style={{ fontWeight: 950 }}>{c.nome}</span>
                  <span style={S.mutedSmall}>{Number(c.pontos_base ?? 1)} pts</span>
                </div>
              </th>
            ))}
            <th style={S.thTotal}>Total</th>
          </tr>
        </thead>

        <tbody>
          {participantes.map((p) => {
            const total = totalParticipante(p.id);
            return (
              <tr key={p.id}>
                <td style={S.tdSticky}>{p.nome}</td>

                {criterios.map((c) => {
                  const key = `${p.id}|${c.id}`;
                  const checked = getValor(p.id, c.id) >= 1;
                  const status = cellStatus[key];
                  const msg = cellMsg[key];

                  return (
                    <td key={c.id} style={S.td}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={!podeEditar}
                          onChange={(e) => salvarCelula(p.id, c, e.target.checked)}
                          style={{
                            ...S.checkbox,
                            cursor: podeEditar ? "pointer" : "not-allowed",
                            opacity: podeEditar ? 1 : 0.65,
                          }}
                        />
                        <StatusDot status={status} msg={msg} />
                      </div>
                    </td>
                  );
                })}

                <td style={S.tdTotal}>
                  <b>{total}</b>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function StatusDot({ status, msg }) {
  if (!status) return <span style={{ width: 18 }} />;
  const title = status === "saving" ? "Salvando…" : status === "saved" ? "Salvo" : msg || "Erro ao salvar";

  const dotStyle =
    status === "saving"
      ? { ...S.dot, background: "rgba(59,130,246,.95)" }
      : status === "saved"
      ? { ...S.dot, background: "rgba(34,197,94,.95)" }
      : { ...S.dot, background: "rgba(220,38,38,.95)" };

  return <span style={dotStyle} title={title} />;
}

/* -------------------- styles -------------------- */

const S = {
  page: {
    minHeight: "100vh",
    background: "#070a12",
    color: "#e5e7eb",
    padding: 14,
    position: "relative",
    overflow: "hidden",
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

  shell: {
    maxWidth: 1200,
    margin: "0 auto",
    padding: 10,
    position: "relative",
    zIndex: 1,
    display: "grid",
    gap: 12,
  },

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
  titleRow: { marginTop: 6, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" },
  h1: { fontSize: 22, margin: 0, letterSpacing: -0.3, fontWeight: 950 },
  subtitle: { marginTop: 8, opacity: 0.78, fontSize: 13, lineHeight: 1.35, maxWidth: 860 },

  headerActions: { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" },

  pill: {
    fontSize: 12,
    padding: "6px 10px",
    borderRadius: 999,
    background: "rgba(255,255,255,.10)",
    border: "1px solid rgba(255,255,255,.16)",
    fontWeight: 900,
  },

  mutedSmall: { opacity: 0.74, fontSize: 12 },

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
    cursor: "pointer",
  },

  alertErr: {
    padding: 12,
    borderRadius: 16,
    border: "1px solid rgba(220,38,38,.35)",
    background: "rgba(220,38,38,.12)",
  },
  alertWarn: {
    marginTop: 12,
    padding: 12,
    borderRadius: 16,
    border: "1px solid rgba(245,158,11,.25)",
    background: "rgba(245,158,11,.10)",
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
    opacity: 0.92,
  },
  cardBody: { padding: 12 },
  cardFooter: {
    padding: 12,
    borderTop: "1px solid rgba(255,255,255,.10)",
    background: "rgba(17,24,39,.18)",
  },
  footerRow: { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" },

  link: { color: "inherit", textDecoration: "none", fontWeight: 950, opacity: 0.9 },
  linkInline: { color: "inherit", fontWeight: 950, textDecoration: "underline" },

  toggle: {
    display: "flex",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,.14)",
    overflow: "hidden",
    width: "fit-content",
    background: "rgba(17,24,39,.35)",
  },
  toggleBtn: {
    padding: "10px 12px",
    background: "transparent",
    border: "none",
    color: "rgba(229,231,235,.85)",
    cursor: "pointer",
    fontWeight: 800,
  },
  toggleActive: {
    padding: "10px 12px",
    background: "rgba(255,255,255,.12)",
    border: "none",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 950,
  },

  filtersGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(180px, 1fr))",
    gap: 12,
    alignItems: "end",
  },

  field: { display: "flex", flexDirection: "column", gap: 6 },
  label: { fontSize: 12, opacity: 0.8, fontWeight: 900 },

  select: {
    padding: "12px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,.18)",
    background: "rgba(17,24,39,.65)",
    color: "#e5e7eb",
    outline: "none",
  },

  statsRow: {
    marginTop: 12,
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(160px, 1fr))",
    gap: 10,
  },
  statCard: {
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,.14)",
    background: "rgba(17,24,39,.40)",
    padding: 12,
  },
  statTitle: { fontSize: 12, opacity: 0.75 },
  statValue: { fontSize: 18, fontWeight: 950, marginTop: 4 },

  empty: {
    padding: 18,
    borderRadius: 16,
    border: "1px dashed rgba(255,255,255,.18)",
    background: "rgba(17,24,39,.28)",
  },
  emptyTitle: { fontWeight: 950, fontSize: 15 },
  emptyDesc: { marginTop: 6, opacity: 0.8, fontSize: 13, lineHeight: 1.35 },

  table: { width: "100%", borderCollapse: "separate", borderSpacing: 0, minWidth: 980 },
  th: {
    textAlign: "center",
    padding: 12,
    borderBottom: "1px solid rgba(255,255,255,.10)",
    background: "rgba(17,24,39,.55)",
    whiteSpace: "nowrap",
  },
  td: {
    textAlign: "center",
    padding: 12,
    borderBottom: "1px solid rgba(255,255,255,.06)",
    background: "rgba(0,0,0,.00)",
  },
  thSticky: {
    textAlign: "left",
    padding: 12,
    borderBottom: "1px solid rgba(255,255,255,.10)",
    background: "rgba(17,24,39,.75)",
    position: "sticky",
    left: 0,
    zIndex: 2,
    minWidth: 220,
  },
  tdSticky: {
    textAlign: "left",
    padding: 12,
    borderBottom: "1px solid rgba(255,255,255,.06)",
    background: "rgba(12,16,25,.85)",
    position: "sticky",
    left: 0,
    zIndex: 1,
    minWidth: 220,
    fontWeight: 950,
  },
  thTotal: {
    textAlign: "center",
    padding: 12,
    borderBottom: "1px solid rgba(255,255,255,.10)",
    background: "rgba(17,24,39,.75)",
    position: "sticky",
    right: 0,
    zIndex: 2,
    minWidth: 110,
  },
  tdTotal: {
    textAlign: "center",
    padding: 12,
    borderBottom: "1px solid rgba(255,255,255,.06)",
    background: "rgba(12,16,25,.85)",
    position: "sticky",
    right: 0,
    zIndex: 1,
    minWidth: 110,
  },
  checkbox: { width: 22, height: 22, accentColor: "#22c55e" },
  dot: { width: 10, height: 10, borderRadius: 999, display: "inline-block", boxShadow: "0 0 0 3px rgba(255,255,255,.06)" },

  // cards
  pCard: {
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,.12)",
    background: "rgba(17,24,39,.40)",
    overflow: "hidden",
  },
  pCardHeader: {
    listStyle: "none",
    padding: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    cursor: "pointer",
  },
  pName: { fontWeight: 950, lineHeight: 1.2, wordBreak: "break-word" },

  totalPill: {
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,.14)",
    background: "rgba(255,255,255,.08)",
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 2,
    minWidth: 92,
  },

  criteriaGrid: {
    padding: 12,
    paddingTop: 0,
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 10,
  },
  critOff: {
    textAlign: "left",
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,.14)",
    background: "rgba(11,15,25,.55)",
    color: "#e5e7eb",
    padding: 12,
    cursor: "pointer",
  },
  critOn: {
    textAlign: "left",
    borderRadius: 16,
    border: "1px solid rgba(34,197,94,.45)",
    background: "rgba(34,197,94,.14)",
    color: "#eafff1",
    padding: 12,
    cursor: "pointer",
  },
  critRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 },
  critName: { fontWeight: 900, lineHeight: 1.15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 220 },

  checkMark: {
    width: 26,
    height: 26,
    borderRadius: 10,
    display: "grid",
    placeItems: "center",
    border: "1px solid rgba(255,255,255,.18)",
    background: "rgba(255,255,255,.10)",
    fontWeight: 950,
  },

  // skeleton
  skelHero: { height: 78, borderRadius: 18, background: "rgba(255,255,255,.06)" },
  skelLine: { height: 14, marginTop: 12, borderRadius: 999, background: "rgba(255,255,255,.08)", width: 520, maxWidth: "92vw" },
  skelGrid: { marginTop: 12, display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 12 },
  skelCard: { height: 160, borderRadius: 18, background: "rgba(255,255,255,.05)" },
};
