"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
        "px-3 py-2 rounded-xl text-sm transition",
        active ? "bg-black text-white" : "text-black/70 hover:bg-black/5 hover:text-black"
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
    <header className="sticky top-0 z-50 border-b border-black/10 bg-white/80 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="font-semibold tracking-tight" onClick={closeAll}>Meritus{APP_VERSION ? (<span className="ml-2 text-[12px] text-black/60 bg-black/5 border border-black/10 rounded-full px-2 py-0.5">v{APP_VERSION}</span>) : null}</Link>

          <div className="hidden md:flex items-center gap-1">
            {baseItems.map((i) => (
              <NavItem key={i.href} href={i.href} label={i.label} active={pathname === i.href} onClick={closeAll} />
            ))}

            {cadItems.length ? (
              <div className="relative">
                <button
                  onClick={() => setOpenCad((s) => !s)}
                  className={cn(
                    "px-3 py-2 rounded-xl text-sm transition",
                    openCad ? "bg-black text-white" : "text-black/70 hover:bg-black/5 hover:text-black"
                  )}
                >
                  Cadastros
                </button>
                {openCad ? (
                  <div className="absolute left-0 mt-2 w-56 rounded-2xl border border-black/10 bg-white shadow-lg p-2">
                    {cadItems.map((i) => (
                      <Link
                        key={i.href}
                        href={i.href}
                        onClick={closeAll}
                        className="block rounded-xl px-3 py-2 text-sm text-black/70 hover:bg-black/5 hover:text-black"
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
            <span className="text-xs text-black/50">Programa</span>
            <select
              className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
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
                "px-3 py-2 rounded-xl text-sm transition border border-black/10",
                openUser ? "bg-black text-white border-black" : "bg-white hover:bg-black/5"
              )}
            >
              {displayName || profile?.perfil || "usuário"}
            </button>
            {openUser ? (
              <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-black/10 bg-white shadow-lg p-2">
                <div className="px-3 py-2">
  <div className="text-xs text-black/50">Usuário</div>
  <div className="text-sm font-semibold">{displayName || "—"}</div>
              {APP_VERSION ? (<div className="text-[11px] text-black/45">Versão: v{APP_VERSION}</div>) : null} /*AppVersionLine*/
              {APP_VERSION ? (<div className="text-[11px] text-black/45">v{APP_VERSION}</div>) : null}
  <div className="mt-1 text-xs text-black/50">Perfil</div>
  <div className="text-sm font-semibold">{profile?.perfil || "—"}</div>
</div>
                <div className="h-px bg-black/10 my-1" />
                <button
                  onClick={sair}
                  className="w-full text-left rounded-xl px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  Sair
                </button>
              </div>
            ) : null}
          </div>

          {/* Mobile */}
          <button
            className="md:hidden rounded-xl border border-black/10 px-3 py-2 text-sm"
            onClick={() => setOpenMobile((s) => !s)}
          >
            Menu
          </button>
        </div>
      </div>

      {openMobile ? (
        <div className="md:hidden border-t border-black/10 bg-white">
          <div className="px-4 py-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-black/50">Programa</span>
              <select
                className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
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
              <div className="rounded-2xl border border-black/10 p-2">
                <div className="text-xs text-black/50 px-2 py-1">Cadastros</div>
                <div className="grid gap-1">
                  {cadItems.map((i) => (
                    <Link
                      key={i.href}
                      href={i.href}
                      onClick={closeAll}
                      className="block rounded-xl px-3 py-2 text-sm text-black/70 hover:bg-black/5 hover:text-black"
                    >
                      {i.label}
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}

            <button
              onClick={sair}
              className="w-full rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              Sair
            </button>
          </div>
        </div>
      ) : null}
    </header>
  );
}