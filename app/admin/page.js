import RequireRole from "../../components/admin/RequireRole";
import { Card, PageTitle } from "../../components/admin/ui";

export default function AdminHome() {
  return (
    <RequireRole allow={["admin", "fiscal", "relatorio"]}>
      <div className="space-y-4">
        <PageTitle
          title="Dashboard"
          subtitle="Base premium. Aqui entram KPIs, período aberto e tendências."
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card><div className="text-xs text-black/50">Período aberto</div><div className="mt-1 text-xl font-semibold">—</div></Card>
          <Card><div className="text-xs text-black/50">Lançamentos (semana)</div><div className="mt-1 text-xl font-semibold">—</div></Card>
          <Card><div className="text-xs text-black/50">Top 1</div><div className="mt-1 text-xl font-semibold">—</div></Card>
        </div>
      </div>
    </RequireRole>
  );
}
