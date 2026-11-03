# Inactive proposal: email magic links

This is an archived design note, not an implemented or supported authentication flow. The application uses email and password only. Adding magic links later requires an explicit instruction.

---

Understood. You want 100% self-hosted authentication, with no dependency on Supabase, Firebase, Auth0, Clerk, or similar services that might charge you later.

You can build the entire Magic Link system inside your existing React + Python backend.

## Recommended architecture

React frontend

Email input + login callback

Your FastAPI backend

- Generate secure tokens
- Validate magic links
- Create user sessions
- Handle logout

Your PostgreSQL database

Users, hashed tokens, expiry, sessions

Email delivery

SMTP server you control or a free SMTP service

## Technology stack

| Requirement      | Technology              |
| ---------------- | ----------------------- |
| Backend          | Python + FastAPI        |
| Database         | PostgreSQL              |
| Token generation | Python `secrets`        |
| Token hashing    | SHA-256                 |
| Session          | Secure HttpOnly cookies |
| Email            | SMTP                    |
| Frontend         | React                   |

All the authentication code and database remain under your control.

## Important distinction

You can make authentication software completely free, but email delivery and hosting are separate concerns.

If you want absolutely no third-party email provider, you can operate your own SMTP server. However, reliable email delivery requires domain configuration, IP reputation, and ongoing maintenance.

## My recommendation

Build your own authentication module with these endpoints:

```
POST /auth/magic-link
GET  /auth/verify?token=...
GET  /auth/me
POST /auth/logout
```

Security requirements:

- Single-use tokens.
- 10–15 minute expiry.
- Hashed tokens in the database.
- Rate limiting.
- Secure, HttpOnly, SameSite cookies.
- No email enumeration.

One thing to clarify: Do you already have a domain and an email address such as `login@yourdomain.com`, or do you want the entire setup to work without owning a domain?

I can give you a fully self-hosted implementation without tying your application to any paid authentication platform.