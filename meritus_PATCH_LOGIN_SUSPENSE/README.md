# Patch build Vercel: /login useSearchParams com Suspense

Erro no Vercel:
- useSearchParams() should be wrapped in a suspense boundary at page "/login"

Solução:
- `app/login/page.js` vira Server Component que envolve em `<Suspense>`
- Código original do login (client) vai para `app/login/LoginClient.jsx`

Aplicar:
- sobrescreva `app/login/page.js`
- adicione `app/login/LoginClient.jsx`
