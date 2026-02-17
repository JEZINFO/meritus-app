"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getProfile } from "../../src/lib/profile";

export default function RequireRole({ allow = [], children }) {
  const router = useRouter();
  const [state, setState] = useState({ loading: true, ok: false });

  useEffect(() => {
    (async () => {
      const res = await getProfile();
      if (!res.ok) {
        router.push("/login");
        return;
      }
      const role = res.profile.perfil;
      if (allow.length && !allow.includes(role)) {
        router.push("/admin/unauthorized");
        return;
      }
      setState({ loading: false, ok: true });
    })();
  }, [allow, router]);

  if (state.loading) return null;
  return state.ok ? children : null;
}
