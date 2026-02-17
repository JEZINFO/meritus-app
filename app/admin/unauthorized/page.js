import { Card, PageTitle } from "../../components/admin/ui";

export default function Unauthorized() {
  return (
    <div className="space-y-4">
      <PageTitle title="Sem permissão" subtitle="Seu perfil não tem acesso a esta página." />
      <Card>
        <p className="text-sm text-black/70">
          Se você acredita que isso é um erro, peça ao administrador para ajustar seu perfil de acesso.
        </p>
      </Card>
    </div>
  );
}
