# Patch: Roles corretos (admin/fiscal/relatorio) na página de Lançamentos

Você informou que NÃO existe perfil 'responsavel'. Este patch ajusta a página para trabalhar apenas com:
- admin
- fiscal
- relatorio

O que foi ajustado:
- Fiscal só pode lançar quando período está ABERTO (podeEditar)
- Fiscal só enxerga períodos ABERTOS (filtro no carregamento e no select)
- Opção "Todos" no combo de Grupos aparece para Admin e Fiscal
- Remove qualquer uso de '__NO_GROUP__' (uuid inválido)

## Aplicar
Sobrescreva:
- app/admin/lancamentos/page.js

Depois:
rm -rf .next
npm run dev
