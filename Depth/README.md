# Depth: Statement Studio API

FastAPI + SQLAlchemy + Supabase-hosted PostgreSQL and Supabase Auth.
`Surface` is the React frontend; `Depth` owns the server-side authentication gateway,
application authorization, cookies, and persistence. Supabase Auth manages passwords,
provider identities, and token issuance.

Run FastAPI directly from this `Depth` directory using Python 3.11 or newer and `uv`.
See the root README for service URLs, Supabase setup, and frontend startup.
For a fresh checkout, copy `.env.example` to the ignored `.env` file and replace its
database URL, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and server-only
`SUPABASE_SECRET_KEY` placeholders. Keep the optional OpenAI API key here too.
The old application `JWT_SECRET` is not used after the Supabase Auth cutover.
`start.ps1` applies Alembic migrations before starting the API from its existing
virtual environment; the explicit commands are shown below.

## Structure and responsibilities

```text
src/depth/
  main.py                 App factory, middleware registration, lifecycle, route wiring
  dependencies.py         Request-scoped dependency construction
  core/
    config.py             Environment settings and session constants
    exceptions.py         Domain errors without HTTP dependencies
    handlers.py           Domain/database/validation errors mapped to HTTP responses
    middleware.py         Origin checks and private-response cache headers
  database/
    base.py               Declarative base and timestamp helper
    session.py            Engine/session factory and request-scoped database sessions
  models/
    user.py               SQLAlchemy user model
    auth_session.py       SQLAlchemy session model
    auth_rate_limit.py    SQLAlchemy request counter model
  schemas/
    auth.py               Login request and public account/session responses
    health.py             Health response contracts
  integrations/
    llm.py                Async text generation through OpenAI's Responses API
    supabase_auth.py      Server-side Supabase Auth API integration
  security/
    tokens.py             Provider-token and session security helpers
  repositories/           Database queries only: users, sessions, counters, readiness
  services/               Account/session rules, transaction boundaries, rate limits
  controllers/            HTTP input/output, cookies, public response serialization
  routes/                 Endpoint declarations delegating to controllers
migrations/               Versioned database schema changes
tests/                    Mocked LLM unit tests and isolated PostgreSQL tests
scripts/migrate_auth_users.py  Legacy-account import through Supabase Admin API
start.ps1                 Migration and FastAPI startup script
.env                      Ignored local secrets
.env.example              Environment template
```

The request path is **route → controller → service → repository**. Security helpers
are reused by services. Routes and controllers contain no SQL; services, repositories,
and security helpers have no FastAPI request/response or HTTP exception dependencies.
Models, request/response schemas, settings, and database setup live in separate packages.

## Routes

| Method | Route | Behavior |
| --- | --- | --- |
| GET | `/api/health` | API liveness; independent of database availability |
| GET | `/api/health/ready` | Database readiness; returns 503 when unavailable |
| POST | `/api/auth/login` | Email/password signup or login through Supabase Auth; returns a session or `confirmation_required` |
| GET | `/api/auth/me` | Returns `{ "user": { "id", "email", "created_at" }, "expires_at" }`, or 401 |
| POST | `/api/auth/logout` | Revokes the current session and clears its cookie; returns 204 |
| POST | `/api/auth/forgot-password` | Requests a provider recovery email and returns a generic message |
| GET | `/api/auth/confirmation/callback` | Exchanges a signup PKCE code, creates the cookie session, and redirects to the dashboard |
| GET | `/api/auth/recovery/callback` | Exchanges the PKCE recovery code, sets a restricted cookie, and redirects to `/reset-password` |
| GET | `/api/auth/recovery` | Checks whether the browser has a valid restricted recovery session |
| POST | `/api/auth/reset-password` | Accepts `password` and `password_confirmation`; updates through Supabase and revokes sessions |

Interactive route documentation is at `http://localhost:8000/docs`. Browser auth POST
requests allow the configured `FRONTEND_URL` and `API_URL`, so both the frontend and
Swagger can sign in. Other origins remain blocked; CLI requests may omit Origin.
The React application uses these same-origin FastAPI endpoints. No Supabase SDK,
API key, or access/refresh token is exposed to its JavaScript. Signup confirmation
remains enabled in the current Supabase configuration; a confirmation-required
response is not an authenticated session.

