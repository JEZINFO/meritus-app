import { createClient } from "@supabase/supabase-js";

/**
 * Supabase client (Meritus)
 * Requer variáveis de ambiente:
 * - NEXT_PUBLIC_SUPABASE_URL
 * - NEXT_PUBLIC_SUPABASE_ANON_KEY
 *
 * Mantém compatibilidade com o padrão do PedeSim.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Não quebra build, mas ajuda a diagnosticar no console do navegador
  // quando rodando local sem .env configurado.
  // eslint-disable-next-line no-console
  console.warn(
    "[Meritus] Variáveis NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY não configuradas."
  );
}

export const supabase = createClient(supabaseUrl || "", supabaseAnonKey || "");
