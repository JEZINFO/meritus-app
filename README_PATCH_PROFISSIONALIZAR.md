# Meritus — Patch de Profissionalização

## O que foi feito
- Layout Admin padronizado (Header premium no topo)
- Gate por perfil (admin / fiscal / relatorio)
- Seletor de Programa no Header (multi-programa)
- Rotas /admin completas (scaffolds) + cadastros (scaffolds)
- Tailwind adicionado (para UI premium e consistente)
- Rotas antigas /lancamentos e /ranking agora redirecionam para /admin/* (evita 404)

## Importante: rodar no diretório correto
Se seu repositório tem uma pasta `frontend/`, rode os comandos DENTRO dela:

```bash
cd frontend
npm install
npm run dev
```

Se você rodar `npm run dev` na raiz do mono-repo sem as deps do `frontend`, pode aparecer erro de módulo não encontrado.

## Variáveis de ambiente
No `.env.local`:
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY

## Próximos passos (já alinhados)
- Implementar CRUD real nas telas de cadastros
- Implementar Lançamentos (somente período aberto) para admin/fiscal
- Implementar Ranking/Relatórios para admin/relatorio
