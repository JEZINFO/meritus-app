"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getProfile } from "@/src/lib/profile";

export default function RequireRole({ allow = [], children }) {
  const router = useRouter();
  const [ok, setOk] = useState(false);

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
      setOk(true);
    })();
  }, [allow, router]);

  if (!ok) return null;
  return children;
}
