"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import AdminHeader from "./AdminHeader";
import { getProfile } from "@/src/lib/profile";
import { supabase } from "@/src/lib/supabase";
import { ProgramProvider } from "./ProgramContext";

const STORAGE_KEY = "meritus_programaId";

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
  const sp = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);

  const [loadingProgramas, setLoadingProgramas] = useState(false);
  const [programas, setProgramas] = useState([]);
  const [programaId, setProgramaId] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);

      const res = await getProfile();
      if (!res.ok) {
        router.push(`/login?next=${encodeURIComponent(pathname || "/admin")}`);
        return;
      }
      setProfile(res.profile);

      // Programas por organização (multi-tenant)
      setLoadingProgramas(true);
      const { data: progs, error } = await supabase
        .from("meritus_programas")
        .select("id,nome,ativo,criado_em,organizacao_id")
        .eq("ativo", true)
        .eq("organizacao_id", res.profile.organizacao_id)
        .order("criado_em", { ascending: false });

      const list = error ? [] : progs || [];
      setProgramas(list);

      const qs = sp?.get("programa") || "";
      const saved = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : "";
      const preferred = qs || saved || res.profile.programa_id || list?.[0]?.id || "";
      setProgramaId(preferred);
      if (typeof window !== "undefined" && preferred) window.localStorage.setItem(STORAGE_KEY, preferred);

      setLoadingProgramas(false);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  useEffect(() => {
    if (typeof window !== "undefined" && programaId) window.localStorage.setItem(STORAGE_KEY, programaId);
  }, [programaId]);

  // ✅ ROLES (OFICIAL)
  // Admin: tudo
  // Fiscal: Dashboard + Lançamentos
  // Relatorio: Dashboard + Ranking + Relatórios
  const nav = useMemo(() => {
    const role = profile?.perfil || "relatorio";

    const base = [
      { href: "/admin", label: "Dashboard", roles: ["admin", "fiscal", "relatorio"] },
      { href: "/admin/lancamentos", label: "Lançamentos", roles: ["admin", "fiscal"] },
      { href: "/admin/ranking", label: "Ranking", roles: ["admin", "relatorio"] },
      { href: "/admin/relatorios", label: "Relatórios", roles: ["admin", "relatorio"] },

];

    const cad = [
      { href: "/admin/cadastros/organizacoes", label: "Organizações", roles: ["admin"] },
      { href: "/admin/cadastros/programas", label: "Programas", roles: ["admin"] },
      { href: "/admin/cadastros/usuarios", label: "Usuários", roles: ["admin"] },
      { href: "/admin/cadastros/acessos-fiscais", label: "--Acessos Fiscal", roles: ["admin"] },
      { href: "/admin/cadastros/grupos", label: "Grupos", roles: ["admin"] },
      { href: "/admin/cadastros/criterios", label: "Critérios", roles: ["admin"] },
      { href: "/admin/cadastros/participantes", label: "Participantes", roles: ["admin"] },
      { href: "/admin/cadastros/periodos", label: "Períodos", roles: ["admin"] },
    ];

    return { base, cad, role };
  }, [profile]);

  const ctxValue = useMemo(
    () => ({ programas, programaId, setProgramaId, loadingProgramas }),
    [programas, programaId, loadingProgramas]
  );

  if (loading) return <Spinner />;

  return (
    <ProgramProvider value={ctxValue}>
      <div className="min-h-screen bg-white">
        <AdminHeader profile={profile} nav={nav} />
        <main className="mx-auto max-w-6xl px-4 py-6">
          <div className="mb-4 text-xs text-black/50">{pathname?.split("/").filter(Boolean).join(" / ")}</div>
          {children}
        </main>
      </div>
    </ProgramProvider>
  );
}
