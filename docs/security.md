# Security Notes

This project is a demo submission, but it still includes several practical protections for a public-internet-facing application.

## Security Measures Implemented

### Response hardening

The backend sets a baseline of security-related headers, including:

- `X-Frame-Options`
- `X-Content-Type-Options`
- `Referrer-Policy`
- `Permissions-Policy`
- `Cross-Origin-Opener-Policy`
- `Cross-Origin-Resource-Policy`
- `Content-Security-Policy`
- `Strict-Transport-Security` when the request is secure

This reduces clickjacking, framing, MIME confusion, and some browser-side attack surface.

### CORS allowlist

Browser origins are restricted through `CORS_ORIGINS` rather than leaving CORS open. That reduces the risk of arbitrary websites making authenticated browser requests to the backend.

### Rate limiting

The app applies:

- a general API limiter
- a stricter auth limiter

This is a lightweight defense against brute-force login attempts and basic abuse.

### Input validation

The project validates:

- auth payloads
- parcel payloads
- config payloads
- environment values

That helps fail fast on malformed input rather than letting invalid data move deeper into the system.

### Input sanitization

I intentionally kept sanitization simple and dependency-light for the demo by stripping dangerous keys recursively:

```ts
const blockedKeys = new Set(["__proto__", "prototype", "constructor"]);

function sanitize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitize);
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !blockedKeys.has(key))
        .map(([key, inner]) => [key, sanitize(inner)]),
    );
  }
  return value;
}
```

Reference: `backend/src/middleware/input-hardening.ts`

This is not a full security library replacement, but it is a useful defense-in-depth layer against prototype-pollution-style payloads.

### Upload restrictions

Batch and config uploads are restricted to JSON MIME types and size-limited by Multer. That reduces accidental misuse and narrows the input surface.

### Validation-first workflows

The UI and backend both enforce validation before:

- parcel import
- config application

This is partly a correctness feature, but it also reduces operational mistakes and unsafe state changes.

## Known Limits

- Rate limiting is in-memory, so it is not shared across multiple instances.
- Authentication is simple and should be strengthened for real deployment.
- Password hashing should be upgraded to a dedicated password-hashing algorithm such as `argon2` or `bcrypt`.
- The mega-batch API key should be moved to secret management and rotated operationally.
- Audit and exception logs are local files rather than centralized immutable log sinks.

## Additional Measures I Would Implement

### Authentication and authorization

- session or JWT-based authentication
- route-level authorization middleware
- stronger RBAC for admin-only actions
- password reset and change-password flows
- optional OAuth or SSO

### Secrets and infrastructure

- environment secret management
- API key rotation
- TLS certificates
- secure cookie settings and HTTPS-only deployment

### Observability and response

- centralized logs with Azure Monitor and Application Insights
- alert delivery through Azure Monitor action groups using email or webhook integrations
- request correlation across services

### Data and abuse protection

- stronger upload scanning and content validation
- database-backed persistence with transaction support
- background jobs for large-file processing

## Why these choices are reasonable for this assessment

The goal of this submission is to show secure engineering judgment, not to fully recreate enterprise infrastructure. I therefore implemented practical baseline controls in code now, and I clearly identify which protections would be the first upgrades in a real deployment.
