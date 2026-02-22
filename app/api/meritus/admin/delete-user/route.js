import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function json(status, body) {
  return NextResponse.json(body, { status });
}

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !secret) {
    throw new Error("Missing env NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY)");
  }

  return createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
}

function isUuid(v) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v || ""));
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const user_id = String(body.user_id || "").trim();
    if (!user_id || !isUuid(user_id)) return json(400, { error: "user_id inválido" });

    const admin = getAdminClient();

    // Remove vínculos
    await admin.from("meritus_usuario_grupos").delete().eq("usuario_id", user_id);

    // Remove cadastro meritus
    await admin.from("meritus_usuarios").delete().eq("id", user_id);

    // Remove Auth user
    const { error: eAuth } = await admin.auth.admin.deleteUser(user_id);
    if (eAuth && !String(eAuth.message || "").toLowerCase().includes("not found")) {
      return json(500, { error: eAuth.message });
    }

    return json(200, { ok: true });
  } catch (err) {
    return json(500, { error: err?.message || "Erro inesperado" });
  }
}
