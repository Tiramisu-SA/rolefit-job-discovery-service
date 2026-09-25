# RoleFit Job Discovery Service

Architecture scaffold for the RoleFit Job Discovery Service. This service owns discovery and future fit orchestration, but it does not own candidate or job persistence.

## Responsibilities

- Search jobs through the Job Posting Service.
- Orchestrate future recommendations.
- Define the boundary for deterministic job-fit evaluation.
- Combine future structured match evidence with an AI-generated explanation.

The service does not connect to PostgreSQL or MongoDB. Candidate data comes from the Candidate Profile Service over gRPC, and job data comes from the Job Posting Service over gRPC. The AI model is represented by an internal adapter interface and is not connected to a provider.

## API

- `GET /health`
- `GET /api/jobs/search?query=typescript&skills=node,sql`
- `GET /api/recommendations?candidateId=<candidate-id>`
- `POST /api/job-fit/evaluate` with `{ "candidateId": "...", "jobId": "..." }`
- `GET /api/job-fit/:candidateId/:jobId`

The discovery operations that require matching or upstream services intentionally return a not-implemented or upstream error until the TODOs are completed.

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

`AI_PROVIDER_API_KEY` is optional in this template. No AI SDK or database dependency is installed.

## Configuration

- `PORT`: HTTP port, default `3000`.
- `CANDIDATE_PROFILE_GRPC_URL`: Candidate Profile Service address, default `localhost:50051`.
- `JOB_POSTING_GRPC_URL`: Job Posting Service address, default `localhost:50052`.
- `AI_PROVIDER_API_KEY`: reserved for a future adapter implementation; not required to start.

## Architecture Notes

The `.proto` files in `proto/` are local contract placeholders used by the gRPC clients. They describe the calls this service needs without embedding either collaborator's database details. `src/matching/` contains types and explicit placeholders for the deterministic matching design. `src/adapters/ai/` contains the internal adapter boundary; an LLM must eventually explain evidence, never determine the final score.
