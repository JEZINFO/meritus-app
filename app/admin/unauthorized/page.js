import { Card, PageTitle } from "../../../components/admin/ui";

export default function Unauthorized() {
  return (
    <div className="space-y-4">
      <PageTitle title="Sem permissão" subtitle="Seu perfil não tem acesso a esta página." />
      <Card>
        <p className="text-sm text-black/70">
          Peça ao administrador para ajustar seu perfil (admin / fiscal / relatorio).
        </p>
      </Card>
    </div>
  );
}
