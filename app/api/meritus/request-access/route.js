import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req) {
  try {
    const body = await req.json();

    const {
      user_id,
      organizacao_id,
      programa_id,
      perfil,
      grupo_id,
    } = body;

    if (!user_id || !organizacao_id || !programa_id || !perfil) {
      return NextResponse.json(
        { error: "Dados obrigatórios ausentes." },
        { status: 400 }
      );
    }

    // 🔎 DEBUG
    console.log("ORG RECEBIDA:", organizacao_id);
    console.log(
      "SERVICE KEY EXISTE:",
      !!process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // 🔥 CLIENT ADMIN (ignora RLS)
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
        "https://zismgizqslcsvjbeuwks.supabase.co",
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // ✅ VALIDAR ORGANIZAÇÃO
    const { data: org, error: orgError } = await supabaseAdmin
      .from("meritus_organizacoes")
      .select("id, ativo")
      .eq("id", organizacao_id)
      .single();

    console.log("ORG ENCONTRADA:", org);
    console.log("ORG ERROR:", orgError);

    if (orgError || !org || !org.ativo) {
      return NextResponse.json(
        { error: "Organização inválida/inativa." },
        { status: 400 }
      );
    }

    // ✅ INSERIR USUÁRIO MERITUS
    const { error: userError } = await supabaseAdmin
      .from("meritus_usuarios")
      .upsert(
        {
          id: user_id,
          organizacao_id,
          programa_id,
          perfil,
          ativo: false,
        },
        { onConflict: "id" }
      );

    if (userError) {
      console.error("Erro meritus_usuarios:", userError);
      return NextResponse.json(
        { error: "Erro ao salvar usuário no Meritus." },
        { status: 500 }
      );
    }

    // ✅ SE FOR FISCAL
    if (perfil === "fiscal" && grupo_id) {
      const { error: grupoError } = await supabaseAdmin
        .from("meritus_usuario_grupos")
        .upsert(
          {
            usuario_id: user_id,
            grupo_id,
          },
          { onConflict: "usuario_id,grupo_id" }
        );

      if (grupoError) {
        console.error("Erro grupo:", grupoError);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Erro inesperado:", err);
    return NextResponse.json(
      { error: "Erro interno do servidor." },
      { status: 500 }
    );
  }
}