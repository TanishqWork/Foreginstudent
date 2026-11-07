# Repository conventions

- `Surface` owns the React frontend; `Depth` owns the Python backend. Keep authentication changes aligned across both.
- Keep backend configuration, environment files, migrations, and startup scripts under `Depth`. Run FastAPI directly and use Supabase-hosted PostgreSQL with SSL. Supabase provides database hosting and dashboard tools; application authentication remains in FastAPI. Keep the Supabase Data API disabled for this backend-only connection.
- Authentication currently uses email and password only. Do not add email links, OTP, social sign-in, email delivery, or account-recovery flows unless explicitly requested.
- Normalize email by trimming and lowercasing, and enforce uniqueness in PostgreSQL. New emails create accounts; existing emails require the existing password.
- Preserve the one-day JWT lifetime (86,400 seconds), HttpOnly session cookies, and server-side session revocation unless the user changes these requirements.
- Keep backend routes, controllers, services, repositories, schemas, models, database infrastructure, and security utilities in their respective packages. One database entity per model file; request/response schemas belong outside models.
- Routes declare endpoints and dependencies. Controllers translate HTTP inputs/outputs. Services implement business rules. Repositories own SQLAlchemy queries. Avoid SQL in routes/controllers and HTTP framework objects in services/repositories/security.
- Password hashing/verification and JWT signing/validation belong in separate reusable modules under `security`. Passwords use salted Argon2id hashes; never store or log plaintext passwords or invent reversible password encryption.
- Centralize configuration, domain errors, HTTP error mapping, and middleware. Do not echo credentials in validation errors or responses.
- Keep `main.py` limited to application construction, lifecycle, and registration.
- Evolve existing databases through new Alembic migrations; do not rewrite applied migrations, drop databases, silently claim passwordless accounts, or discard user records.
- Keep secrets in ignored local environment files. PostgreSQL tests must use a dedicated database ending in `_test`, with changes rolled back between tests.
- After auth changes, run backend tests, frontend lint/build, and a targeted HTTP check against the running stack. Update READMEs to describe the implemented behavior.