## Authentication behavior

Emails are trimmed and lowercased, with unique and normalization constraints enforced
by PostgreSQL. A new email signs up through Supabase Auth; an existing account must
authenticate with its existing password. A provider identity is linked explicitly
to the stable application user ID. An unverified email alone never authorizes
claiming an existing application record.

Existing-password login accepts 8-128 characters, with whitespace and case preserved.
New and reset passwords additionally have a 72-byte UTF-8 limit; the provider
enforces configured password-strength rules. Password-strength rejections return
422 with safe, actionable guidance instead of the raw provider response. A rejected
password does not consume the current recovery session; users can correct it and
retry before that session expires. Reusing the current password is also reported
as a validation error, rather than an expired recovery session. Supabase Auth owns password
storage, hashing, verification, and JWT issuance. FastAPI does not mint its own
tokens, maintain a second runtime password database, or return secrets in responses.
Each request has its own provider authentication context rather than sharing a
mutable user's SDK session across requests.

Configure the Supabase project's JWT expiry to **86,400 seconds (one day)** and use
a 24-hour provider time-box where available. The `depth_session`, `depth_refresh`,
and independent `depth_session_proof` cookies are HttpOnly, SameSite=Lax, and scoped
to `/api`. FastAPI independently enforces an absolute one-day login limit, including
after refresh, and verifies the provider identity, session proof, and active
server-side session. Logout revokes the provider and application session
and clears the cookie, so replaying it fails immediately even if its JWT has not
expired. Tokens are not returned for storage in browser JavaScript.

Use HTTPS, `COOKIE_SECURE=true`, and matching public `FRONTEND_URL`/`API_URL` for
deployment. The frontend should proxy `/api` to the API on the same site. CLI
requests without an Origin header remain supported. Privileged Supabase secret
keys are only for backend administrative work, including legacy-user import.

Signup email confirmation uses `/api/auth/confirmation/callback`. Its PKCE verifier
is stored in a separate HttpOnly `depth_signup_verifier` cookie, scoped to that
callback, and is independent of the recovery verifier. Open the confirmation link
in the same browser that submitted signup. A valid code creates the authenticated
cookie session and redirects to the dashboard; invalid or missing browser state
returns to the account page without a session.

## Forgot and reset password

The frontend's forgot-password page submits an email to `/api/auth/forgot-password`.
The API returns the same message whether the email exists. Supabase sends eligible
addresses a recovery email, and the backend stores the PKCE verifier in an HttpOnly
cookie. The recovery link must be opened in the same browser that requested it.

The `/api/auth/recovery/callback` endpoint exchanges a valid one-time code and grants
only restricted password-recovery access. The `/reset-password` page collects a new
password and matching confirmation. `/api/auth/reset-password` changes the password
through Supabase, revokes existing sessions, clears recovery state, and returns the
user to sign in. Normal application sessions cannot bypass the recovery check, and
recovery cookies do not grant access to assessments, reports, or the dashboard.
Expired, reused, invalid, or missing-browser-state links require a new recovery
request. Recovery codes, passwords, and tokens must not be logged.

In Supabase Auth configuration, enable the Email provider and set minimum password
length to at least 8. Secure email change, secure password change, and require-current-
password protection can remain enabled: a freshly verified provider recovery session
is exempt from presenting the forgotten password. Email OTP/link expiry of 3600
seconds controls recovery-link validity, not the one-day application session.

For local development, set Site URL to `http://localhost:5173` and allow both exact
callbacks: `http://localhost:5173/api/auth/recovery/callback` and
`http://localhost:5173/api/auth/confirmation/callback`. Set matching HTTPS URLs when
deploying. Signup email confirmation is enabled in the current project setup.

