
CREATE OR REPLACE VIEW vw_pontos_participante AS
SELECT
    l.programa_id,
    l.participante_id,
    SUM(l.pontos_calculados) AS pontos,
    COUNT(*) AS total_lancamentos,
    MAX(l.criado_em) AS ultima_atividade
FROM meritus_lancamentos l
GROUP BY
    l.programa_id,
    l.participante_id;
