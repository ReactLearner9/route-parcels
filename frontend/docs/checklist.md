# Checklist

Use this as a quick self-review before the interview and demo.

## Backend Functionality

- [x] Single parcel upload works through `POST /api/upload/single`
- [x] Batch upload works through `POST /api/upload/batch`
- [x] Uploaded parcel payloads are validated with Zod before routing
- [x] Routing result is persisted in lowdb
- [x] Batch records are stored with file IDs and parcel IDs
- [x] Single parcel records are stored with file IDs and parcel IDs
- [x] Config upload works through `POST /api/config/validate`
- [x] Config apply works through `POST /api/config/apply`
- [x] Config versions are stored in lowdb
- [x] Active config version can be inspected
- [x] New departments can be introduced by config
- [x] New approvals can be introduced by config

## Routing Rules

- [x] Weight-based routing behaves correctly
- [x] Value-based approval behaves correctly
- [x] Optional parcel fields are supported
- [x] Missing optional fields fail safely
- [x] Rule conflicts are detected clearly
- [x] Duplicate route priorities are rejected
- [x] Duplicate logic rules are rejected

## Testing

- [x] Routing logic has unit coverage
- [x] Upload routes have integration coverage
- [x] Config validation has regression coverage
- [x] Invalid payloads return expected errors
- [x] Batch file parsing failures return expected errors
- [x] Tests are separated by responsibility and easy to read

## Reliability

- [x] Errors are logged with enough context to debug
- [x] Failures return meaningful HTTP statuses
- [x] Requests do not silently route to an unknown destination
- [x] Persistence writes are deterministic and versioned
- [x] Config changes are auditable in lowdb

## Monitoring

- [x] Logs include parcel IDs
- [x] Logs include batch file IDs
- [x] Logs include route decisions
- [x] Logs include validation or parsing failures
- [x] Lowdb stores audit rows for upload, validation, routing, and config update steps
- [x] Audit rows can be traced by `fileId` across the parcel lifecycle

## Security

- [ ] Admin config endpoints are protected or clearly scoped
- [x] File uploads are size-limited
- [x] Uploaded content is validated before use
- [x] JSON bodies are accepted only where intended
- [x] Multipart uploads are used only for files
- [x] Batch files reject invalid JSON cleanly
- [x] Error responses do not leak sensitive internals

## UX and API Design

- [x] Endpoints are simple for operators to use
- [x] Validation responses are clear
- [x] Apply responses include version numbers
- [x] Upload responses include traceable IDs
- [x] Audit data can support a future history screen
- [ ] The batch upload contract is documented

## AI Usage

- [ ] Prompts used with AI are documented
- [ ] AI-generated code was reviewed and understood
- [ ] Modifications made after AI output are explained
- [ ] Limitations of AI in the project are documented

## Interview Demo

- [x] I can explain why JSON was chosen for config and batch files
- [x] I can explain how new rules are added safely
- [x] I can show a new department or approval from config
- [x] I can explain a conflict example end to end
- [x] I can explain how failures are handled
- [x] I can explain how versioning works
- [x] I can explain how uploads are persisted and logged
- [x] I can explain the lowdb audit trail and why it replaces metrics in this build

## Final Readiness

- [ ] README is up to date
- [x] Conflict examples are documented
- [x] AI usage document is current
- [x] Tests pass locally
- [ ] Demo steps are rehearsed