Without custom SMTP, the hosted Supabase email service only delivers to addresses
belonging to the organization's team and is limited to **2 emails per hour** across
the project. This is sufficient for restricted development tests. Configure custom
SMTP in Supabase Auth before offering recovery to arbitrary public users; the
application does not need SMTP credentials in its frontend. See
[Supabase's email-delivery guide](https://supabase.com/docs/guides/auth/auth-smtp).

## Existing database migration

Keep the applied migrations intact. `0002_password_auth` added legacy Argon2id
hashes and retired email-link sign-in. `0003_backend_rls` enabled row-level security
on the application account, session, and rate-limit tables. Application table
access remains behind FastAPI; keep the Supabase Data API disabled for these tables.

For an existing database, stop the old API before importing accounts. From `Depth`:

```powershell
uv run alembic upgrade 0004_supabase_auth
uv run python scripts/migrate_auth_users.py
uv run python scripts/migrate_auth_users.py --apply
uv run alembic upgrade head
```

The script is a dry run without `--apply`. It checks existing provider accounts and
email collisions before importing compatible Argon2id hashes via the Supabase Admin
API. Application user IDs and data ownership are preserved. It never assigns a new
password to an existing account or changes an unverified address into a verified one.
Review reported collisions or accounts needing explicit recovery/enrollment rather
than silently overwriting them. A migrated unverified account may need provider
email verification or verified recovery before sign-in under the project's policy.

`0004_supabase_auth` adds the provider identity mapping and token fingerprints,
and revokes the old custom sessions. The subsequent cleanup migration is guarded:
legacy password storage is removed only after account migration succeeds. A fresh
database with no users can migrate directly to `head`. The startup script runs
`upgrade head`, so complete this cutover before using it on an existing database.

The archived proposal under `docs/proposals/` describes retired email-link sign-in;
it is not the current password-recovery implementation.

## Reusable LLM component

Set `OPENAI_API_KEY` in the backend's ignored `Depth/.env`. Call `generate_text`
from an async backend service; it returns the response as a plain string.

```python
from depth.integrations.llm import generate_text


async def review_text(statement: str, prompt: str) -> str:
    text = await generate_text(
        input_prompt=statement,
        system_prompt=prompt,
        model="YOUR_MODEL_ID",
        reasoning_effort="medium",
        max_output_tokens=8192,
    )
    return text
```

Optional settings are `reasoning_effort`, `verbosity`, `max_output_tokens`,
`temperature`, `output_model`, and the SDK-only `timeout_seconds`; support for
generation settings depends on the selected model. The helper's default timeout
is 90 seconds; the free and complete assessments explicitly allow 180 seconds.
`output_model` supplies a strict JSON Schema while the helper continues returning
text for service-level validation.

## Free diagnostic assessment

Authenticated `POST /api/assessments/free` returns the `free-diagnostic.v1` JSON
envelope: `context`, the canonical `report`, and supplemental `diagnostic` fields.
The assessment function selects `model="gpt-5"` directly in
`services/assessment_service.py`. Set `OPENAI_API_KEY` in the ignored backend
environment file; model selection does not use an environment variable.

`schemas/assessment_report.py` owns the report contract. The assessment service
requests schema-constrained JSON, checks exact source references, recalculates
scores through `services/assessment_scoring.py`, and retries invalid reports once.
The response is private (`Cache-Control: no-store`) and is not saved to the database.
Successful assessments are temporarily cached for the complete-report prototype.
Validation logs include only field paths/reason codes. Provider credentials and
applicant prose are not logged or included in errors.

See [the implementation and debug guide](../docs/free-assessment-response-structure.md).
Focused provider-mocked tests need no database:

```powershell
.venv\Scripts\python.exe -m pytest tests/test_assessment.py tests/test_llm.py -q -p no:cacheprovider
```

## Complete report prototype

The authenticated complete-report endpoints reuse a temporary, owner-bound free
assessment. Mock unlock charges no money. Generation uses GPT-5 and the adapted
`src/depth/prompts/complete-report-structured.md` prompt. GET, unlock, and generation
return one JSON state with the canonical free assessment and a typed report.
All eleven analytical groups use reusable rows without fixed finding counts.
Validation checks baseline consistency, exact source references, and completeness.
Responses include measured free and complete generation durations. No report
database tables or migrations were added. The one-process memory cache lasts up
to one hour and is lost on restart.
See [the complete-report implementation and debug guide](../docs/complete-report-structure.md).

## Run FastAPI with Supabase

Set `DATABASE_URL` in `Depth/.env` to the PostgreSQL connection details from your
Supabase project's **Connect** dialog. Use `postgresql+psycopg://` and include
`sslmode=require`. URL-encode special characters in the password. Use the direct
connection on an IPv6-capable network, or the session pooler on port 5432 for IPv4;
copy the matching host and username from the dialog. Set `SUPABASE_URL` and the
project's publishable key separately for the Auth API. Keep `SUPABASE_SECRET_KEY`
server-only for legacy-account import and administrative work. These API keys do
not replace the PostgreSQL connection URL. Keep the Supabase Data API disabled
for application tables. SQLAlchemy models, repositories, and Alembic migrations
remain the source of the application's schema; Supabase manages its Auth schema.

For a fresh database, run from `Depth`; existing databases must first follow the
account-cutover sequence above:

```powershell
uv sync --extra dev
uv run alembic upgrade head
uv run uvicorn depth.main:app --host 127.0.0.1 --port 8000 --reload
```

Settings read only the local `Depth/.env`; process environment variables override it.
After installing dependencies, `.\start.ps1` applies migrations and starts the API
using `.venv\Scripts\python.exe`. Add `-Reload` for automatic development reloads.
The optional `-Port` argument defaults to 8000; for example,
`.\start.ps1 -Reload -Port 8000`. Run migrations before starting after database
changes, and stop the development server with Ctrl+C. Start the frontend separately
from `Surface`; its existing `/api` proxy targets this local FastAPI server.

Use the Supabase dashboard's **Table Editor** and **SQL Editor** to inspect the
application database. `public.users` stores stable application IDs linked to the
Supabase provider identity. `public.auth_sessions` stores application expiry,
revocation, and session-proof/recovery-token fingerprints. Supabase **Authentication -> Users** displays
the provider accounts. Never put database credentials or Supabase keys in frontend
configuration, and do not manually modify the provider-managed Auth schema.

## Database tables and rate limits

- `users`: unique normalized email, stable application ID, provider identity mapping, creation timestamp.
- `auth_sessions`: provider session IDs, session-proof/recovery-token fingerprints, account references, expiration/revocation timestamps.
- `auth_rate_limits`: hashed request/email counters shared across API workers.
- `alembic_version`: applied database migration revision.

Supabase Auth owns credential hashes and provider sessions. Legacy `password_hash`
is retained only during the guarded account cutover and removed by its cleanup
migration. Do not add password columns back to the application model.

Login allows five attempts per email and twenty per client IP per 15-minute window.
Both successes and failures count. Limited requests return 429 with `Retry-After`.
Client IP comes from the ASGI client; configure Uvicorn's trusted proxy settings
explicitly behind a reverse proxy. Expired sessions and rate buckets can be removed
periodically by a scheduled maintenance task.

## Tests

The LLM unit tests use mocked provider responses and need no API key, network call,
or database. From `Depth`, run:

```powershell
uv run --extra dev pytest tests/test_llm.py -q
```

Application database tests require a separate PostgreSQL database ending in `_test`; they never
target the application database. Provision that database separately, then set
`TEST_DATABASE_URL` in your shell to its connection URL. The normal Supabase
application database named `postgres` is not a test database. From `Depth`, run:

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

The fixture rejects database names without the `_test` suffix and rolls changes
back between tests. See `tests/conftest.py` for these isolation safeguards.

Supabase Auth calls must be mocked in normal application tests. Changing only
`TEST_DATABASE_URL` does not isolate the Auth API: real signup, password reset,
provider-session revocation, and recovery-email checks need a separate Supabase
test/staging project and its own configuration. Never use production Auth users
or send recovery emails to arbitrary addresses as a side effect of a test run.
