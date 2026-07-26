# Prompt — Deploy the dashboard live (free) on GitHub + Vercel

Paste everything below into Claude Code.

---

## Goal
Publish this **Vite + React + TypeScript** dashboard as a **free, public, auto-updating** static site. It should build to static files, live on **Vercel**, and redeploy automatically on every `git push`. End state: a shareable URL like `film-workshops-dashboard.vercel.app` that updates within ~1 minute whenever code or data changes.

## Do this step by step

**1. Verify a clean production build first**
- Run `npm install`, then `npm run build`. Fix any TypeScript/lint errors until it builds cleanly into `dist/`.
- Run `npm run preview` and confirm the app loads (RTL Arabic UI renders, no console errors).

**2. Prep the repo for hosting**
- Ensure `.gitignore` excludes `node_modules/`, `dist/`, and `.env*` (do NOT commit secrets or build output).
- The project is a Single Page App. Add a `vercel.json` at the repo root so client-side routing/deep links don't 404:
  ```json
  {
    "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
  }
  ```
- Confirm `package.json` has `"build": "tsc -b && vite build"` and Vite's default output is `dist`. Vite's base path should be `/` (default) for Vercel.

**3. Put it on GitHub**
- `git init` (if not already a repo), commit everything: `git add -A && git commit -m "Prepare dashboard for deployment"`.
- Create a GitHub repo and push. If the GitHub CLI is available: `gh repo create film-workshops-dashboard --private --source=. --push`. Otherwise print the exact commands for me to create the repo on github.com and add the remote + push.
- Recommend **private** repo (the app/data may include personal info) — the deployed site can still be public or access-restricted separately.

**4. Deploy to Vercel**
- Preferred: connect the GitHub repo in the Vercel dashboard → New Project → import the repo. Framework preset: **Vite**. Build command: `npm run build`. Output directory: `dist`. Install command: `npm install`.
- Or via CLI: `npm i -g vercel`, then `vercel` (link/first deploy) and `vercel --prod` (production). Print any URLs it returns.
- After the first deploy, Vercel auto-builds on every push to the main branch. Pull requests get preview URLs automatically.

**5. Verify**
- Open the production URL, confirm the dashboard loads, navigation works, deep links refresh without 404s, and there are no console errors.
- Report the final live URL.

## The update flow (document this in the README)
To update the live site: change the data or code, commit, and `git push`. Vercel rebuilds and publishes automatically in ~1 minute — everyone with the link sees the new version, no manual upload.

## Notes / guardrails
- If the app fetches from a backend/API or uses any keys, put them in **Vercel Environment Variables** (Project → Settings → Environment Variables), not in the code, and reference via `import.meta.env.VITE_*`.
- Do not commit `.env`, `node_modules`, or `dist`.
- If the deployed data contains participants' personal information (names, national IDs, phones, emails), do **not** leave the site fully public — set up access protection (e.g. Vercel password protection, or move the frontend to Cloudflare Pages + Cloudflare Access for free email-gated login) before sharing the link widely. Flag this to me and ask before making it public.

## Acceptance criteria
- `npm run build` succeeds and `dist/` is produced.
- Repo is on GitHub; `vercel.json` SPA rewrite is present.
- A live Vercel URL serves the dashboard with working navigation and no 404 on refresh.
- A test `git push` triggers an automatic redeploy that goes live.
- README documents the live URL and the push-to-update flow.
