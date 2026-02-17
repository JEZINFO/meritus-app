"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import AdminHeader from "./AdminHeader";
import { getProfile } from "../../src/lib/profile";

function Spinner() {
  return (
    <div className="min-h-[40vh] flex items-center justify-center">
      <div className="h-10 w-10 rounded-full border-2 border-black/20 border-t-black animate-spin" />
    </div>
  );
}

export default function AdminShell({ children }) {
  const router = useRouter();
  const pathname = usePathname();

  const [state, setState] = useState({ loading: true, profile: null });

  useEffect(() => {
    (async () => {
      const res = await getProfile();
      if (!res.ok) {
        router.push("/login");
        return;
      }
      setState({ loading: false, profile: res.profile });
    })();
  }, [router]);

  const nav = useMemo(() => {
    const role = state.profile?.perfil || "relatorio";
    const base = [
      { href: "/admin", label: "Dashboard", roles: ["admin", "fiscal", "relatorio"] },
      { href: "/admin/lancamentos", label: "Lançamentos", roles: ["admin", "fiscal"] },
      { href: "/admin/ranking", label: "Ranking", roles: ["admin", "relatorio"] },
      { href: "/admin/relatorios", label: "Relatórios", roles: ["admin", "relatorio"] },
    ];
    const cad = [
      { href: "/admin/cadastros/usuarios", label: "Usuários", roles: ["admin"] },
      { href: "/admin/cadastros/grupos", label: "Grupos", roles: ["admin"] },
      { href: "/admin/cadastros/criterios", label: "Critérios", roles: ["admin"] },
      { href: "/admin/cadastros/participantes", label: "Participantes", roles: ["admin"] },
      { href: "/admin/cadastros/periodos", label: "Períodos", roles: ["admin"] },
      { href: "/admin/cadastros/organizacao", label: "Organização", roles: ["admin"] },
    ];
    return { base, cad, role };
  }, [state.profile]);

  if (state.loading) return <Spinner />;

  return (
    <div className="min-h-screen bg-white">
      <AdminHeader profile={state.profile} nav={nav} />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-4 text-xs text-black/50">{pathname?.split("/").filter(Boolean).join(" / ")}</div>
        {children}
      </main>
    </div>
  );
}
