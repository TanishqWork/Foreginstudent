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
- `npm test` checks the diagnostic JSON boundary and complete-report API/session helpers using Node's built-in test runner.

The homepage from `../../statement-studio-developer-handoff/dist/index.html` is implemented at `src/features/landing-page/HomePage.tsx` and registered at `/` in `src/App.tsx`. `src/main.tsx` provides React Router's `BrowserRouter`.

The landing-page folder contains the homepage sections, typed content in `homepage.data.ts`, shared header/footer and accessible native dialogs in `components`, and shared Tailwind utility classes in `ui.ts`. Tailwind v4 runs through `@tailwindcss/vite`; `src/index.css` contains the Tailwind import, explicit source registration, and theme tokens. Local branding and the founder image live in `public/assets`. Tailwind utilities preserve the handoff's final indigo/mint theme, system font fallbacks, responsive breakpoints, and reduced-motion preferences. No custom homepage stylesheet is used.

The methodology page from the handoff's `#methodology` view is implemented at `src/features/methodology/MethodologyPage.tsx` and registered at `/methodology`. “How it works” in the desktop and mobile navigation, the footer's “Methodology,” and “Read the methodology” open this page. It uses the shared header, footer, and Tailwind theme.

The sample report page from the handoff's `#sample-report` view is implemented in `src/features/sample-report` at `/sample-report`. Desktop/mobile navigation and “Open a sample report” on the homepage open it. “Open complete sample report” opens `/sample-report/full`, a read-only rendering of the handoff's fictional assessment snapshot. No assessment engine or applicant input is run in the React app.

The pricing page from the handoff's `#pricing` view is implemented in `src/features/pricing` at `/pricing`. Desktop/mobile navigation and the footer open this page. It preserves the four plans, recommended-plan ribbon, review-type filters, comparison strip, decision guide, and responsive layouts. The filter tabs support arrow keys, Home, and End. Plan buttons open preview checkout dialogs; payments remain disabled.

The account page is implemented at `src/features/account/AccountPage.tsx` and registered at `/account`. It connects to the Depth backend through `POST /api/auth/login` with an email and password. A new email creates an account automatically; an existing email requires its correct password. Passwords must contain 8 to 128 characters and are never trimmed. The form clears after successful sign-in. Sessions last one day. The signed-in view shows the email, session expiry, and sign-out action. Desktop and mobile navigation change to **My account** after sign-in.

The account feature separates page rendering (`AccountPage.tsx`), session state (`AuthProvider.tsx`), shared context (`auth-context.ts`), and API requests, response types, and error handling (`auth.ts`). `AuthProvider` checks `/api/auth/me` when the app loads. Requests use an HttpOnly session cookie; JWTs are never stored in browser local storage. Sign-out calls the backend to revoke the session. The account form includes loading, invalid-credential, validation, and unavailable-service states.

Vite development and preview servers use `http://localhost:5173` and proxy `/api` to `http://127.0.0.1:8000`. The port is fixed so allowed origins keep matching the backend configuration. To use a different backend, set `API_PROXY_TARGET` in `Surface/.env.local` (for example, `API_PROXY_TARGET=http://localhost:8001`). This variable is server-side configuration and is not exposed to the browser. Run the FastAPI backend directly from `Depth` using the repository root setup instructions. FastAPI connects to Supabase-hosted PostgreSQL; the React app continues to use its existing FastAPI endpoints and session cookies. Keep database credentials in `Depth/.env`. Production hosting must route `/api` to Depth on the same origin, or configure an equivalent reverse proxy.

The assessment form from the handoff's `#assessment` view is implemented at `src/features/assessment/AssessmentPage.tsx` and registered at `/assessment`. Review and free-assessment links preserve their pathway through `?pathway=...`. The pending draft stays in session storage during sign-in. After confirmation at `/dashboard/assessment`, the form posts to `/api/assessments/free`, validates the versioned JSON response, and displays the diagnostic result. Returning to the form preserves the draft.

`src/features/assessment/diagnostic/DiagnosticResult.tsx` selects exactly one `FreeDiagnosticV1` renderer for `free-diagnostic.v1`. All pathways and statement types share it. `response.ts` checks the fields consumed by the page, and `types.ts` describes that display contract; the backend retains the complete scoring audit. For isolated debugging, open `/tests/diagnostic-preview.html` on the Vite development server. It uses a fictional backend-validated fixture with a state selector and makes no provider requests. See [the response/debug guide](../docs/free-assessment-response-structure.md).

The signed-in `/dashboard` opens Free assessment. Its sidebar includes Free assessment and Complete report, the signed-in identity, and sign-out. Complete report reopens the latest assessment in this browser tab at `/dashboard/complete-report?assessment=...`. A clearly labelled mock checkout unlocks a detailed GPT-5 report. The fixed `complete-report.v1` renderer displays all report sections and maps every returned item to reusable components, without fixed card quotas. The model supplies typed content; React owns section headings and layout. Free and complete generation times are shown, and Copy report produces readable text. Reports are temporarily held in backend memory, without database storage or real payments. See [the complete-report guide](../docs/complete-report-structure.md). The sample writing/learning links and progress shortcut remain in the separate `/workspace` demonstration.

Homepage section navigation remains available at `/#pathways` and `/#pricing`. The shorter homepage process overview and report extract remain available at `/#methodology` and `/#sample-report`. Homepage dialogs use `?panel=privacy|outcomes|checkout`, with an optional `plan` parameter for checkout. Browser back/forward and direct links work through React Router. Unrecognized paths show a 404 with a homepage link.

This migration includes the homepage, methodology, pricing, account, assessment form, live diagnostic renderer, temporary complete report, and fictional sample report pages. Email/password authentication and AI assessment are connected to Depth. Real payments and permanent report saving remain unavailable. Gallery documents and the diagnostic development fixture are clearly marked fictional examples. No legacy assessment engine, account code, or checkout scripts are loaded.

For production hosting, serve the contents of `dist` and configure an SPA fallback to `index.html` for routes without matching static files.
