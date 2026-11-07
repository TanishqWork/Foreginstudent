# Statement Studio

`Surface` is the React + TypeScript frontend. `Depth` is the FastAPI backend, run directly with Python and connected to Supabase-hosted PostgreSQL. Authentication uses email and password. A new email creates an account; an existing email requires its existing password. Trimmed, lowercase email is the unique account key.

## Project structure

```text
Surface/src/features/account/  Account UI, auth context, and API client
Depth/src/depth/
  core/                       Settings, domain errors, HTTP middleware/handlers
  database/                   SQLAlchemy base, engine, and session dependencies
  models/                     Database models, one entity per file
  schemas/                    Validated request/response schemas
  repositories/               Database queries and persistence
  security/                   Password hashing and JWT signing/validation
  services/                   Authentication and health business logic
  controllers/                HTTP input/output and cookie handling
  routes/                     Endpoint declarations and dependency wiring
  main.py                     Application factory and lifecycle
Depth/migrations/             Versioned Alembic migrations
Depth/tests/                  Tests isolated from application data
Depth/start.ps1               Apply migrations and start FastAPI from its virtual environment
Depth/.env                    Ignored local backend secrets
Depth/.env.example            Backend environment template
```

Requests follow routes -> controllers -> services -> repositories. Security utilities are reusable independently of HTTP. See `Depth/README.md` for module responsibilities and extension rules.

## Local development

A gitignored `Depth/.env` contains the Supabase database connection URL, JWT secret, and optional OpenAI API key. For a fresh checkout, copy `Depth/.env.example` to `Depth/.env` and replace the placeholders. All backend configuration belongs under `Depth`.

Copy the PostgreSQL connection details from your Supabase project's **Connect** dialog. Use its direct connection when your machine supports IPv6, or its **session pooler** on port 5432 when you need IPv4. Use the exact host and username supplied for that connection. The backend URL uses the `postgresql+psycopg://` scheme and `sslmode=require`; URL-encode special characters in the database password. Disable the Supabase Data API for this backend-only setup. The React app calls FastAPI, which connects to PostgreSQL through SQLAlchemy; Supabase Auth is not used.

Applying migration `0003_backend_rls` enables row-level security on the application account, session, and rate-limit tables without adding Data API access policies. FastAPI uses the database owner's PostgreSQL connection, which retains access to these tables.

Install Python 3.11 or newer and `uv`, then start the backend from the repository root:

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

Use **localhost** consistently in the browser. `FRONTEND_URL` defaults to `http://localhost:5173`, and Vite fixes this port. `API_URL` defaults to `http://localhost:8000` so Swagger can send authentication requests from the API's own origin. Vite proxies `/api` to the backend so cookies use the frontend origin. Email delivery is not part of authentication.

## Authentication

Enter an email and a password of 8-128 characters at `/account`. A new email creates an account automatically. For an existing account, the password must match. Passwords are never trimmed, lowercased, stored as plaintext, or returned in API responses; the database stores salted Argon2id hashes.

JWTs and their HttpOnly, SameSite=Lax cookies expire after exactly **86,400 seconds (one day)**. Tokens are signed and validated in a dedicated security module. The current session is checked against PostgreSQL, and sign-out revokes it immediately. JWTs are not stored in local storage.

Migration `0002_password_auth` adds password hashes, removes the previous email-link token table, and revokes sessions issued by that flow. Existing users are preserved. An account without a password hash cannot be claimed merely by submitting its email; it requires an explicit, authorized password-enrollment process. No password reset or email-link authentication is implemented.

## Browse the database

Open the Supabase project's **Table Editor** to browse application tables in the `public` schema, or **SQL Editor** to run queries. Accounts and sessions live in the application's `users` and `auth_sessions` tables; they are managed by FastAPI.

Desktop database clients can use the project's PostgreSQL connection details with SSL. Keep database credentials in `Depth/.env` and out of frontend environment variables.

## Routes

| Method | Route | Behavior |
| --- | --- | --- |
| GET | `/api/health` | Process liveness |
| GET | `/api/health/ready` | Database readiness |
| POST | `/api/auth/login` | Accept `{ "email": "student@example.com", "password": "..." }`, create or authenticate the account, and set the session cookie |
| GET | `/api/auth/me` | Return the current user and session expiry, or 401 |
| POST | `/api/auth/logout` | Revoke the session and clear the cookie |
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

Tests roll changes back between cases and reject a database name that does not end in `_test`. Provider-mocked assessment tests can run without a database; see `Depth/README.md`.

For deployment, configure the public HTTPS `FRONTEND_URL` and `API_URL`, set `COOKIE_SECURE=true`, and proxy `/api` to the API on the same site. Run FastAPI through your hosting provider's process manager and retain SSL for the Supabase connection. Free AI assessments return versioned JSON and use one React diagnostic renderer; see [the implementation and debug guide](docs/free-assessment-response-structure.md). The [structured complete-report prototype](docs/complete-report-structure.md) adds a simulated checkout and a detailed report with reusable components and measured durations. Real payments, permanent report persistence, and account-recovery flows remain separate work.
