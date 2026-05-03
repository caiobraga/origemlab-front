# origemlab-front

App React (Vite) migrado a partir de `originlab` (`client/` + `shared/`). A API HTTP fica no repositório **origemlab-backend**; defina `VITE_API_BASE_URL` apontando para essa API.

## Requisitos

- Node.js **20+** (alinhado ao GitHub Actions)

## Desenvolvimento

```bash
cp .env.example .env.local
# Preencha VITE_SUPABASE_*, VITE_API_BASE_URL, etc.
npm install
npm run dev
```

## Build (igual ao CI)

```bash
export VITE_SUPABASE_URL=...
export VITE_SUPABASE_ANON_KEY=...
export VITE_API_BASE_URL=https://sua-api.exemplo.com
npm run build
# Saída em dist/ — o workflow faz upload para S3
```

## Variáveis

| Variável | Onde |
|----------|------|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | GitHub **Secrets** (build) |
| `VITE_API_BASE_URL`, `VITE_OAUTH_PORTAL_URL`, `VITE_APP_ID` | GitHub **Variables** (build) |
| `AWS_REGION`, `AWS_ROLE_ARN`, `S3_BUCKET`, `CLOUDFRONT_DISTRIBUTION_ID` | GitHub **Variables** (deploy) |

O callback OAuth usa `VITE_API_BASE_URL` quando definido, para o redirect `/api/oauth/callback` bater no backend (não no host estático do S3).
