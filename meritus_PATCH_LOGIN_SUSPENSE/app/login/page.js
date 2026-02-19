import { Suspense } from "react";
import LoginClient from "./LoginClient";

export const metadata = { title: "Meritus | Login" };

export default function Page() {
  return (
    <Suspense fallback={<div style={{ padding: 16 }}>Carregando…</div>}>
      <LoginClient />
    </Suspense>
  );
}
