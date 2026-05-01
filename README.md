# Route Parcels

Production-minded parcel routing assessment built with React, Express, and TypeScript.

The application lets operators validate and route single parcels and JSON batch files, lets admins manage approval and routing rules through the UI, and provides search, alerts, logs, seed actions, and a technical mega-batch API for large-file processing.

## Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Architecture Decisions](#architecture-decisions)
- [Routing and Config Approach](#routing-and-config-approach)
- [Why JSON Instead of XML](#why-json-instead-of-xml)
- [Monitoring and Reliability](#monitoring-and-reliability)
- [Security](#security)
- [Testing and Quality Assurance](#testing-and-quality-assurance)
- [Extending the System](#extending-the-system)
- [Feature Development Example](#feature-development-example)
- [Trade-offs](#trade-offs)
- [AI Usage](#ai-usage)
- [Extensions](#extensions)
- [Project Structure](#project-structure)
- [Run Locally](#run-locally)

## Overview

This project answers the parcel-routing assessment with a validation-first workflow:

- operators can validate parcel data before any import happens
- admins can validate rule changes before they are applied
- routing remains adaptable by treating rules as managed data
- failures generate logs and alerts so the system is easier to investigate

The app is intentionally demo-friendly in some areas, but the code structure, tests, and operational safeguards are designed to show how the system could evolve safely.

## Key Features

- Role-aware UI with separate admin and operator workflows
- Single parcel import using JSON input
- Batch parcel import using JSON files
- Batch validation table that shows all invalid rows before import is allowed
- Rule management UI for creating, validating, updating, and deleting approval and routing rules
- Parcel and batch analytics search by `parcelId` or `batchId`
- Seed actions for quickly resetting demo parcel data or config data
- Alerts center for operational issues and config change notices
- Structured audit and exception logs written as CSV files
- Technical mega-batch API that returns CSV output for very large payload handling
- Automated backend tests around the routing and import workflows

## Architecture Decisions

### Stack

- `React` was chosen for reusable UI components and fast iteration on operator workflows.
- `Vite` was chosen for a lightweight frontend dev/build setup.
- `Express` was chosen for a small, explicit backend with low ceremony.
- `TypeScript` is used end-to-end for safer refactoring and stronger contracts between UI and API.
- `Zod` is used for runtime validation of environment values, auth payloads, parcel payloads, and config payloads.
- `LowDB` was chosen to keep the submission demo-friendly while still giving persistence across runs.
- `Pino` and `pino-pretty` were chosen for structured backend logging with readable local output.
- `Vitest` and `Supertest` were chosen for fast automated regression tests.
- `Tailwind CSS`, `sonner`, `lucide-react`, and shadcn-style UI primitives were used to build the frontend quickly without introducing a heavy design framework.

### Frontend decisions

- I did not use React Router because the application has a very small number of top-level views and browser-state navigation was enough for this scope.
- I did not use Next.js because the app is dashboard-heavy, does not need SSR or SEO to succeed, and Vite keeps the setup smaller for an interview project.
- I did not use React Hook Form because the current forms are relatively small and local state kept the flows easier to reason about during rapid iteration.

### Backend decisions

- I kept routing logic in code and rule data in managed config records, rather than pushing business rules into environment variables.
- I used a data-oriented, validation-first design instead of a heavier OO strategy-pattern design.
  The rule engine itself is close to functional style with small evaluation helpers, while the route/service layer uses straightforward imperative orchestration.
- I used LowDB for simplicity, but designed the routes and service layer so a future move to SQLite or Postgres would stay localized.

### Configuration system

Operational configuration is intentionally lightweight:

- environment-driven `PORT`
- environment-driven `CORS_ORIGINS`

Business routing behavior is managed through validated rule data rather than environment variables. That keeps operational settings configurable while keeping domain rules safer and more explicit.

## Routing and Config Approach

The system separates two concerns:

- parcel validation and routing logic
- rule management and safe rule evolution

Routing rules and approval rules are managed through the UI and backend config endpoints. Before a rule set is applied, it is validated for schema correctness and rule-shape safety. A fallback route remains in place so parcels do not disappear into an unroutable state.

Current rule capabilities include:

- approval rules
- routing rules with priority
- nested field conditions
- extensible operators in the condition engine

This design keeps day-to-day rule changes out of the core routing code while still preserving validation and auditability.

## Why JSON Instead of XML

I chose `JSON` for batch upload instead of XML.

Reasons:

- the frontend and backend are already TypeScript-based, so JSON maps naturally to the application data model
- parsing and validating JSON with Zod is simpler and less error-prone for this scope
- operators can review and edit JSON payloads more easily in modern tooling
- JSON keeps the validation-first flow smaller and easier to explain live

For this assessment, JSON reduced accidental complexity and let me focus on routing safety, rule validation, and operator feedback.

## Monitoring and Reliability

The app includes several reliability and observability features:

- audit logs for single import, batch import, config actions, and seed actions
- exception logs for request failures
- alert logs for alert creation and alert resolution
- alerts UI for unread operational issues
- analytics search for looking up routed parcels and batches
- health endpoint at `/api/health`
- validation-before-apply workflow for both parcel imports and config changes
- fallback route to `MANUAL_REVIEW` when no route matches

### Logging

CSV log files are written under `data/logs/` so actions are easy to inspect during a demo:

- `single-import`
- `batch-import`
- `config`
- `alerts`
- `exceptions`

This is intentionally simple, but it gives enough visibility to investigate what happened, who did it, and which session triggered it.

### Alerts

The system can raise alerts for patterns such as:

- repeated validation-failed uploads
- repeated batch import failures
- repeated invalid mega API key attempts
- config changes

Admins and operators can review alerts in the UI and mark them as read one-by-one.

### User notifications

The frontend uses toast notifications to give operators immediate feedback:

- Welcome message:
  Shown after successful login or registration to confirm the user has entered the workspace.
- Pending alerts warning:
  Shown when unread alerts exist while the dashboard is open so operational issues are visible without forcing a screen change.
- Validation success:
  Shown after single, batch, or config validation passes to confirm the user can safely continue.
- Validation failure:
  Shown after single or batch validation fails to make it clear the data must be fixed before import continues.
- Import success:
  Shown after single or batch routing completes to confirm processing succeeded.
- Config apply success:
  Shown after validated config is applied to confirm the rule change is now active.
- Rule delete success:
  Shown after a config rule is deleted to confirm persistence succeeded.
- Seed success:
  Shown after a seed action completes to confirm demo parcel or config data was reset.
- Alert read success:
  Shown after marking an alert as read to confirm it was removed from the unread list.
- Action failure:
  Shown when an API call or UI action fails so the user gets immediate feedback without checking developer tools.

### Backend alerts

The backend generates alerts for repeated or meaningful operational events:

- Repeated Batch Import Failures:
  Triggered when batch or mega imports fail `5` times in `10` minutes. This helps detect unstable import flows or malformed repeated submissions.
- Repeated Validation Failed Uploads:
  Triggered when validation-failed batch or mega uploads reach `10` times in `10` minutes. This helps surface unusual operator friction or bad upstream data quality.
- Repeated Invalid Mega API Key Attempts:
  Triggered when invalid mega API key attempts reach `5` times in `10` minutes. This helps detect misuse or probing of the technical large-file endpoint.
- Repeated Single Import Failures:
  Triggered when single import failures reach `100` times in `5` minutes. This helps detect broken client behavior or abuse on the single-import path.
- Approval Rule Added or Updated:
  Triggered when approval config changes are applied so important rule changes remain operationally visible.
- Routing Rule Added or Updated:
  Triggered when routing config changes are applied so route behavior changes remain visible.

### Mega API

The mega-batch path is a technical API intended for large payload processing. It accepts a large JSON batch file and returns a CSV report rather than trying to render every row in the regular browser workflow. That is a deliberate reliability trade-off for this project.

## Security

Implemented security measures include:

- rate limiting on general API traffic and stricter rate limiting on auth routes
- CORS allowlist enforcement
- secure response headers
- JSON-only upload filtering for batch and config files
- custom recursive input sanitization to strip dangerous keys
- validation of request payloads with Zod
- simple role distinction between admins and operators

Additional detail is documented in [docs/security.md](docs/security.md).

Extra security work I would add for a real public deployment:

- stronger password hashing such as `argon2` or `bcrypt`
- authenticated sessions or JWTs with proper authorization middleware
- secret management for API keys and environment values through Azure Key Vault
- TLS certificates and HTTPS-only deployment
- centralized logging and alerting through Azure Monitor and Application Insights

## Testing and Quality Assurance

### Automated tests

The backend test suite covers:

- health endpoint behavior
- rule-aware parcel validation
- routing and approval accumulation
- config validation and config apply flows
- upload flows for single, batch, and mega-batch routes
- negative cases such as invalid payloads, invalid JSON, missing files, and invalid API keys

### Regression protection

The tests are designed around system behavior, especially:

- rule changes that affect routing or approval outcomes
- validation and import flows that could accidentally allow bad data through

### Full app testing performed

To validate the application more completely, I used a mix of automated and manual verification:

- backend route tests for health, routing, config validation, upload flows, and mega-batch behavior
- backend negative-path tests for invalid JSON, invalid payloads, missing files, and invalid API keys
- core logic tests for rule evaluation and parcel validation behavior
- manual operator-flow testing for single import, batch validation, batch import, analytics search, and alert review
- manual admin-flow testing for config validation, config apply, and seed operations
- seeded demo data for repeatable walkthroughs
- manual log inspection in `data/logs/` to verify audit and exception visibility

## Extending the System

### Add a new routing rule through the existing system

1. Open the admin config screen.
2. Create a new routing rule with a `priority`, `when`, and `department`.
3. Validate the draft rule set.
4. Apply it only if validation passes.
5. Re-run the relevant automated tests or add a new one if the behavior is novel.

This works today for many changes because routing behavior is already data-driven.

### Add a new conditional operator in code

To extend the condition engine, the change stays localized:

1. Add the operator implementation in `backend/src/core/operators.ts`.
2. Add the operator name to the schema in `backend/src/core/config-types.ts`.
3. Verify the condition engine can resolve and execute it in `backend/src/core/condition-engine.ts`.
4. Add tests for both matching and non-matching cases.

Example idea:

```ts
contains: (actual, expected) => {
  return typeof actual === "string" &&
    typeof expected === "string" &&
    actual.includes(expected);
};
```

After that, a rule could use a condition such as:

```json
{
  "type": "route",
  "priority": 8,
  "when": { "field": "destinationCountry", "operator": "contains", "value": "DE" },
  "action": { "department": "EU_DESK" }
}
```

This is one of the main adaptability points in the design because new conditional behavior does not require rewriting the routing flow itself.

## Feature Development Example

Example: `mega-batch API`

### Problem

Regular UI-driven batch import is suitable for operator workflows, but very large files need a more technical path that avoids turning the browser into the bottleneck.

### Branch-to-merge flow

1. Create the branch `feature/mega-batch-import`.
2. Add a dedicated backend endpoint for large-file processing.
3. Protect it with a separate API key and large upload limit.
4. Return CSV output so failures and results are easier to consume programmatically.
5. Add tests for invalid API keys, validation-failed imports, and successful processing.
6. Review the trade-off: the endpoint is more technical than the main UI flow, but it isolates the large-file path cleanly.
7. Merge `feature/mega-batch-import` back into `main` once tests pass and the behavior is documented.

### Why this is a good example

It shows engineering judgment rather than just UI work:

- adapting the system to a new operational need
- protecting the normal UI flow from an oversized use case
- adding reliability and traceability through CSV output and alerts

## Trade-offs

- `LowDB` keeps the app demo-friendly and easy to reset, but it is not the long-term storage choice for a public internet deployment.
- There is no config version history yet, so applied rule changes are auditable but not fully versioned.
- Rule conditions currently model a single `when` clause per rule rather than full boolean groups like nested `AND` and `OR`.
- There is no change-password flow yet.
- Pagination is client-side over in-memory results rather than server-side.
- Authentication uses simple login and register forms rather than OAuth or enterprise SSO.
- Input sanitization uses custom code instead of a dedicated library to keep the dependency footprint small for the demo.
- Alerts are marked as read one at a time; bulk actions are intentionally not implemented yet.
- The mega-batch path is technical and API-oriented. With Azure-native background processing and more durable cloud storage from the start, I would provide a more operator-friendly large-file upload experience in the UI.
- I moved away from a strategy-pattern-heavy OO model because it increased code overhead for this scope. The current data-driven approach is easier to validate, explain, and evolve in the interview.
- Imported parcels cannot be deleted or manually moved to a pending status through the UI today; state changes come from routing rules and processing outcomes.

### Short sanitization snippet

This is the small custom hardening layer used before route handlers continue:

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

Full implementation: `backend/src/middleware/input-hardening.ts`

## AI Usage

AI was used as a development accelerator, not as a substitute for design ownership.

I used AI heavily for:

- project setup
- backend/frontend integration
- exploring routing-engine designs
- UI iteration
- mega-batch workflow design
- alert and logging ideas
- testing support

I still made the architecture decisions, selected the final direction, and edited generated output to fit the project goals.

Detailed prompts, modifications, and rationale are documented in [docs/ai-usage.md](docs/ai-usage.md).

## Extensions

Possible next extensions include:

- Microsoft Entra ID based authentication to replace the simple login flow and support stronger identity management
- stronger RBAC and route authorization so admin-only actions are enforced server-side rather than mostly by UI flow
- Azure SQL or Azure Cosmos DB instead of LowDB for better durability, querying, and concurrency
- background processing with Azure Functions and Azure Service Bus for large imports and asynchronous operational work
- server-side pagination for analytics and alerts once record volume grows beyond comfortable in-memory browsing
- React Router if the number of application views grows and deep linking becomes more important
- Azure Cache for Redis or application-level caching for analytics-heavy endpoints
- Azure-based deployment with managed secrets, object storage, monitoring, and scheduled jobs

## Project Structure

- `backend/` Express + TypeScript API
- `frontend/` React + Vite UI
- `docs/` assessment documentation, AI usage notes, and security notes
- `scripts/` local development helper scripts

## Run Locally

### Install

```bash
npm install
```

### Start both apps

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Test

```bash
npm test
```
