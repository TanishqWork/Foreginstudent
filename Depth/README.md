# Depth: Statement Studio API

FastAPI + SQLAlchemy + Supabase-hosted PostgreSQL, with email and password authentication.
`Surface` is the React frontend; `Depth` owns authentication and persistence.

Run FastAPI directly from this `Depth` directory using Python 3.11 or newer and `uv`.
See the root README for service URLs, Supabase setup, and frontend startup.
For a fresh checkout, copy `.env.example` to the ignored `.env` file and replace its
database URL and JWT-secret placeholders. Keep the optional OpenAI API key here too.
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
  security/
    passwords.py          Argon2id password hashing and verification
    tokens.py             JWT signing and signature/claim validation
  repositories/           Database queries only: users, sessions, counters, readiness
  services/               Account/session rules, transaction boundaries, rate limits
  controllers/            HTTP input/output, cookies, public response serialization
  routes/                 Endpoint declarations delegating to controllers
migrations/               Versioned database schema changes
tests/                    Mocked LLM unit tests and isolated PostgreSQL tests
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
| POST | `/api/auth/login` | JSON `{ "email": "you@example.com", "password": "your-password" }`; creates a missing account or validates the existing password |
| GET | `/api/auth/me` | Returns `{ "user": { "id", "email", "created_at" }, "expires_at" }`, or 401 |
| POST | `/api/auth/logout` | Revokes the current session and clears its cookie; returns 204 |

Interactive route documentation is at `http://localhost:8000/docs`. Browser auth POST
requests allow the configured `FRONTEND_URL` and `API_URL`, so both the frontend and
Swagger can sign in. Other origins remain blocked; CLI requests may omit Origin.
There is no email-link endpoint, verification-email dependency, or separate signup flow.

## Authentication behavior

Emails are trimmed and lowercased, with unique and normalization constraints enforced
by PostgreSQL. If an email is new, the supplied password creates its account. If it
already exists, the stored password must match. Concurrent account creation cannot
replace another request's password or issue a session without checking that password.

Passwords accept 8–128 characters, including Unicode. Their exact characters are
preserved; they are never trimmed or lowercased. `security/passwords.py` stores only
salted Argon2id hashes, using `pwdlib`. Passwords are not reversibly encrypted and
there is no password decryption function. Validation errors and public response
schemas do not expose passwords or password hashes.

`security/tokens.py` signs and validates JWTs with explicit HS256, issuer, and audience
checks. JWTs expire exactly **86,400 seconds (one day)** after issuance. The
`depth_session` cookie is HttpOnly, SameSite=Lax, and scoped to `/api`; no JWT is
returned for storage in JavaScript. Sessions are also checked in PostgreSQL, so
logout immediately rejects reuse of the same cookie.

Use HTTPS, `COOKIE_SECURE=true`, matching public `FRONTEND_URL`/`API_URL`, and a strong
private `JWT_SECRET` for deployment. The frontend should proxy `/api` to the API on
the same site. CLI requests without an Origin header remain supported.

## Existing database migration

Migration `0002_password_auth` adds `users.password_hash`, revokes previous sessions,
and removes the retired email-link table. Existing user identities and their other
records are preserved. Previous passwordless accounts have no password hash and
**cannot be claimed by entering their email with a new password**. Such accounts
need a deliberate password-enrollment or account-recovery procedure before they
can sign in; neither flow is implemented here.

Applying migration `0003_backend_rls` enables row-level security on `public.users`,
`public.auth_sessions`, and `public.auth_rate_limits` without adding Data API access
policies. FastAPI retains access through the database owner's PostgreSQL connection.
Keep the Supabase Data API disabled for this backend-only setup as described below.

The earlier email-link design note is archived under `docs/proposals/`. It is inactive,
and adding that authentication method later requires an explicit instruction.

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
copy the matching host and username from the dialog. Keep the Supabase Data API
disabled because only FastAPI accesses this database. Existing SQLAlchemy models,
repositories, and Alembic migrations remain the source of the application's schema.

Run from `Depth`:

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
database. This project uses its own `public.users` and `public.auth_sessions` tables
and FastAPI authentication; Supabase Auth is not part of the login flow. Never put
the database connection URL into frontend configuration.

## Database tables and rate limits

- `users`: unique email, salted password hash, account creation timestamp.
- `auth_sessions`: JWT session IDs, account references, expiration/revocation timestamps.
- `auth_rate_limits`: hashed request/email counters shared across API workers.
- `alembic_version`: applied database migration revision.

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

Database tests require a separate PostgreSQL database ending in `_test`; they never
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
