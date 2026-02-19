"use client";

import "../globals.css";
import AdminShell from "../../components/admin/AdminShell";
import { useSearchParams } from "next/navigation";

export default function AdminLayoutClient({ children }) {
  // se você usa useSearchParams no layout para alguma lógica, deixa aqui
  const searchParams = useSearchParams();

  return <AdminShell searchParams={searchParams}>{children}</AdminShell>;
}
