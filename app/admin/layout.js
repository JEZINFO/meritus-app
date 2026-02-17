"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/src/lib/supabase";

/**
 * Admin Layout v4 (ultra premium)
 * - Ícones SVG inline (sem pacote)
 * - Sidebar + BottomNav com ícone+label
 * - Breadcrumb + Voltar inteligente
 * - Seletor de programa persistido
 */

const STORAGE_KEY = "meritus_admin_programaId";

export default function AdminLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);

  const [userEmail, setUserEmail] = useState("");
  const [programas, setProgramas] = useState([]);
  const [programaId, setProgramaId] = useState("");

  const [isMobile, setIsMobile] = useState(false);

  // responsive
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 860px)");
    const apply = () => setIsMobile(!!mq.matches);
    apply();
    mq.addEventListener?.("change", apply);
    return () => mq.removeEventListener?.("change", apply);
  }, []);

  // Auth + Admin gate + load programs
  useEffect(() => {
    (async () => {
      setLoading(true);
      setErro(null);

      const { data: sData, error: sErr } = await supabase.auth.getSession();
      if (sErr) {
        setErro(sErr.message);
        setLoading(false);
        return;
      }

      const u = sData?.session?.user || null;
      if (!u) {
        router.replace(`/login?next=${encodeURIComponent(pathname || "/admin")}`);
        return;
      }
      setUserEmail(u.email || "");

      const { data: usr, error: usrErr } = await supabase
        .from("meritus_usuarios")
        .select("perfil,ativo,programa_id")
        .eq("id", u.id)
        .maybeSingle();

      if (usrErr) {
        setErro(usrErr.message);
        setLoading(false);
        return;
      }

      if (!usr || usr.ativo === false || usr.perfil !== "admin") {
        setErro("Acesso restrito ao perfil Admin.");
        setLoading(false);
        return;
      }

      const { data: progs, error: pErr } = await supabase
        .from("meritus_programas")
        .select("id,nome,ativo,criado_em")
        .eq("ativo", true)
        .order("criado_em", { ascending: false });

      if (pErr) {
        setErro(pErr.message);
        setLoading(false);
        return;
      }

      setProgramas(progs || []);

      // preferência: ?programa > localStorage > usr.programa_id > primeiro
      const qs = search?.get("programa") || "";
      const saved = safeGetLocal(STORAGE_KEY) || "";
      const preferred = qs || saved || usr.programa_id || progs?.[0]?.id || "";
      setProgramaId(preferred);
      safeSetLocal(STORAGE_KEY, preferred);

      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!programaId) return;
    safeSetLocal(STORAGE_KEY, programaId);
  }, [programaId]);

  const nav = useMemo(
    () => [
      { href: "/admin", label: "Home", key: "home", Icon: IHome },
      { href: "/admin/periodos", label: "Períodos", key: "periodos", Icon: ICalendar },
      { href: "/admin/cadastros", label: "Cadastros", key: "cadastros", Icon: IStack },
      { href: "/admin/relatorios", label: "Relatórios", key: "relatorios", Icon: IChart },
      { href: "/lancamentos", label: "Lançamentos", key: "lancamentos", Icon: ICheck },
    ],
    []
  );

  const activeKey = useMemo(() => {
    if (!pathname) return "home";
    if (pathname.startsWith("/admin/periodos")) return "periodos";
    if (pathname.startsWith("/admin/cadastros")) return "cadastros";
    if (pathname.startsWith("/admin/relatorios")) return "relatorios";
    if (pathname.startsWith("/lancamentos")) return "lancamentos";
    if (pathname.startsWith("/admin")) return "home";
    return "home";
  }, [pathname]);

  const crumbs = useMemo(() => makeCrumbs(pathname), [pathname]);

  function linkRanking() {
    if (!programaId) return "/ranking";
    return `/ranking?programa=${encodeURIComponent(programaId)}`;
  }

  function voltar() {
    try {
      if (window.history.length > 2) router.back();
      else router.push("/admin");
    } catch {
      router.push("/admin");
    }
  }

  async function sair() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (loading) {
    return (
      <main style={S.page}>
        <div style={S.loadingWrap}>
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

  if (erro) {
    return (
      <main style={S.page}>
        <div style={S.errorWrap}>
          <div style={S.brandRow}>
            <div>
              <div style={S.brand}>Meritus</div>
              <div style={S.subtitle}>Admin</div>
            </div>
            <button style={S.btnGhost} onClick={sair}>
              Sair
            </button>
          </div>

          <div style={S.alertErr}>
            <b>Erro:</b> {erro}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main style={S.page}>
      {/* Background accents */}
      <div style={S.bgGlowA} />
      <div style={S.bgGlowB} />

      {/* Sidebar (desktop) */}
      {!isMobile ? (
        <aside style={S.sidebar}>
          <div style={S.sidebarTop}>
            <div style={S.brandRow}>
              <div>
                <div style={S.brand}>Meritus</div>
                <div style={S.subtitle}>Admin</div>
              </div>
              <span style={S.pill}>Premium</span>
            </div>
          </div>

          <div style={S.sidebarCard}>
            <div style={S.cardTitle}>Programa</div>
            <select value={programaId} onChange={(e) => setProgramaId(e.target.value)} style={S.select}>
              {programas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
              {programas.length === 0 ? <option value="">(nenhum)</option> : null}
            </select>

            <div style={S.sidebarActions}>
              <a href={linkRanking()} style={S.btnSoft}>
                <span style={S.btnIcon}><ITrophy /></span>
                Ver Ranking
              </a>
              <button onClick={sair} style={S.btnGhost} title={userEmail}>
                <span style={S.btnIcon}><ILogout /></span>
                Sair
              </button>
            </div>
          </div>

          <nav style={S.nav}>
            {nav.map((n) => {
              const active = n.key === activeKey;
              const Icon = n.Icon;
              return (
                <a key={n.key} href={n.href} style={active ? S.navItemActive : S.navItem}>
                  <span style={S.navDot(active)} />
                  <span style={S.navIcon(active)}><Icon /></span>
                  <span style={S.navLabel}>{n.label}</span>
                </a>
              );
            })}
          </nav>

          <div style={S.sidebarFoot}>
            <div style={S.smallMuted} title={userEmail}>
              {userEmail || "logado"}
            </div>
          </div>
        </aside>
      ) : null}

      {/* Content */}
      <section style={S.main}>
        <header style={S.header}>
          <div style={{ minWidth: 0 }}>
            <div style={S.breadcrumb}>
              {crumbs.map((c, idx) => (
                <span key={c.href || idx} style={{ minWidth: 0 }}>
                  {idx > 0 ? <span style={S.crumbSep}>/</span> : null}
                  {c.href ? (
                    <a href={c.href} style={S.crumbLink}>
                      {c.label}
                    </a>
                  ) : (
                    <span style={S.crumbCurrent}>{c.label}</span>
                  )}
                </span>
              ))}
            </div>

            <div style={S.pageTitle}>{titleFromPath(pathname)}</div>
            {programaId ? (
              <div style={S.programHint}>
                Programa selecionado • <span style={{ fontWeight: 950 }}>{programaId.slice(0, 8)}…</span>
              </div>
            ) : (
              <div style={S.programHint}>Selecione um programa</div>
            )}
          </div>

          <div style={S.headerRight}>
            {isMobile ? (
              <select value={programaId} onChange={(e) => setProgramaId(e.target.value)} style={S.selectMobile}>
                {programas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
                {programas.length === 0 ? <option value="">(nenhum)</option> : null}
              </select>
            ) : null}

            <a href={linkRanking()} style={S.btnSoftSmall}>
              <span style={S.btnIcon}><ITrophy /></span>
              Ranking
            </a>
            <button onClick={voltar} style={S.btnSmallGhost}>
              <span style={S.btnIcon}><IBack /></span>
              Voltar
            </button>
          </div>
        </header>

        <div style={S.content}>{children}</div>
      </section>

      {/* Bottom nav (mobile) */}
      {isMobile ? (
        <nav style={S.bottomNav}>
          {nav.map((n) => {
            const active = n.key === activeKey;
            const Icon = n.Icon;
            return (
              <a key={n.key} href={n.href} style={active ? S.bottomItemActive : S.bottomItem}>
                <span style={S.bottomIcon(active)}><Icon /></span>
                <span style={S.bottomLabel}>{n.label}</span>
              </a>
            );
          })}
          <button onClick={sair} style={S.bottomDanger} title={userEmail}>
            <span style={S.bottomIcon(true)}><ILogout /></span>
            <span style={S.bottomLabel}>Sair</span>
          </button>
        </nav>
      ) : null}
    </main>
  );
}

/* ---------------- helpers ---------------- */
function safeGetLocal(k) {
  try {
    return window.localStorage.getItem(k);
  } catch {
    return "";
  }
}

function safeSetLocal(k, v) {
  try {
    window.localStorage.setItem(k, v || "");
  } catch {}
}

function titleFromPath(pathname) {
  if (!pathname) return "Admin";
  if (pathname === "/admin") return "Admin";
  if (pathname.startsWith("/admin/periodos")) return "Períodos";
  if (pathname.startsWith("/admin/cadastros")) return "Cadastros";
  if (pathname.startsWith("/admin/relatorios")) return "Relatórios";
  if (pathname.startsWith("/lancamentos")) return "Lançamentos";
  return "Admin";
}

function makeCrumbs(pathname) {
  const base = [{ label: "Admin", href: "/admin" }];

  if (!pathname || pathname === "/admin") return [...base, { label: "Home" }];

  // Lançamentos fica fora de /admin, então breadcrumb fica: Admin / Lançamentos
  if (pathname.startsWith("/lancamentos")) return [...base, { label: "Lançamentos" }];

  const rest = pathname.replace("/admin", "").split("/").filter(Boolean);
  if (rest.length === 0) return [...base, { label: "Home" }];

  const first = rest[0];
  const pretty =
    first === "periodos" ? "Períodos" :
    first === "cadastros" ? "Cadastros" :
    first === "relatorios" ? "Relatórios" :
    first;

  return [...base, { label: pretty }];
}

/* ---------------- icons (inline svg) ---------------- */
function Svg({ children, size = 18 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

function IHome() {
  return (
    <Svg>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
      <path d="M9 21v-6h6v6" />
    </Svg>
  );
}

function ICalendar() {
  return (
    <Svg>
      <path d="M8 3v3" />
      <path d="M16 3v3" />
      <path d="M4 7h16" />
      <path d="M5 6.5V21h14V6.5" />
      <path d="M8 11h3" />
      <path d="M8 15h3" />
      <path d="M13 11h3" />
      <path d="M13 15h3" />
    </Svg>
  );
}

function IStack() {
  return (
    <Svg>
      <path d="M12 3 3 8l9 5 9-5-9-5Z" />
      <path d="M3 12l9 5 9-5" />
      <path d="M3 16l9 5 9-5" />
    </Svg>
  );
}

function IChart() {
  return (
    <Svg>
      <path d="M4 19V5" />
      <path d="M4 19h16" />
      <path d="M8 15v-3" />
      <path d="M12 15v-6" />
      <path d="M16 15v-9" />
    </Svg>
  );
}

function ICheck() {
  return (
    <Svg>
      <path d="M9 11.5 11 13.5 15 9.5" />
      <path d="M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z" />
    </Svg>
  );
}

function ITrophy() {
  return (
    <Svg>
      <path d="M8 4h8v3a4 4 0 0 1-8 0V4Z" />
      <path d="M6 7H4a2 2 0 0 0 2 2" />
      <path d="M18 7h2a2 2 0 0 1-2 2" />
      <path d="M12 11v4" />
      <path d="M9 19h6" />
      <path d="M10 15h4" />
    </Svg>
  );
}

function ILogout() {
  return (
    <Svg>
      <path d="M10 17H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h4" />
      <path d="M14 7l5 5-5 5" />
      <path d="M19 12H10" />
    </Svg>
  );
}

function IBack() {
  return (
    <Svg>
      <path d="M12 19 5 12l7-7" />
      <path d="M19 12H6" />
    </Svg>
  );
}

/* ---------------- styles ---------------- */
const S = {
  page: {
    minHeight: "100vh",
    background: "#070a12",
    color: "#e5e7eb",
    fontFamily: "system-ui",
    display: "flex",
    position: "relative",
    overflow: "hidden",
  },

  bgGlowA: {
    position: "absolute",
    inset: "-30% auto auto -30%",
    width: 540,
    height: 540,
    borderRadius: 999,
    background: "radial-gradient(circle at 30% 30%, rgba(34,197,94,.22), rgba(34,197,94,0) 60%)",
    filter: "blur(6px)",
    pointerEvents: "none",
  },
  bgGlowB: {
    position: "absolute",
    inset: "auto -30% -35% auto",
    width: 660,
    height: 660,
    borderRadius: 999,
    background: "radial-gradient(circle at 70% 60%, rgba(99,102,241,.22), rgba(99,102,241,0) 60%)",
    filter: "blur(8px)",
    pointerEvents: "none",
  },

  loadingWrap: { width: "100%", padding: 18, maxWidth: 1100, margin: "0 auto" },
  skelHero: { height: 78, borderRadius: 18, background: "rgba(255,255,255,.06)" },
  skelLine: { height: 14, marginTop: 12, borderRadius: 999, background: "rgba(255,255,255,.08)", width: 520, maxWidth: "92vw" },
  skelGrid: { marginTop: 12, display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 12 },
  skelCard: { height: 160, borderRadius: 18, background: "rgba(255,255,255,.05)" },

  errorWrap: { width: "100%", maxWidth: 980, margin: "0 auto", padding: 18, position: "relative", zIndex: 1 },

  sidebar: {
    width: 320,
    padding: 14,
    borderRight: "1px solid rgba(255,255,255,.08)",
    background: "rgba(0,0,0,.12)",
    backdropFilter: "blur(12px)",
    display: "flex",
    flexDirection: "column",
    gap: 12,
    position: "relative",
    zIndex: 1,
  },
  sidebarTop: {
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,.10)",
    background: "rgba(255,255,255,.04)",
    padding: 12,
  },
  sidebarCard: {
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,.12)",
    background: "rgba(17,24,39,.45)",
    padding: 12,
  },
  sidebarActions: { marginTop: 10, display: "grid", gap: 10 },

  main: { flex: 1, minWidth: 0, padding: 14, paddingBottom: 104, position: "relative", zIndex: 1 },

  header: {
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,.12)",
    background: "rgba(255,255,255,.06)",
    backdropFilter: "blur(14px)",
    padding: 14,
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  headerRight: { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end" },

  breadcrumb: { display: "flex", gap: 0, flexWrap: "wrap", alignItems: "center", fontSize: 12, opacity: 0.88 },
  crumbSep: { margin: "0 8px", opacity: 0.6 },
  crumbLink: { color: "inherit", textDecoration: "none", fontWeight: 850, opacity: 0.85 },
  crumbCurrent: { fontWeight: 950, opacity: 0.98 },

  pageTitle: { marginTop: 6, fontSize: 18, fontWeight: 950, letterSpacing: -0.2 },
  programHint: { marginTop: 6, fontSize: 12, opacity: 0.75 },

  content: { marginTop: 12 },

  brandRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" },
  brand: { fontSize: 18, fontWeight: 950, letterSpacing: -0.2 },
  subtitle: { fontSize: 12, opacity: 0.72 },
  pill: {
    fontSize: 12,
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,.14)",
    background: "rgba(255,255,255,.06)",
    fontWeight: 900,
    opacity: 0.9,
  },

  cardTitle: { fontSize: 12, opacity: 0.8, fontWeight: 900, marginBottom: 8 },

  select: {
    width: "100%",
    padding: "12px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,.18)",
    background: "rgba(17,24,39,.70)",
    color: "#e5e7eb",
    outline: "none",
  },
  selectMobile: {
    minWidth: 220,
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,.18)",
    background: "rgba(17,24,39,.70)",
    color: "#e5e7eb",
    outline: "none",
  },

  nav: { display: "grid", gap: 8, padding: 2 },
  navItem: {
    padding: "12px 12px",
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,.10)",
    background: "rgba(17,24,39,.20)",
    color: "inherit",
    textDecoration: "none",
    fontWeight: 900,
    display: "flex",
    alignItems: "center",
    gap: 10,
    transition: "transform .12s ease",
  },
  navItemActive: {
    padding: "12px 12px",
    borderRadius: 16,
    border: "1px solid rgba(34,197,94,.30)",
    background: "linear-gradient(180deg, rgba(34,197,94,.12), rgba(17,24,39,.35))",
    color: "#eafff1",
    textDecoration: "none",
    fontWeight: 950,
    display: "flex",
    alignItems: "center",
    gap: 10,
    boxShadow: "0 0 0 4px rgba(34,197,94,.06)",
  },
  navDot: (active) => ({
    width: 8,
    height: 8,
    borderRadius: 999,
    background: active ? "rgba(34,197,94,.95)" : "rgba(255,255,255,.28)",
    boxShadow: active ? "0 0 0 4px rgba(34,197,94,.14)" : "none",
  }),
  navIcon: (active) => ({
    width: 22,
    height: 22,
    display: "grid",
    placeItems: "center",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,.10)",
    background: active ? "rgba(34,197,94,.10)" : "rgba(255,255,255,.05)",
  }),
  navLabel: { flex: 1, minWidth: 0 },

  sidebarFoot: { marginTop: "auto", padding: 10, opacity: 0.85 },
  smallMuted: { opacity: 0.7, fontSize: 12 },

  btnIcon: { display: "grid", placeItems: "center" },

  btnSoft: {
    padding: "10px 12px",
    borderRadius: 14,
    background: "rgba(255,255,255,.10)",
    border: "1px solid rgba(255,255,255,.16)",
    color: "inherit",
    fontWeight: 950,
    textDecoration: "none",
    textAlign: "center",
    display: "flex",
    gap: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  btnGhost: {
    padding: "10px 12px",
    borderRadius: 14,
    background: "transparent",
    border: "1px solid rgba(255,255,255,.16)",
    color: "inherit",
    fontWeight: 900,
    cursor: "pointer",
    display: "flex",
    gap: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  btnSoftSmall: {
    padding: "10px 12px",
    borderRadius: 14,
    background: "rgba(255,255,255,.10)",
    border: "1px solid rgba(255,255,255,.16)",
    color: "inherit",
    fontWeight: 950,
    textDecoration: "none",
    display: "flex",
    gap: 10,
    alignItems: "center",
  },
  btnSmallGhost: {
    padding: "10px 12px",
    borderRadius: 14,
    background: "transparent",
    border: "1px solid rgba(255,255,255,.16)",
    color: "inherit",
    fontWeight: 900,
    cursor: "pointer",
    display: "flex",
    gap: 10,
    alignItems: "center",
  },

  bottomNav: {
    position: "fixed",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 30,
    display: "grid",
    gridTemplateColumns: "repeat(6, 1fr)",
    gap: 8,
    padding: 10,
    borderTop: "1px solid rgba(255,255,255,.10)",
    background: "rgba(7,10,18,.88)",
    backdropFilter: "blur(14px)",
  },
  bottomItem: {
    padding: "10px 8px",
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,.10)",
    background: "rgba(255,255,255,.06)",
    color: "inherit",
    textDecoration: "none",
    fontWeight: 900,
    textAlign: "center",
    fontSize: 11,
    display: "grid",
    gap: 4,
    placeItems: "center",
  },
  bottomItemActive: {
    padding: "10px 8px",
    borderRadius: 16,
    border: "1px solid rgba(34,197,94,.30)",
    background: "rgba(34,197,94,.12)",
    color: "#eafff1",
    textDecoration: "none",
    fontWeight: 950,
    textAlign: "center",
    fontSize: 11,
    display: "grid",
    gap: 4,
    placeItems: "center",
  },
  bottomIcon: (active) => ({
    width: 26,
    height: 26,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,.12)",
    background: active ? "rgba(34,197,94,.10)" : "rgba(255,255,255,.05)",
    display: "grid",
    placeItems: "center",
  }),
  bottomLabel: { lineHeight: 1 },

  bottomDanger: {
    padding: "10px 8px",
    borderRadius: 16,
    border: "1px solid rgba(220,38,38,.25)",
    background: "rgba(220,38,38,.12)",
    color: "#ffecec",
    fontWeight: 950,
    cursor: "pointer",
    fontSize: 11,
    display: "grid",
    gap: 4,
    placeItems: "center",
  },

  alertErr: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    border: "1px solid rgba(220,38,38,.35)",
    background: "rgba(220,38,38,.12)",
  },
};
