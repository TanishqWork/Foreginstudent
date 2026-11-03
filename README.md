# Statement Studio

`Surface` is the React + TypeScript frontend. `Depth` is the FastAPI backend using PostgreSQL. Authentication uses email and password. A new email creates an account; an existing email requires its existing password. Trimmed, lowercase email is the unique account key.

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
Depth/compose.yaml            Backend, PostgreSQL, and pgAdmin services
Depth/Dockerfile              Backend image
Depth/.env                    Ignored local backend secrets
Depth/.env.example            Backend environment template
Depth/docker/pgadmin/         Local database viewer configuration
```

Requests follow routes -> controllers -> services -> repositories. Security utilities are reusable independently of HTTP. See `Depth/README.md` for module responsibilities and extension rules.

## Local development

A gitignored `Depth/.env` contains independent database, JWT, and pgAdmin secrets for this workspace. For a fresh checkout, copy `Depth/.env.example` to `Depth/.env` and replace the three placeholder secrets. Use URL-safe characters for the database password because Compose includes it in `DATABASE_URL`. All backend infrastructure belongs under `Depth`.

Start the backend stack from the repository root:

```powershell
cd Depth
docker compose up -d --build --remove-orphans
```

In a separate terminal, start the frontend from the repository root:

```powershell
cd Surface
npm.cmd install
npm.cmd run dev -- --host 127.0.0.1
```

The API applies Alembic migrations before starting. Run Docker Compose commands from `Depth`. PostgreSQL data is stored in a named Docker volume and survives `docker compose down`; moving the configuration preserves the `statement-studio` project name and existing volumes.

| Service | Address | Purpose |
| --- | --- | --- |
| Frontend | http://localhost:5173/account | Email/password sign-in and account creation |
| API documentation | http://localhost:8000/docs | Health and authentication route documentation |
| Readiness | http://localhost:8000/api/health/ready | Check the database connection |
| pgAdmin | http://localhost:8081 | Browse tables, rows, and SQL queries |
| PostgreSQL | `localhost:5433` | Connect from a desktop database client |

Use **localhost** consistently in the browser. `FRONTEND_URL` defaults to `http://localhost:5173`, and Vite fixes this port. `API_URL` defaults to `http://localhost:8000` so Swagger can send authentication requests from the API's own origin. Vite proxies `/api` to the backend so cookies use the frontend origin. Email delivery is not part of authentication.

## Authentication

Enter an email and a password of 8-128 characters at `/account`. A new email creates an account automatically. For an existing account, the password must match. Passwords are never trimmed, lowercased, stored as plaintext, or returned in API responses; the database stores salted Argon2id hashes.

JWTs and their HttpOnly, SameSite=Lax cookies expire after exactly **86,400 seconds (one day)**. Tokens are signed and validated in a dedicated security module. The current session is checked against PostgreSQL, and sign-out revokes it immediately. JWTs are not stored in local storage.

Migration `0002_password_auth` adds password hashes, removes the previous email-link token table, and revokes sessions issued by that flow. Existing users are preserved. An account without a password hash cannot be claimed merely by submitting its email; it requires an explicit, authorized password-enrollment process. No password reset or email-link authentication is implemented.

## Browse the database

Log into pgAdmin using `PGADMIN_EMAIL` and `PGADMIN_PASSWORD` from `Depth/.env`. Expand **Development -> Statement Studio (local)**, supply `POSTGRES_PASSWORD`, then open **Databases -> statement_studio -> Schemas -> public -> Tables**. Right-click a table and choose **View/Edit Data -> All Rows**.

Desktop clients can connect to `localhost:5433`, database/user `statement_studio`, using `POSTGRES_PASSWORD` from `Depth/.env`. pgAdmin connects internally to `postgres:5432`. Its server definition in `Depth/docker/pgadmin/servers.json` imports on first startup; update an existing connection through pgAdmin if you later change the database/user names.

## Routes

| Method | Route | Behavior |
| --- | --- | --- |
| GET | `/api/health` | Process liveness |
| GET | `/api/health/ready` | Database readiness |
| POST | `/api/auth/login` | Accept `{ "email": "student@example.com", "password": "..." }`, create or authenticate the account, and set the session cookie |
| GET | `/api/auth/me` | Return the current user and session expiry, or 401 |
| POST | `/api/auth/logout` | Revoke the session and clear the cookie |

Sign-in works from the frontend or Swagger's **Try it out**. Browser authentication requests must come from the configured `FRONTEND_URL` or `API_URL`; other origins are rejected. Command-line requests without an `Origin` header are also supported.

## Checks and maintenance

```powershell
cd Surface
npm.cmd run lint
npm.cmd run build
```

Backend tests require a separate PostgreSQL database ending in `_test`. From `Depth`, create it once, migrate it, then run the suite without displaying database secrets:

```powershell
docker compose exec -T postgres createdb -U statement_studio statement_studio_test
docker compose run --rm --no-deps api sh -c 'export DATABASE_URL="${DATABASE_URL%/*}/statement_studio_test"; alembic upgrade head && TEST_DATABASE_URL="$DATABASE_URL" pytest tests -q -p no:cacheprovider'
```

From `Depth`, inspect services with `docker compose ps` and logs with `docker compose logs api`. Stop services with `docker compose down`; database data persists. Do not add `--volumes` unless you intend to erase it.

For deployment, configure the public HTTPS `FRONTEND_URL` and `API_URL`, set `COOKIE_SECURE=true`, and proxy `/api` to the API on the same site. The Compose ports and pgAdmin are configured for local development. Assessment scoring, payments, report persistence, and account-recovery flows are separate work.
