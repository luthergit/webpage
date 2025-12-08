# AI Ops Webpage (React + TypeScript + Vite)

A fast, minimal React 19 + TypeScript single-page app powered by Vite 7. Built artifacts are served via Nginx in Docker. React Compiler is enabled.

## Tech Stack

- React 19 + React DOM
- TypeScript
- Vite 7 (HMR, fast builds)
- ESLint 9
- React Router DOM 7
- Docker + Nginx (static hosting)

## Prerequisites

- Node.js 20+ (22 recommended)
- pnpm (recommended)
  - If pnpm isn’t installed:  
    ```bash
    corepack enable
    corepack prepare pnpm@latest --activate
    ```

## Quick Start (Local)

```bash
pnpm install
pnpm dev
```

- App runs at http://localhost:5173 (Vite will increment the port if 5173 is busy)

## Scripts

- `pnpm dev`: Start the dev server with HMR
- `pnpm build`: Type-check and build to `dist/`
- `pnpm preview`: Serve the production build locally (default: http://localhost:4173)
- `pnpm lint`: Run ESLint

## Docker

The image builds with pnpm and serves the production build via Nginx on port 5173.

- Build and run with Docker:
  ```bash
  docker build -t webpage:latest .
  docker run --rm -p 5173:5173 webpage:latest
  ```
  App: http://localhost:5173

- Or use Docker Compose:
  ```bash
  docker compose up --build -d
  # bring down
  docker compose down
  ```

## Project Structure

```text
.
├─ public/
├─ src/
│  ├─ assets/
│  ├─ App.css
│  ├─ App.tsx
│  ├─ index.css
│  └─ main.tsx
├─ index.html
├─ vite.config.ts
├─ eslint.config.js
├─ tsconfig.json
├─ tsconfig.app.json
├─ tsconfig.node.json
├─ Dockerfile
├─ docker-compose.yml
└─ package.json
```

## Configuration Notes

- React Compiler is enabled via `babel-plugin-react-compiler`.
- Production builds drop `console` and `debugger` statements (`vite.config.ts`).
- Nginx is configured for SPA routing (`try_files ... /index.html`), so direct route refreshes work.

## Environment Variables

- Use `VITE_`-prefixed variables to expose values to the client.
- Create an `.env` (or `.env.local`) and reference with `import.meta.env`:
  ```env
  VITE_API_BASE_URL=https://api.example.com
  ```

## Troubleshooting

- Port 5173 in use:
  - Stop the conflicting process or let Vite pick the next available port.
  - For Docker, update the published port in `docker-compose.yml` or `docker run`.
- pnpm not found:
  ```bash
  corepack enable
  corepack prepare pnpm@latest --activate
  ```
