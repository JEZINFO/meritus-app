import { redirect } from "next/navigation";

// Mantido só para não quebrar links antigos do Magic Link.
// Você pode remover essa rota se não usar OTP.
export default function Page() {
  redirect("/login");
}
