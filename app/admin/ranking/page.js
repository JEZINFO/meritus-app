import RequireRole from "../../../components/admin/RequireRole";
import { Card, PageTitle } from "../../../components/admin/ui";

export default function Ranking() {
  return (
    <RequireRole allow={["admin", "relatorio"]}>
      <div className="space-y-4">
        <PageTitle title="Ranking" subtitle="Visualização (admin + relatorio)." />
        <Card>
          <p className="text-sm text-black/70">Conecte aqui seu ranking premium com pódio Top 3.</p>
        </Card>
      </div>
    </RequireRole>
  );
}
