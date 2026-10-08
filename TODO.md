# Job Discovery Service TODO

Complete these tasks in order. The hints identify the design questions to answer, but intentionally do not provide the implementation.

## TODO 1 - Connect the gRPC client to Candidate Profile Service (done)

**Status:** `CandidateProfileClient` uses `rolefit.candidateprofile.v1`, maps the message to the domain type, applies a deadline, and treats NOT_FOUND as "no profile".

**Goal:** Make `getProfile()` work against the real Candidate Profile Service contract.

**Files:** `src/grpc/candidate-profile.client.ts`, `proto/candidate-profile.proto`, `src/config/env.ts`.

**Hints:** Confirm the package, service, RPC name, field names, address format, deadlines, and error mapping with the owning service. Keep database knowledge out of this client.

## TODO 2 - Connect the gRPC client to Job Posting Service (done)

**Status:** `JobPostingClient` uses `rolefit.jobposting.v1`, strips enum prefixes, pages through OPEN jobs, and maps NOT_FOUND to `JOB_NOT_FOUND`.

**Goal:** Make `getJob()` and `listJobs()` work against the real Job Posting Service contract.

**Files:** `src/grpc/job-posting.client.ts`, `proto/job-posting.proto`, `src/config/env.ts`.

**Hints:** Align request filters and response fields with the source service. Decide how transport failures and unavailable services should be represented at this boundary.

## TODO 3 - Implement `searchJobs()` (done)

**Status:** Filters, routes and response shape match the frontend; results are matched and sorted by score.

**Goal:** Expose useful job search behavior through the Job Posting Service.

**Files:** `src/services/discovery.service.ts`, `src/controllers/discovery.controller.ts`, `src/routes/discovery.routes.ts`.

**Hints:** Define supported query parameters, normalization, pagination, and the API response shape without querying MongoDB from this service.

## TODO 4 - Define the normalized matching representation (done)

**Status:** Domain types mirror the frontend (`src/types/domain.types.ts`); `MatchEvidence` / `MatchResult` in `src/matching/matching.types.ts`.

**Goal:** Establish the stable input and evidence vocabulary used by matching and explanation.

**Files:** `src/types/domain.types.ts`, `src/matching/matching.types.ts`.

**Hints:** Separate source-service DTOs from normalized matching data. Decide how requirements, skills, experience, education, uncertainty, and evidence provenance should be represented.

## TODO 5 - Implement `evaluateJobFit()` (done)

**Status:** Ported from the frontend mock: skills 50 / experience 25 / education 10 / preferences 15. Possible improvements: use skill levels/years, preferred skills, education level and accepted fields, salary preference.

**Goal:** Produce structured match evidence using a deterministic, explainable approach.

**Files:** `src/matching/matcher.ts`, `src/matching/matching.types.ts`, `src/matching/scoring.ts`, `src/services/discovery.service.ts`.

**Hints:** Define the matching rules and scoring policy as a team assignment. Keep the result inspectable through matched requirements, missing requirements, and supporting details. Do not delegate the final score to an LLM.

## TODO 6 - Implement `getRecommendations()` (done)

**Status:** All OPEN jobs are scored and the top `limit` returned. Open question: pre-filter by preferences for large job counts.

**Goal:** Orchestrate candidate retrieval, job listing, fit evaluation, and recommendation ordering.

**Files:** `src/services/discovery.service.ts`, `src/matching/matcher.ts`, `src/matching/scoring.ts`.

**Hints:** Decide how to handle partial upstream failures, empty results, pagination, stable ordering, and the amount of evidence returned to clients.

## TODO 7 - Implement `getMatchResult()` (done)

**Status:** Shares `evaluateJobFit` with the fit route and returns `MatchResult` only.

**Goal:** Return the structured match result for one candidate and one job.

**Files:** `src/services/discovery.service.ts`, `src/controllers/discovery.controller.ts`, `src/matching/matching.types.ts`.

**Hints:** Reuse the same evaluation path as recommendations so the two operations cannot silently use different rules. Define whether the endpoint returns evidence only or a response envelope.

## TODO 8 - Implement `AIModelAdapter.explainMatch()` (deferred)

**Status:** `TemplateExplanationAdapter` writes a fixed-template explanation for now; `UnimplementedAIModelAdapter` is the slot for the LLM provider.

**Goal:** Add natural-language explanation after deterministic evidence has been produced.

**Files:** `src/adapters/ai/ai.types.ts`, `src/adapters/ai/ai.adapter.ts`, `src/services/discovery.service.ts`.

**Hints:** Select a provider and isolate its SDK behind the adapter. Send structured evidence as the source of truth, validate the response, protect secrets, and never allow generated text to replace or alter the score.

## TODO 9 - Add input validation (done)

**Status:** Query, job id and `X-User-Id` validation are in `src/validation/` and `src/middleware/identity.middleware.ts`.

**Goal:** Reject malformed route parameters, query parameters, and request bodies with clear client errors.

**Files:** `src/controllers/discovery.controller.ts`, `src/routes/discovery.routes.ts`, `src/middleware/`.

**Hints:** Choose a validation approach consistent with the course project. Validate IDs, required fields, list sizes, and unsupported values before making gRPC calls.

## TODO 10 - Add error handling (done)

**Status:** `{ error: { code, message, details? } }` envelope with 400/401/404/501/502/503 mapping.

**Goal:** Map upstream, validation, matching, and adapter failures to predictable HTTP responses.

**Files:** `src/app.ts`, `src/middleware/`, `src/grpc/`, `src/services/`.

**Hints:** Preserve useful correlation context in logs, avoid leaking provider or transport details, and distinguish client errors from dependency outages and unimplemented features.

## TODO 11 - Add tests (started)

**Status:** Route, validation/filter, matcher and gRPC contract tests exist.

**Goal:** Protect the service boundaries and future behavior with focused automated tests.

**Files:** `tests/`, `src/`.

**Hints:** Start with health and route wiring, then mock gRPC collaborators for service tests. Add contract tests for proto compatibility and deterministic tests for whatever matching rules the team chooses.
