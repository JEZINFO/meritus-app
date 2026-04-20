
// Use this inside your data loading function

const { data: pontosData } = await supabase
  .from("vw_pontos_participante")
  .select("participante_id, pontos, total_lancamentos")
  .eq("programa_id", programaId);

const pontosMap = new Map(
  (pontosData || []).map(p => [p.participante_id, p])
);

const rows = participantes.map(p => {
  const pts = pontosMap.get(p.id);

  return {
    ...p,
    pontos: pts?.pontos || 0,
    lancamentos: pts?.total_lancamentos || 0,
  };
});
