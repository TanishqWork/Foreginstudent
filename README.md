# Statement Studio

`Surface` is the React + TypeScript frontend. `Depth` is the FastAPI backend, run directly with Python and connected to Supabase-hosted PostgreSQL. Supabase Auth manages email/password accounts, password verification, and token issuance. FastAPI keeps authentication behind HttpOnly cookies and provides forgot-password and new-password endpoints. A new email creates an account; an existing email requires its existing password. Trimmed, lowercase email is the unique account key.

## Project structure

```text
Surface/src/features/account/  Account UI, auth context, and API client
Depth/src/depth/
  core/                       Settings, domain errors, HTTP middleware/handlers
  database/                   SQLAlchemy base, engine, and session dependencies
  models/                     Database models, one entity per file
  schemas/                    Validated request/response schemas
  repositories/               Database queries and persistence
  security/                   Provider-token and session security utilities
  integrations/               Server-side Supabase Auth and LLM clients
  services/                   Authentication and health business logic
  controllers/                HTTP input/output and cookie handling
  routes/                     Endpoint declarations and dependency wiring
  main.py                     Application factory and lifecycle
Depth/migrations/             Versioned Alembic migrations
Depth/tests/                  Tests isolated from application data
Depth/scripts/migrate_auth_users.py  Import existing accounts into Supabase Auth
Depth/start.ps1               Apply migrations and start FastAPI from its virtual environment
Depth/.env                    Ignored local backend secrets
Depth/.env.example            Backend environment template
```

Requests follow routes -> controllers -> services -> repositories. Security utilities are reusable independently of HTTP. See `Depth/README.md` for module responsibilities and extension rules.

## Local development

A gitignored `Depth/.env` contains the Supabase database connection URL, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, the server-only `SUPABASE_SECRET_KEY`, and an optional OpenAI API key. For a fresh checkout, copy `Depth/.env.example` to `Depth/.env` and replace the placeholders. The secret key is for account migration/admin work. Supabase issues the user JWTs; the application no longer needs its old `JWT_SECRET`. All backend configuration belongs under `Depth`; no Supabase keys or tokens are configured in `Surface`.

Copy the PostgreSQL connection details from your Supabase project's **Connect** dialog. Use its direct connection when your machine supports IPv6, or its **session pooler** on port 5432 when you need IPv4. Use the exact host and username supplied for that connection. The backend URL uses the `postgresql+psycopg://` scheme and `sslmode=require`; URL-encode special characters in the database password. Disable the Supabase Data API for application tables. The React app calls FastAPI, which accesses application data through SQLAlchemy and authentication through the Supabase Auth API.

Enable the Supabase Email provider and set its minimum password length to at least 8. Keep secure email change, secure password change, and require-current-password protection enabled; a verified recovery session is exempt from requiring the forgotten password. Configure the project's JWT expiry to **86,400 seconds** and a 24-hour provider session time-box where available; FastAPI independently enforces the absolute one-day login limit. Set the local Site URL to `http://localhost:5173` and allow both exact callbacks: `http://localhost:5173/api/auth/recovery/callback` and `http://localhost:5173/api/auth/confirmation/callback`. Add matching HTTPS URLs when deploying. Signup email confirmation remains enabled in the current configuration; the frontend handles a confirmation-required response without granting a session.

