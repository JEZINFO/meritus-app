import RequireRole from "../../../components/admin/RequireRole";
import { Card, PageTitle } from "../../../components/admin/ui";

export default function Relatorios() {
  return (
    <RequireRole allow={["admin", "relatorio"]}>
      <div className="space-y-4">
        <PageTitle title="Relatórios" subtitle="Somente admin e relatorio." />
        <Card>
          <p className="text-sm text-black/70">Área para relatórios e exportações.</p>
        </Card>
      </div>
    </RequireRole>
  );
}
