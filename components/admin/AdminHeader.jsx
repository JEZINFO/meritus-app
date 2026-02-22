"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "@/src/lib/profile";
import { supabase } from "@/src/lib/supabase";
import { useProgram } from "./ProgramContext";
const APP_VERSION = (process.env.NEXT_PUBLIC_APP_VERSION || "").trim();

function cn(...a) {
  return a.filter(Boolean).join(" ");
}

function NavItem({ href, label, active, onClick }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "px-3 py-2 rounded-xl text-sm transition border",
        active ? "bg-[rgba(212,175,55,.14)] text-[var(--m-gold)] border border-[rgba(212,175,55,.25)]" : "text-white/70 hover:bg-white/5 hover:text-white border border-transparent"
      )}
    >
      {label}
    </Link>
  );
}

export default function AdminHeader({ profile, nav }) {
  const pathname = usePathname();
  const router = useRouter();
  const { programas, programaId, setProgramaId, loadingProgramas } = useProgram();

  const [openMobile, setOpenMobile] = useState(false);
  const [openCad, setOpenCad] = useState(false);
  const [openUser, setOpenUser] = useState(false);

const [displayName, setDisplayName] = useState("");

useEffect(() => {
  let alive = true;
  (async () => {
    const { data, error } = await supabase.auth.getUser();
    if (!alive) return;
    if (error) {
      setDisplayName("");
      return;
    }
    const u = data?.user;
    const nome = String(u?.user_metadata?.nome || u?.user_metadata?.name || "").trim();
    setDisplayName(nome || u?.email || "");
  })();
  return () => {
    alive = false;
  };
}, []);

  const role = nav?.role || profile?.perfil || "relatorio";
  const baseItems = useMemo(() => (nav?.base || []).filter((i) => i.roles.includes(role)), [nav, role]);
  const cadItems = useMemo(() => (nav?.cad || []).filter((i) => i.roles.includes(role)), [nav, role]);

  async function sair() {
    await signOut();
    router.push("/login");
  }

  function closeAll() {
    setOpenMobile(false);
    setOpenCad(false);
    setOpenUser(false);
  }

  return (
    <header className="sticky top-0 z-50 border-b border-[rgba(212,175,55,.22)] bg-[rgba(11,11,13,.78)] backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="flex items-center gap-2 font-semibold tracking-tight" onClick={closeAll}>
            <Image src="/brand/meritus-mark.png" alt="Meritus" width={44} height={44} className="rounded-xl drop-shadow-[0_0_16px_rgba(212,175,55,0.35)]" />
            <span className="text-lg font-semibold tracking-[0.22em] text-white">MERITUS</span>{APP_VERSION ? (<span className="ml-2 text-[12px] text-white/70 bg-[rgba(212,175,55,.10)] border border-[rgba(212,175,55,.20)] rounded-full px-2 py-0.5">v{APP_VERSION}</span>) : null}</Link>

          <div className="hidden md:flex items-center gap-1">
            {baseItems.map((i) => (
              <NavItem key={i.href} href={i.href} label={i.label} active={pathname === i.href} onClick={closeAll} />
            ))}

            {cadItems.length ? (
              <div className="relative">
                <button
                  onClick={() => setOpenCad((s) => !s)}
                  className={cn(
                    "px-3 py-2 rounded-xl text-sm transition border",
                    openCad ? "bg-[rgba(212,175,55,.14)] text-[var(--m-gold)] border border-[rgba(212,175,55,.25)]" : "text-white/70 hover:bg-white/5 hover:text-white border border-transparent"
                  )}
                >
                  Cadastros
                </button>
                {openCad ? (
                  <div className="absolute left-0 mt-2 w-56 rounded-2xl border border-white/10 bg-[var(--m-surface)] shadow-lg p-2">
                    {cadItems.map((i) => (
                      <Link
                        key={i.href}
                        href={i.href}
                        onClick={closeAll}
                        className="block rounded-xl px-3 py-2 text-sm text-white/70 hover:bg-white/5 hover:text-white"
                      >
                        {i.label}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Programa selector */}
          <div className="hidden md:flex items-center gap-2">
            <span className="text-xs text-white/55">Programa</span>
            <select
              className="rounded-xl border border-white/10 bg-[var(--m-surface)] px-3 py-2 text-sm text-white"
              value={programaId || ""}
              onChange={(e) => setProgramaId(e.target.value)}
              disabled={loadingProgramas || (programas || []).length === 0}
            >
              {(programas || []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </div>

          {/* user */}
          <div className="relative hidden md:block">
            <button
              onClick={() => setOpenUser((s) => !s)}
              className={cn(
                "px-3 py-2 rounded-xl text-sm transition border border-white/10",
                openUser ? "bg-white/5 text-white border-white/15" : "bg-[var(--m-surface)] text-white hover:bg-white/5"
              )}
            >
              {displayName || profile?.perfil || "usuário"}
            </button>
            {openUser ? (
              <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-white/10 bg-[var(--m-surface)] shadow-lg p-2">
                <div className="px-3 py-2">
  <div className="text-xs text-white/55">Usuário</div>
  <div className="text-sm font-semibold text-white">{displayName || "—"}</div>
              {APP_VERSION ? (<div className="text-[11px] text-white/45">Versão: v{APP_VERSION}</div>) : null}
  <div className="mt-1 text-xs text-white/55">Perfil</div>
  <div className="text-sm font-semibold text-white">{profile?.perfil || "—"}</div>
</div>
                <div className="h-px bg-white/10 my-1" />
                <button
                  onClick={sair}
                  className="w-full text-left rounded-xl px-3 py-2 text-sm text-[var(--m-danger)] hover:bg-[rgba(255,90,95,.12)]"
                >
                  Sair
                </button>
              </div>
            ) : null}
          </div>

          {/* Mobile */}
          <button
            className="md:hidden rounded-xl border border-white/10 bg-[var(--m-surface)] px-3 py-2 text-sm text-white"
            onClick={() => setOpenMobile((s) => !s)}
          >
            Menu
          </button>
        </div>
      </div>

      {openMobile ? (
        <div className="md:hidden border-t border-white/10 bg-[var(--m-surface)]">
          <div className="px-4 py-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/55">Programa</span>
              <select
                className="w-full rounded-xl border border-white/10 bg-[var(--m-surface)] px-3 py-2 text-sm text-white"
                value={programaId || ""}
                onChange={(e) => setProgramaId(e.target.value)}
                disabled={loadingProgramas || (programas || []).length === 0}
              >
                {(programas || []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap gap-2">
              {baseItems.map((i) => (
                <NavItem key={i.href} href={i.href} label={i.label} active={pathname === i.href} onClick={closeAll} />
              ))}
            </div>

            {cadItems.length ? (
              <div className="rounded-2xl border border-white/10 p-2">
                <div className="text-xs text-white/55 px-2 py-1">Cadastros</div>
                <div className="grid gap-1">
                  {cadItems.map((i) => (
                    <Link
                      key={i.href}
                      href={i.href}
                      onClick={closeAll}
                      className="block rounded-xl px-3 py-2 text-sm text-white/70 hover:bg-white/5 hover:text-white"
                    >
                      {i.label}
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}

            <button
              onClick={sair}
              className="w-full rounded-xl border border-[rgba(255,90,95,.35)] bg-[rgba(255,90,95,.10)] px-3 py-2 text-sm text-[var(--m-danger)]"
            >
              Sair
            </button>
          </div>
        </div>
      ) : null}
    </header>
  );
}