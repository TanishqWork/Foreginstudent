# Depth: Statement Studio API

FastAPI + SQLAlchemy + PostgreSQL, with email and password authentication.
`Surface` is the React frontend; `Depth` owns authentication and persistence.

From this `Depth` directory, start the local stack with `docker compose up -d --build`.
See the root README for service URLs, database browsing, local credentials, and frontend startup.
Docker applies Alembic migrations before starting the API.

The backend's `compose.yaml`, `Dockerfile`, `.env`, `.env.example`, and `docker/pgadmin/`
configuration all live here. Run Docker Compose commands from `Depth`; the explicit
`statement-studio` project name preserves the existing PostgreSQL and pgAdmin volumes.
For a fresh checkout, copy `.env.example` to `.env` and replace its secret placeholders.

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
compose.yaml              Backend/PostgreSQL/pgAdmin service definitions
Dockerfile                Backend image
.env                      Ignored local secrets
.env.example              Environment template
docker/pgadmin/            Local database viewer configuration
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

Optional settings are `reasoning_effort`, `verbosity`, `max_output_tokens`, and
`temperature`; support depends on the selected model. No assessment endpoint or
frontend flow calls this function yet.

## Run Python outside Docker

Run from `Depth`:

```powershell
uv sync --extra dev
$localSettings = Get-Content -Raw .env | ConvertFrom-StringData
$env:DATABASE_URL = 'postgresql+psycopg://{0}:{1}@127.0.0.1:{2}/{3}' -f $localSettings.POSTGRES_USER, $localSettings.POSTGRES_PASSWORD, $localSettings.POSTGRES_PORT, $localSettings.POSTGRES_DB
uv run alembic upgrade head
uv run uvicorn depth.main:app --host 127.0.0.1 --port 8000 --reload
```

Settings read only the local `Depth/.env`; process environment variables override it.
Compose constructs the container database URL from this file's credentials. The host
startup commands above construct `DATABASE_URL` with the published local PostgreSQL
port without printing credentials. Do not start a second API on port 8000 while the
Docker API is running; stop that service first with `docker compose stop api`.

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
target the application database. From `Depth`, create it once and run migrations/tests
without printing the database URL:

```powershell
docker compose exec -T postgres createdb -U statement_studio statement_studio_test
docker compose run --rm --no-deps api sh -c 'export DATABASE_URL="${DATABASE_URL%/*}/statement_studio_test"; alembic upgrade head && TEST_DATABASE_URL="$DATABASE_URL" pytest tests -q -p no:cacheprovider'
```

For host execution, set `TEST_DATABASE_URL` to the dedicated test database before
running `uv run --extra dev pytest`. See `tests/conftest.py` for the database guard
and transaction rollback isolation.
