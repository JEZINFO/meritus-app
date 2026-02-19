import { supabase } from "./supabase";

/**
 * getProfile()
 * - Evita "embedded select" (organizacoes(...)) porque isso exige FK/relacionamento
 *   registrado no schema cache do PostgREST.
 * - Busca meritus_usuarios e depois resolve nomes (org/programa) em consultas separadas.
 */
export async function getProfile() {
  const { data: uData, error: uErr } = await supabase.auth.getUser();
  const user = uData?.user;
  if (uErr || !user) return { ok: false, error: "Não autenticado." };

  const { data, error } = await supabase
    .from("meritus_usuarios")
    .select("id, organizacao_id, perfil, programa_id, grupo_id, ativo")
    .eq("id", user.id)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Usuário sem cadastro em meritus_usuarios." };
  if (data.ativo === false) return { ok: false, error: "Usuário inativo." };

  // Resolve nomes em queries separadas (não depende de FK)
  let org_nome = "Organização";
  let org_slug = "";
  if (data.organizacao_id) {
    const { data: org } = await supabase
      .from("organizacoes")
      .select("nome,slug")
      .eq("id", data.organizacao_id)
      .maybeSingle();
    if (org?.nome) org_nome = org.nome;
    if (org?.slug) org_slug = org.slug;
  }

  let programa_nome = "";
  if (data.programa_id) {
    const { data: prog } = await supabase
      .from("meritus_programas")
      .select("nome")
      .eq("id", data.programa_id)
      .maybeSingle();
    if (prog?.nome) programa_nome = prog.nome;
  }

  return {
    ok: true,
    profile: {
      id: data.id,
      email: user.email || "",
      organizacao_id: data.organizacao_id,
      perfil: data.perfil,
      programa_id: data.programa_id,
      grupo_id: data.grupo_id,
      org_nome,
      org_slug,
      programa_nome,
    },
  };
}

export async function signOut() {
  await supabase.auth.signOut();
}
