import { supabase } from "./supabaseClient";

export async function getProfile() {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  const user = authData?.user;

  if (authError || !user) return { ok: false, error: "Usuário não autenticado." };

  const { data, error } = await supabase
    .from("usuarios")
    .select("user_id, organizacao_id, perfil, ativo, organizacoes(nome)")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (error || !data) return { ok: false, error: "Usuário sem perfil no Meritus (tabela usuarios)." };
  if (!data.ativo) return { ok: false, error: "Usuário inativo." };

  return {
    ok: true,
    profile: {
      user_id: data.user_id,
      email: user.email,
      organizacao_id: data.organizacao_id,
      perfil: data.perfil,
      org_nome: data.organizacoes?.nome || "Organização",
    },
  };
}

export async function signOut() {
  await supabase.auth.signOut();
}
