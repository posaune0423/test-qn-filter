### Command: Commit current changes in logical groups (Next.js project)

Do exactly this, non-interactively, from repo root.

1) Ignore when staging:
   - Follow .gitignore strictly. Additionally, ignore: .cursor/** (except this file), .env, .env.*, .vercel

2) Define groups and scopes (by intent/responsibility, not only folder):
   - infra → next.config.ts, next-i18next.config.ts, tailwind.config.ts, tsconfig.json, turbo.json, postcss.config.cjs, prettier.config.cjs, vercel.json, wagmi.config.ts, package.json, pnpm-lock.yaml
   - app → src/app/** (excluding src/app/api/**)
   - api → src/app/api/**, src/server/api/**, src/server/** (server-side handlers, services, uploads, stripe, auth, email, db)
   - components → src/components/**
   - lib → src/lib/** (including i18n runtime, adapters, external integrations)
   - i18n → src/lib/i18n/** and locale jsons
   - utils → src/utils/**, src/constants/**, src/types/**, src/env.ts
   - middleware → src/middleware.ts
   - emails → emails/**
   - scripts → scripts/**
   - prisma → prisma/**
   - sw → src/sw/**, public/sw.js
   - public → public/** (assets, manifest, icons; excluding sw.js above)
   - tests → tests/** (if present)
   - docs → README.md and any *.md

3) For each group that has changes, stage and commit:
   - Decide values:
     - ${emoji}:{fix=🐛, feat=✨, docs=📝, style=💄, refactor=♻️, perf=🚀, test=💚, chore=🍱}
     - ${type} in {fix, feat, docs, style, refactor, perf, test, chore}
     - ${scope} = group name (e.g., infra|app|api|components|lib|i18n|utils|middleware|emails|scripts|prisma|sw|public|tests|docs)
     - ${summary} = 1-line imperative (<=72 chars)
     - ${body} = 1–3 bullets (optional)
   - Commands:
     - git add -A -- -- ${file1} ${file2} ${fileN}
     - git commit --no-verify --no-gpg-sign -m "${emoji} ${type}(${scope}): ${summary}" -m "${body}"

4) Commit order: chore → docs → style → refactor → perf → feat → fix → test

5) Final check:
   - git -c core.pager=cat status --porcelain=v1 | cat

Message template:
  Title: "${emoji} ${type}(${scope}): ${summary}"
  Body:  "- ${changes}\n- ${reasonImpact}"

Examples:
  git add -A -- -- src/lib/i18n/locales/ja/footer.json src/components/footer.tsx
  git commit --no-verify --no-gpg-sign -m "✨ feat(i18n): add footer translations" -m "- ja footer keys\n- wire to Footer component"

  git add -A -- -- src/app/api/revalidate/route.ts src/server/revalidate.ts
  git commit --no-verify --no-gpg-sign -m "🐛 fix(api): correct revalidate handler path" -m "- align with App Router\n- avoid 404 on POST"
