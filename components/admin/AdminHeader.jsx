"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "../../src/lib/profile";

function cn(...a) {
  return a.filter(Boolean).join(" ");
}

function NavItem({ href, label, active }) {
  return (
    <Link
      href={href}
      className={cn(
        "px-3 py-2 rounded-xl text-sm transition",
        active ? "bg-black text-white" : "text-black/70 hover:bg-black/5 hover:text-black"
      )}
    >
      {label}
    </Link>
  );
}

function DropItem({ href, label, onClick }) {
  return (
    <Link href={href} onClick={onClick} className="block px-3 py-2 text-sm hover:bg-black/5">
      {label}
    </Link>
  );
}

export default function AdminHeader({ profile, nav }) {
  const pathname = usePathname();
  const router = useRouter();
  const [openMobile, setOpenMobile] = useState(false);
  const [openCad, setOpenCad] = useState(false);
  const [openUser, setOpenUser] = useState(false);

  const role = nav?.role || profile?.perfil || "relatorio";

  const baseItems = useMemo(() => (nav?.base || []).filter((i) => i.roles.includes(role)), [nav, role]);
  const cadItems = useMemo(() => (nav?.cad || []).filter((i) => i.roles.includes(role)), [nav, role]);

  async function sair() {
    await signOut();
    router.push("/login");
  }

  return (
    <header className="sticky top-0 z-50 border-b border-black/10 bg-white/80 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center gap-3">
        <Link href="/admin" className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-2xl bg-black text-white flex items-center justify-center font-semibold">M</div>
          <div className="leading-tight">
            <div className="text-sm font-semibold">Meritus</div>
            <div className="text-[11px] text-black/50">{profile?.org_nome || "Organização"} • {role}</div>
          </div>
        </Link>

        <nav className="ml-6 hidden md:flex items-center gap-1">
          {baseItems.map((i) => (
            <NavItem key={i.href} href={i.href} label={i.label} active={pathname === i.href} />
          ))}

          {cadItems.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setOpenCad((v) => !v)}
                className={cn(
                  "px-3 py-2 rounded-xl text-sm transition",
                  pathname?.includes("/admin/cadastros") ? "bg-black text-white" : "text-black/70 hover:bg-black/5 hover:text-black"
                )}
              >
                Cadastros ▾
              </button>

              {openCad && (
                <div className="absolute mt-2 w-56 rounded-2xl border border-black/10 bg-white shadow-lg overflow-hidden">
                  {cadItems.map((i) => (
                    <DropItem key={i.href} href={i.href} label={i.label} onClick={() => setOpenCad(false)} />
                  ))}
                </div>
              )}
            </div>
          )}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <div className="relative hidden md:block">
            <button
              onClick={() => setOpenUser((v) => !v)}
              className="rounded-2xl border border-black/10 px-3 py-2 text-sm hover:bg-black/5"
            >
              {profile?.email || "Conta"} ▾
            </button>
            {openUser && (
              <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-black/10 bg-white shadow-lg overflow-hidden">
                <div className="px-3 py-2 text-xs text-black/50 border-b border-black/10">{profile?.user_id}</div>
                <button onClick={sair} className="w-full text-left px-3 py-2 text-sm hover:bg-black/5">
                  Sair
                </button>
              </div>
            )}
          </div>

          <button
            className="md:hidden rounded-2xl border border-black/10 px-3 py-2 text-sm hover:bg-black/5"
            onClick={() => setOpenMobile((v) => !v)}
          >
            Menu
          </button>
        </div>
      </div>

      {openMobile && (
        <div className="md:hidden border-t border-black/10 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-3 flex flex-col gap-2">
            <div className="text-xs text-black/50">{profile?.org_nome || "Organização"} • {role}</div>

            <div className="flex flex-col gap-1">
              {baseItems.map((i) => (
                <NavItem key={i.href} href={i.href} label={i.label} active={pathname === i.href} />
              ))}
            </div>

            {cadItems.length > 0 && (
              <div className="rounded-2xl border border-black/10 p-2">
                <div className="text-xs text-black/50 px-2 pb-1">Cadastros</div>
                <div className="flex flex-col gap-1">
                  {cadItems.map((i) => (
                    <NavItem key={i.href} href={i.href} label={i.label} active={pathname === i.href} />
                  ))}
                </div>
              </div>
            )}

            <button onClick={sair} className="rounded-2xl border border-black/10 px-3 py-2 text-sm hover:bg-black/5 text-left">
              Sair
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
