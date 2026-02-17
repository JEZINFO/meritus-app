import "../globals.css";
import AdminShell from "../../components/admin/AdminShell";

export const metadata = { title: "Meritus | Admin" };

export default function AdminLayout({ children }) {
  return <AdminShell>{children}</AdminShell>;
}
