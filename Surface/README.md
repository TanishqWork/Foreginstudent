# Statement Studio frontend

React and TypeScript frontend powered by Vite.

Run commands from the `Surface` directory:

```sh
npm install
npm run dev
```

- `npm run build` creates a production build in `dist`.
- `npm run lint` checks the source code with ESLint.
- `npm run preview` serves the production build locally.

The homepage from `../../statement-studio-developer-handoff/dist/index.html` is implemented at `src/features/landing-page/HomePage.tsx` and registered at `/` in `src/App.tsx`. `src/main.tsx` provides React Router's `BrowserRouter`.

The landing-page folder contains the homepage sections, typed content in `homepage.data.ts`, shared header/footer and accessible native dialogs in `components`, and shared Tailwind utility classes in `ui.ts`. Tailwind v4 runs through `@tailwindcss/vite`; `src/index.css` contains only the Tailwind import and theme tokens. Local branding and the founder image live in `public/assets`. Tailwind utilities preserve the handoff's final indigo/mint theme, system font fallbacks, responsive breakpoints, and reduced-motion preferences. No custom homepage stylesheet is used.

Section navigation uses `/#pathways`, `/#methodology`, `/#sample-report`, and `/#pricing`. Homepage dialogs use `?panel=assessment|account|privacy|outcomes|checkout`, with optional `pathway` or `plan` parameters. Browser back/forward and direct links work through React Router. Unrecognized paths show a 404 with a homepage link.

This migration includes only the homepage. Assessment, sign-in, payments, and report saving are unavailable and show explanatory panels. Gallery documents remain clearly marked fictional examples. No legacy assessment engine, account code, or checkout scripts are loaded.

For production hosting, serve the contents of `dist` and configure an SPA fallback to `index.html` for routes without matching static files.
