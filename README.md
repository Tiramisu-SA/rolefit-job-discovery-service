# RoleFit Job Discovery Service

Architecture scaffold for the RoleFit Job Discovery Service. This service owns discovery and future fit orchestration, but it does not own candidate or job persistence.

## Responsibilities

- Search jobs through the Job Posting Service.
- Orchestrate future recommendations.
- Define the boundary for deterministic job-fit evaluation.
- Combine future structured match evidence with an AI-generated explanation.

The service does not connect to PostgreSQL or MongoDB. Candidate data comes from the Candidate Profile Service over gRPC, and job data comes from the Job Posting Service over gRPC. The AI model is represented by an internal adapter interface; until a provider is connected, a deterministic template writes the explanation.

## API

Full reference with parameters, examples, types and error codes: **[api.md](api.md)**.

| Method | Path | Returns |
| --- | --- | --- |
| `GET` | `/health` | Service status |
| `GET` | `/api/jobs/search` | Open jobs matching the filters, best match first |
| `GET` | `/api/recommendations?limit=6` | The best-matching open jobs |
| `GET` | `/api/jobs/:jobId/fit` | One job with its full match and explanation |
| `GET` | `/api/jobs/:jobId/match` | Only the match for one job |

Every `/api` route needs an `X-User-Id` header (a UUID; mock auth). The frontend calls these routes from `src/lib/api/job-discovery.ts`.

## Matching

`src/matching/` is deterministic. It was moved here from the frontend's former in-browser mock, so scores stayed the same when the frontend switched to this service:

- **Skills (50%)**: share of the job's required skills the candidate lists (by name, ignoring case); no required skills = 100.
- **Experience (25%)**: `totalExperienceMonths / 12` against `minimumExperienceYears`, capped at 100.
- **Education (10%)**: any education = 100, none = 50.
- **Preferences (15%)**: work arrangement 40 + location (province, or any if remote) 30 + employment type 30; no preferences = 0.

The explanation comes from `TemplateExplanationAdapter`, a fixed text template over the evidence. An LLM-backed adapter (TODO 8) can replace it behind the same `AIModelAdapter` interface; it may describe the score but never change it.

## Development

```sh
npm install
cp .env.example .env
npm run build
npm start
```

For watch mode:

```sh
npm run dev
```

Tests (`tsx --test`; the gRPC contract tests start fake upstream servers from `proto/`):

```sh
npm test
```

`AI_PROVIDER_API_KEY` is optional in this template. No AI SDK or database dependency is installed.

## Configuration

- `PORT`: HTTP port, default `3002` (3000 is the frontend, 3001 the Candidate Profile REST API).
- `CORS_ORIGIN`: web frontend origin, default `http://localhost:3000`.
- `CANDIDATE_PROFILE_GRPC_URL`: Candidate Profile Service address, default `localhost:50051`.
- `JOB_POSTING_GRPC_URL`: Job Posting Service address, default `localhost:50052`.
- `GRPC_DEADLINE_MS`: deadline for each upstream call, default `5000`.
- `AI_PROVIDER_API_KEY`: reserved for a future adapter implementation; not required to start.

## Architecture Notes

The `.proto` files in `proto/` are verbatim copies of the owning services' contracts (`rolefit.candidateprofile.v1`, `rolefit.jobposting.v1`). Re-copy them when those services change them; `tests/grpc.contract.test.ts` catches drift in the fields this service reads. `src/matching/` holds the deterministic matcher and scoring policy. `src/adapters/ai/` contains the internal adapter boundary; an LLM must eventually explain evidence, never determine the final score.
