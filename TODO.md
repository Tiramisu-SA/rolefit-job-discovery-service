# Job Discovery Service TODO

Complete these tasks in order. The hints identify the design questions to answer, but intentionally do not provide the implementation.

## TODO 1 - Connect the gRPC client to Candidate Profile Service

**Goal:** Make `getProfile()` work against the real Candidate Profile Service contract.

**Files:** `src/grpc/candidate-profile.client.ts`, `proto/candidate-profile.proto`, `src/config/env.ts`.

**Hints:** Confirm the package, service, RPC name, field names, address format, deadlines, and error mapping with the owning service. Keep database knowledge out of this client.

## TODO 2 - Connect the gRPC client to Job Posting Service

**Goal:** Make `getJob()` and `listJobs()` work against the real Job Posting Service contract.

**Files:** `src/grpc/job-posting.client.ts`, `proto/job-posting.proto`, `src/config/env.ts`.

**Hints:** Align request filters and response fields with the source service. Decide how transport failures and unavailable services should be represented at this boundary.

## TODO 3 - Implement `searchJobs()`

**Goal:** Expose useful job search behavior through the Job Posting Service.

**Files:** `src/services/discovery.service.ts`, `src/controllers/discovery.controller.ts`, `src/routes/discovery.routes.ts`.

**Hints:** Define supported query parameters, normalization, pagination, and the API response shape without querying MongoDB from this service.

## TODO 4 - Define the normalized matching representation

**Goal:** Establish the stable input and evidence vocabulary used by matching and explanation.

**Files:** `src/types/domain.types.ts`, `src/matching/matching.types.ts`.

**Hints:** Separate source-service DTOs from normalized matching data. Decide how requirements, skills, experience, education, uncertainty, and evidence provenance should be represented.

## TODO 5 - Implement `evaluateJobFit()`

**Goal:** Produce structured match evidence using a deterministic, explainable approach.

**Files:** `src/matching/matcher.ts`, `src/matching/matching.types.ts`, `src/matching/scoring.ts`, `src/services/discovery.service.ts`.

**Hints:** Define the matching rules and scoring policy as a team assignment. Keep the result inspectable through matched requirements, missing requirements, and supporting details. Do not delegate the final score to an LLM.

## TODO 6 - Implement `getRecommendations()`

**Goal:** Orchestrate candidate retrieval, job listing, fit evaluation, and recommendation ordering.

**Files:** `src/services/discovery.service.ts`, `src/matching/matcher.ts`, `src/matching/scoring.ts`.

**Hints:** Decide how to handle partial upstream failures, empty results, pagination, stable ordering, and the amount of evidence returned to clients.

## TODO 7 - Implement `getMatchResult()`

**Goal:** Return the structured match result for one candidate and one job.

**Files:** `src/services/discovery.service.ts`, `src/controllers/discovery.controller.ts`, `src/matching/matching.types.ts`.

**Hints:** Reuse the same evaluation path as recommendations so the two operations cannot silently use different rules. Define whether the endpoint returns evidence only or a response envelope.

## TODO 8 - Implement `AIModelAdapter.explainMatch()`

**Goal:** Add natural-language explanation after deterministic evidence has been produced.

**Files:** `src/adapters/ai/ai.types.ts`, `src/adapters/ai/ai.adapter.ts`, `src/services/discovery.service.ts`.

**Hints:** Select a provider and isolate its SDK behind the adapter. Send structured evidence as the source of truth, validate the response, protect secrets, and never allow generated text to replace or alter the score.

## TODO 9 - Add input validation

**Goal:** Reject malformed route parameters, query parameters, and request bodies with clear client errors.

**Files:** `src/controllers/discovery.controller.ts`, `src/routes/discovery.routes.ts`, `src/middleware/`.

**Hints:** Choose a validation approach consistent with the course project. Validate IDs, required fields, list sizes, and unsupported values before making gRPC calls.

## TODO 10 - Add error handling

**Goal:** Map upstream, validation, matching, and adapter failures to predictable HTTP responses.

**Files:** `src/app.ts`, `src/middleware/`, `src/grpc/`, `src/services/`.

**Hints:** Preserve useful correlation context in logs, avoid leaking provider or transport details, and distinguish client errors from dependency outages and unimplemented features.

## TODO 11 - Add tests

**Goal:** Protect the service boundaries and future behavior with focused automated tests.

**Files:** `tests/`, `src/`.

**Hints:** Start with health and route wiring, then mock gRPC collaborators for service tests. Add contract tests for proto compatibility and deterministic tests for whatever matching rules the team chooses.
