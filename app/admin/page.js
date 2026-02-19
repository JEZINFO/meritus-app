"use client";

import RequireRole from "../../components/admin/RequireRole";
import { Card, PageTitle } from "../../components/admin/ui";

export default function AdminHome() {
  return (
    <RequireRole allow={["admin", "fiscal", "relatorio"]}>
      <div className="space-y-4">
        <PageTitle title="Dashboard" subtitle="Visão geral do programa selecionado." />
        <Card>
          <div className="text-sm text-black/70">
            Próximos passos: indicadores, alertas e atalhos rápidos.
          </div>
        </Card>
      </div>
    </RequireRole>
  );
}
