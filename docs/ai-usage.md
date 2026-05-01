# AI Usage

This project was built with heavy AI assistance, but the final direction, trade-offs, and acceptance criteria were still driven by me.

I used AI as a drafting and exploration tool across the project, then modified the output to match the assessment goals: adaptability, validation safety, operator clarity, and demo reliability.

## Usage Path

The AI-assisted path across the project was:

1. initialize a full-stack TypeScript workspace
2. connect frontend and backend
3. implement single import and batch import first
4. explore routing-engine structure
5. choose validated CRUD-style rule management instead of a heavier strategy-pattern approach
6. add analytics, alerts, seed support, and logs
7. add the mega-batch API for large technical imports
8. tighten tests, security, and UX details

## Prompts, Changes, and Reasons

### Project Setup

**Prompt:**
"Create a full-stack TypeScript project for a parcel-routing technical assessment using a React frontend and an Express backend. Keep the structure simple, split frontend and backend clearly, and make sure local development and testing are easy to run."

**Why:**
I wanted a practical starting point that reduced setup time and let me focus quickly on routing logic, validation, and the operator workflows.

**What:**
I kept a split `frontend` and `backend` workspace, then tailored the scripts, folder layout, and project structure to better fit the assessment.

### Frontend and Backend Connection

**Prompt:**
"Connect the React frontend to the Express API with a small typed request helper, support JSON requests cleanly, and keep the integration simple enough for login, validation, routing, search, and admin config flows."

**Why:**
I wanted fewer integration mismatches, easier tracing across requests, and a lightweight API layer that would not hide backend behavior.

**What:**
I simplified the API helper, added a session id header for tracing, and aligned response shapes to the backend routes.

### Single and Batch Import

**Prompt:**
"Implement single parcel import using JSON input and batch parcel import using uploaded JSON files. Add validation before routing, return clear errors, and keep the flow understandable for non-technical operators."

**Why:**
The assessment emphasizes correctness, safety, and operator clarity, so import actions should not proceed until validation succeeds.

**What:**
I separated validation from import, blocked import until validation passed, and made the UI reflect that validation-first workflow.

### Routing Engine Exploration

**Prompt:**
"Design a parcel routing engine that can evolve with changing business rules. Support approval rules, routing rules, priorities, and future extensibility without making the core routing flow hard to change."

**Why:**
I needed a design that was flexible enough for future departments and conditions, but still small enough to explain and modify live.

**What:**
I replaced a heavier strategy-style direction with data-driven rules, explicit priorities, and a condition engine that keeps changes localized.

### Rule Management UI

**Prompt:**
"Add an admin workflow for managing approval and routing rules from the UI. Support create, update, delete, validation before apply, and make the rule data easy to inspect."

**Why:**
I wanted admins to change behavior safely without editing code directly, and I wanted those changes to be visible and auditable.

**What:**
I kept CRUD-style management, added validation-before-apply, preserved rule metadata, and improved the config tables and modal flow.

### Alerts and Logging

**Prompt:**
"Add operational visibility for parcel imports, validation failures, config changes, and unusual activity. Keep the implementation lightweight but useful for investigation during a demo."

**Why:**
The system needed enough observability to explain what went wrong, who triggered it, and how issues could be investigated afterward.

**What:**
I mapped alerts to backend events and kept logging simple with CSV files plus structured console output.

### Mega-Batch API

**Prompt:**
"Add a technical API for very large parcel batch processing. It should stay responsive, be safer than the normal UI path for oversized inputs, and return results in a form that is easy to inspect programmatically."

**Why:**
I wanted a large-file path that would not overload the normal browser workflow and could still be demonstrated clearly.

**What:**
I protected the endpoint with an API key, returned CSV output, and added tests for invalid keys, validation failure, and successful processing.

### UX Refinement

**Prompt:**
"Improve the dashboard UX for operators working with tables, validation results, config rules, alerts, and repeated import actions. Keep the design modern, clear, and practical without relying on Figma assets."

**Why:**
The app is table-heavy and workflow-heavy, so clarity and ease of use mattered more than visual complexity.

**What:**
I moved navigation to the top, kept tables prominent, used modal-based flows with `Esc` support, and kept the visual language consistent.

### Testing

**Prompt:**
"Add regression tests for routing, config validation, upload flows, and large-batch behavior. Include negative cases so bad files, bad payloads, and unsafe changes are caught early."

**Why:**
I wanted tests that protect behavior during refactoring and that give confidence when extending routing logic or import flows.

**What:**
I focused tests on system behavior, including negative paths and integration scenarios rather than implementation details.

## What I changed consistently

Across AI-generated output, I repeatedly made the following adjustments:

- simplified over-engineered abstractions
- aligned naming to the parcel-routing domain
- added validation before mutation
- kept error responses clear for operators
- added tests around failure cases
- removed or avoided claims the code did not actually support

## Why AI helped here

AI was especially useful for:

- speeding up repetitive scaffolding
- generating initial route and UI structures
- exploring alternative designs quickly
- brainstorming alerting and UX ideas
- drafting tests and documentation

## Limitations of AI in this project

- AI can over-engineer patterns that are harder to justify in an interview
- AI can introduce claims that drift away from the actual code if not reviewed carefully
- AI suggestions can become too narrow or too opinionated, so I did not treat them as the only valid implementation path
- long conversations can accumulate context overhead and make later sessions slower to work through
- reverting or comparing multiple generated directions is not always as smooth as working from a normal Git-based branch flow
- AI helped with UI ideas, but without Figma designs or strong visual references, frontend decisions still required manual iteration and judgment
- AI is good at producing a first draft, but not good enough to be trusted as the final source of truth

That is why I reviewed the generated work manually, changed the architecture direction when needed, and kept the final implementation aligned with the assignment rather than with the first generated answer.