For development without an email provider, Supabase's built-in email service can send only to email addresses on the organization's team and is limited to **2 messages per hour**. Public password recovery requires custom SMTP configured in Supabase, or an email-send hook. The email OTP/link expiry of 3600 seconds is separate from the one-day application session. See [Supabase email delivery](https://supabase.com/docs/guides/auth/auth-smtp).

Applying migration `0003_backend_rls` enables row-level security on the application account, session, and rate-limit tables without adding Data API access policies. FastAPI uses the database owner's PostgreSQL connection, which retains access to these tables.

Install Python 3.11 or newer and `uv`, then start a fresh database/backend from the repository root. For an existing database with local password hashes, complete the migration sequence below before running `upgrade head` or the startup script.

```powershell
cd Depth
uv sync --extra dev
uv run alembic upgrade head
uv run uvicorn depth.main:app --host 127.0.0.1 --port 8000 --reload
```

After dependencies are installed, `Depth/start.ps1` can apply migrations and start the API using the existing virtual environment. Run `.\start.ps1 -Reload` from `Depth` for automatic development reloads. The optional `-Port` argument defaults to 8000; for example, `.\start.ps1 -Reload -Port 8000`. Stop the API with Ctrl+C.

In a separate terminal, start the frontend from the repository root:

```powershell
cd Surface
npm.cmd install
npm.cmd run dev -- --host 127.0.0.1
```

Run the Alembic upgrade command before starting FastAPI after pulling database changes. The startup script performs that step automatically. Application data is stored in the hosted Supabase database.

| Service | Address | Purpose |
| --- | --- | --- |
| Frontend | http://localhost:5173/account | Email/password sign-in and account creation |
| API documentation | http://localhost:8000/docs | Health and authentication route documentation |
| Readiness | http://localhost:8000/api/health/ready | Check the database connection |
| Supabase dashboard | Your Supabase project | Browse tables and run SQL queries |
| PostgreSQL | Host from the Supabase Connect dialog | Backend and desktop database-client connections |

Use **localhost** consistently in the browser. `FRONTEND_URL` defaults to `http://localhost:5173`, and Vite fixes this port. `API_URL` defaults to `http://localhost:8000` so Swagger can send authentication requests from the API's own origin. Vite proxies `/api` to the backend so cookies use the frontend origin.

## Authentication

Enter an email and password at `/account`. A new email signs up with Supabase Auth; an existing account must authenticate with its existing password. Existing-password login accepts 8-128 characters and preserves whitespace and case. New and reset passwords additionally have a 72-byte UTF-8 limit, and Supabase applies configured password-strength rules. With signup email confirmation enabled, signup shows a check-email message and grants no signed-in session until the provider confirms the account. Open the confirmation email in the browser that started signup: the backend exchanges its one-time PKCE code at `/api/auth/confirmation/callback` using an independent HttpOnly signup verifier, then creates the authenticated cookie session. Missing or expired signup state returns to the account page without signing in. Supabase owns password storage; the frontend and application profile table do not keep password hashes.

FastAPI places the provider-issued access and refresh tokens, plus an independent session proof, in HttpOnly, SameSite=Lax cookies scoped to `/api`, with a maximum login duration of **86,400 seconds (one day)**. Protected requests validate the provider identity, session proof, and an active server-side session. Refreshing a provider token does not extend that original one-day limit. Sign-out revokes the server session and provider session so a replayed cookie is rejected immediately. React stores only public user/expiry metadata in memory; it has no Supabase SDK and never reads or stores access/refresh tokens in local or session storage.

Choose **Forgot password?** to enter an email. The response is the same whether an account exists. Supabase sends a recovery email when the address is eligible. Open the link in the same browser that requested it so the backend's HttpOnly PKCE verifier is available. The backend exchanges the one-time recovery code and sets a restricted recovery cookie; it does not grant access to the dashboard. `/reset-password` collects a new password and confirmation. A successful update revokes existing sessions and returns the user to sign in. Invalid, expired, reused, or missing-browser-state links require a new recovery request.

### Existing-account cutover

Stop the old API first. From `Depth`, run the account migration before removing local hashes:

```powershell
uv run alembic upgrade 0004_supabase_auth
uv run python scripts/migrate_auth_users.py
uv run python scripts/migrate_auth_users.py --apply
uv run alembic upgrade head
```

The script runs as a dry run without `--apply`. It checks provider/email collisions and imports supported legacy Argon2id password hashes through the Supabase Admin API while preserving application user IDs. It does not mark previously unverified email addresses verified or assign new passwords. Migrated unverified accounts may need provider email verification or verified recovery before sign-in, according to the project's policy; review accounts needing explicit enrollment. Migration `0004_supabase_auth` links provider identities and revokes old custom sessions; the guarded cleanup migration removes `password_hash` only after successful account migration. A fresh empty database can migrate directly to `head`. Applied migrations are not rewritten, and application records are preserved.

## Browse the database

Open the Supabase project's **Table Editor** to browse application tables in the `public` schema, or **SQL Editor** to run queries. Supabase Auth manages authentication users and provider sessions; `public.users` retains stable application IDs and provider identity links, while `public.auth_sessions` records application expiry/revocation and session-proof/recovery-token fingerprints. View provider accounts under Supabase **Authentication -> Users**.

Desktop database clients can use the project's PostgreSQL connection details with SSL. Keep database credentials in `Depth/.env` and out of frontend environment variables.

## Routes

| Method | Route | Behavior |
| --- | --- | --- |
| GET | `/api/health` | Process liveness |
| GET | `/api/health/ready` | Database readiness |
| POST | `/api/auth/login` | Accept email/password, create or authenticate through Supabase, and return a cookie session or `confirmation_required` |
| GET | `/api/auth/me` | Return the current user and session expiry, or 401 |
| POST | `/api/auth/logout` | Revoke the session and clear the cookie |
| POST | `/api/auth/forgot-password` | Request a recovery email with a generic, account-independent response |
| GET | `/api/auth/confirmation/callback` | Exchange a signup PKCE code and create a session after provider email confirmation |
| GET | `/api/auth/recovery/callback` | Exchange a verified PKCE recovery code and redirect to the new-password page |
| GET | `/api/auth/recovery` | Check the restricted recovery cookie |
| POST | `/api/auth/reset-password` | Accept `password` and `password_confirmation`, update through Supabase, and revoke sessions |
| POST | `/api/assessments/free` | Assess the signed-in user's submitted draft and return the validated `free-diagnostic.v1` JSON report |

Sign-in works from the frontend or Swagger's **Try it out**. Browser authentication requests must come from the configured `FRONTEND_URL` or `API_URL`; other origins are rejected. Command-line requests without an `Origin` header are also supported.

## Checks and maintenance

```powershell
cd Surface
npm.cmd run lint
npm.cmd run build
```

Backend tests require a separate PostgreSQL database ending in `_test`. Provision that database independently and set `TEST_DATABASE_URL` in the current shell to its `postgresql+psycopg://` connection URL. Do not use the application's Supabase `/postgres` database for tests. From `Depth`, migrate the test database and run the suite:

```powershell
if ($env:TEST_DATABASE_URL -notmatch '^postgresql\+psycopg://.+/[^/?#]+_test(?:\?[^#]*)?$') {
    throw 'Set TEST_DATABASE_URL to a dedicated PostgreSQL database ending in _test.'
}
$previousDatabaseUrl = $env:DATABASE_URL
try {
    $env:DATABASE_URL = $env:TEST_DATABASE_URL
    uv run alembic upgrade head
    if ($LASTEXITCODE -ne 0) { throw 'Test database migration failed.' }
    uv run --extra dev pytest tests -q -p no:cacheprovider
} finally {
    $env:DATABASE_URL = $previousDatabaseUrl
}
```

Tests roll changes back between cases and reject a database name that does not end in `_test`. Supabase Auth is mocked in application tests. A different PostgreSQL database does not isolate the hosted Auth API: use a separate Supabase test project for real signup, provider-session, and recovery-email tests. Provider-mocked assessment tests can run without a database; see `Depth/README.md`.

For deployment, configure the public HTTPS `FRONTEND_URL` and `API_URL`, set `COOKIE_SECURE=true`, and proxy `/api` to the API on the same site. Run FastAPI through your hosting provider's process manager, retain SSL for PostgreSQL, configure real SMTP, and allowlist the exact HTTPS confirmation and recovery callbacks. Free AI assessments return versioned JSON and use one React diagnostic renderer; see [the implementation and debug guide](docs/free-assessment-response-structure.md). The [structured complete-report prototype](docs/complete-report-structure.md) adds a simulated checkout and a detailed report with reusable components and measured durations. Real payments and permanent report persistence remain separate work.
