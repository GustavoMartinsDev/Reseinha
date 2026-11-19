# @telacast/api

Backend serverless (Vercel Functions + Upstash Redis).

## Deploy
1. Crie um banco no Upstash Redis (REST).
2. `npm i -g vercel` e `vercel link` (Root Directory = `apps/api`; habilite "Include source files outside of the Root Directory" para o workspace `@telacast/shared`).
3. Configure as env vars (ver `.env.example`): `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `JWT_SECRET`, `INVITE_CODE`, opcional `ICE_SERVERS_JSON`.
   Ex.: `vercel env add JWT_SECRET production`
4. `vercel --prod`

Dev local: copie `.env.example` para `.env` e rode `npm run dev -w apps/api`.
Typecheck: `npx tsc --noEmit -p apps/api`.

Endpoints: veja `packages/shared/src/index.ts`.
