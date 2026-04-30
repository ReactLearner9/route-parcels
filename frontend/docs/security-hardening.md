# Security Hardening Summary

This project adds four practical security controls for a public-internet deployment.

## Implemented Features

### 1. Security Response Headers
- Added strict headers in backend middleware:
  - `X-Frame-Options: DENY`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: no-referrer`
  - `Permissions-Policy` (deny sensitive browser features)
  - `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy`
  - baseline `Content-Security-Policy`
  - `Strict-Transport-Security` when HTTPS is used
- Why implemented:
  - reduces clickjacking, MIME confusion, data leakage, and unsafe framing risks.

### 2. CORS Allowlist
- Added CORS guard middleware with configured allowlist from `CORS_ORIGINS`.
- Rejects disallowed web origins with `403`.
- Why implemented:
  - prevents arbitrary websites from making browser-based calls to backend APIs using user context.

### 3. Rate Limiting
- Added in-memory IP-based rate limiting:
  - global API limiter
  - stricter auth limiter on `/api/auth/*`
- Returns `429` with `Retry-After`.
- Why implemented:
  - mitigates brute-force login attempts and basic API abuse/DoS patterns.

### 4. Input Hardening + Upload Type Checks
- Added recursive request sanitizer for user payloads:
  - removes dangerous keys: `__proto__`, `prototype`, `constructor`
- Added upload MIME checks for JSON-only uploads.
- Why implemented:
  - lowers prototype-pollution risk and reduces malformed/unsafe content surface from user-submitted inputs.

## What These Features Solve
- Public API exposure risk reduction with layered controls.
- Better defense against common web threats:
  - request flooding/brute-force
  - browser-origin misuse
  - header-based exploitation vectors
  - unsafe nested payload structures and invalid upload content.

## Additional Security Improvements (Next Steps)
- Replace in-memory rate limiting with Redis/shared store for multi-instance deployments.
- Add real session/token auth (JWT or server sessions), role-based authorization middleware, and endpoint protection.
- Add CSRF protection for cookie-based auth flows.
- Add secret management and key rotation strategy (vault or cloud secret manager).
- Add dependency and container scanning in CI.
- Add audit log integrity controls (signing/append-only storage).
- Add WAF/reverse proxy controls (IP reputation, geo/rule blocking).
- Add request schema allowlists per route with stricter type constraints for rule values.

## Interview Talking Points: Trade-offs and Known Limits
- `Rate limiting` is intentionally in-memory for local simplicity:
  - strong enough for demo and single-instance deployments.
  - not shared across instances and resets on process restart.
  - production approach: distributed store (for example Redis).
- `HSTS` is only set when `request.secure === true`:
  - in reverse-proxy deployments, configure Express `trust proxy` so HTTPS is detected correctly.
- `CORS` is allowlist-based and environment-driven:
  - safer than open CORS, but requires strict per-environment origin management.
- `Upload MIME checks` reduce accidental misuse:
  - MIME can still be spoofed, so schema validation remains the primary trust boundary.
- `Input hardening` strips dangerous keys:
  - this is defense-in-depth, not a replacement for route-level validation.
