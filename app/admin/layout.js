import { Suspense } from "react";
import AdminShell from "../../components/admin/AdminShell";

export const metadata = { title: "Meritus | Admin" };

export default function AdminLayout({ children }) {
  return (
    <Suspense fallback={<div style={{ padding: 16 }}>Carregando…</div>}>
      <AdminShell>{children}</AdminShell>
    </Suspense>
  );
}
