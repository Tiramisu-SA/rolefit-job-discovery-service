# Job Discovery Service API

REST/JSON API for job search, recommendations and job-fit matching. The web frontend calls it from the browser (`rolefit-frontend/src/lib/api/job-discovery.ts`).

- **Base URL (local):** `http://localhost:3002`
- **Content type:** every response is JSON.
- **Upstream data:** the service stores nothing itself. For each request it reads the seeker's profile from the Candidate Profile Service and the jobs from the Job Posting Service, both over gRPC.

## Endpoints

| Method | Path | Returns |
| --- | --- | --- |
| `GET` | [`/health`](#get-health) | Service status |
| `GET` | [`/api/jobs/search`](#get-apijobssearch) | Open jobs matching the filters, each with a match, best match first |
| `GET` | [`/api/recommendations`](#get-apirecommendations) | The best-matching open jobs |
| `GET` | [`/api/jobs/:jobId/fit`](#get-apijobsjobidfit) | One job with its full match and explanation |
| `GET` | [`/api/jobs/:jobId/match`](#get-apijobsjobidmatch) | Only the match for one job |

## Identity

Every `/api/*` request must send the seeker's user id:

```http
X-User-Id: 11111111-1111-4111-8111-111111111111
```

- It must be a UUID. It is also the seeker's candidate profile id.
- This is **mock auth**, the same header the frontend sends to the Candidate Profile Service. Real authentication will replace it.
- If the header is missing or isn't a UUID, the response is `401 UNAUTHENTICATED`.
- A seeker who hasn't created a profile yet is **not** an error. They are matched as an empty profile, so scores are low and every required skill is listed as missing.

## CORS

Browser requests are allowed from one origin, set by `CORS_ORIGIN` (default `http://localhost:3000`). Preflight `OPTIONS` requests return `204` and allow `GET` with the `Content-Type` and `X-User-Id` headers.

---

## `GET /health`

No identity needed.

```json
{ "status": "ok", "service": "job-discovery-service" }
```

## `GET /api/jobs/search`

Returns **OPEN** jobs that pass every given filter, each with a [`match`](#match-result). Results are sorted by `match.score`, highest first. Jobs with the same score stay newest-published first.

All query parameters are optional. A list parameter is comma-separated and may contain at most 10 values. Each parameter may appear only once.

| Parameter | Type | Filter |
| --- | --- | --- |
| `query` | text, ≤ 200 chars | Job title or a required skill name contains this text, ignoring case. The Job Posting Service applies it. |
| `location` | text, ≤ 200 chars | `district, province, country` contains this text, ignoring case. `remote` also matches every `REMOTE` job. |
| `employmentTypes` | list of `FULL_TIME`, `PART_TIME`, `INTERNSHIP`, `CONTRACT` | Job's employment type is one of these. |
| `arrangements` | list of `ONSITE`, `HYBRID`, `REMOTE` | Job's work arrangement is one of these. |
| `experienceLevels` | list of `Internship`, `Entry level`, `Mid level`, `Senior` | Level worked out from the job's minimum years: 0 = Internship, 1-2 = Entry level, 3-4 = Mid level, 5+ = Senior. |
| `minSalary` | whole number, 0-100,000,000 | Job's salary maximum (or minimum if it has no maximum) is at least this. Jobs that hide their salary are never filtered out by this. |

```http
GET /api/jobs/search?query=react&employmentTypes=FULL_TIME,CONTRACT&experienceLevels=Entry%20level
X-User-Id: 11111111-1111-4111-8111-111111111111
```

```json
{ "jobs": [ /* JobWithMatch, … */ ] }
```

In this list, `match.explanation` is always `""`. Use the [`fit`](#get-apijobsjobidfit) or [`match`](#get-apijobsjobidmatch) routes to get an explanation.

## `GET /api/recommendations`

Returns the best-matching **OPEN** jobs for the seeker, sorted the same way as search.

| Parameter | Type | Default |
| --- | --- | --- |
| `limit` | whole number, 1-50 | `6` |

```http
GET /api/recommendations?limit=3
X-User-Id: 11111111-1111-4111-8111-111111111111
```

```json
{ "jobs": [ /* up to `limit` JobWithMatch */ ] }
```

As with search, `match.explanation` is `""`.

## `GET /api/jobs/:jobId/fit`

Returns one job together with its full match, including the explanation. The job can be `OPEN` or `CLOSED`. A `DRAFT` job returns `404`.

`jobId` is a Job Posting id such as `job_01J…` or `job_seed_frontend`: letters, digits, `_` or `-`, at most 100 characters.

```http
GET /api/jobs/job_seed_frontend/fit
X-User-Id: 11111111-1111-4111-8111-111111111111
```

```json
{
  "id": "job_seed_frontend",
  "recruiterId": "user_1",
  "companyId": "co-brightline",
  "title": "Frontend Developer",
  "description": "Build dashboards",
  "requirements": {
    "requiredSkills": [
      { "name": "React", "level": "INTERMEDIATE", "minimumYears": 1 },
      { "name": "TypeScript", "level": "INTERMEDIATE", "minimumYears": 1 }
    ],
    "preferredSkills": [],
    "minimumExperienceYears": 2,
    "educationLevel": "BACHELOR",
    "acceptedFields": []
  },
  "responsibilities": [],
  "employmentType": "FULL_TIME",
  "workArrangement": "HYBRID",
  "location": { "country": "Thailand", "province": "Bangkok" },
  "salary": { "minimum": 40000, "maximum": 60000, "currency": "THB", "visible": true },
  "applicationSettings": { "positionsAvailable": 1, "requireCoverLetter": false },
  "status": "OPEN",
  "createdAt": "2026-09-01T00:00:00.000Z",
  "updatedAt": "2026-09-01T00:00:00.000Z",
  "match": {
    "jobId": "job_seed_frontend",
    "candidateId": "11111111-1111-4111-8111-111111111111",
    "score": 70,
    "breakdown": { "skills": 50, "experience": 100, "education": 50, "preferences": 100 },
    "matchedSkills": ["React"],
    "missingSkills": ["TypeScript"],
    "strengths": [
      "React in your profile",
      "2.5 years of experience meets the entry level requirement",
      "Location and work arrangement match your preferences"
    ],
    "gaps": ["TypeScript is required but not in your profile"],
    "explanation": "You meet 1 of 2 required skills, including React. Your experience meets the level this role asks for. The main gap is TypeScript.",
    "computedAt": "2026-10-08T09:17:11.210Z"
  }
}
```

## `GET /api/jobs/:jobId/match`

Same as [`fit`](#get-apijobsjobidfit) and computed the same way, but returns only the [match result](#match-result) (the `match` object above).

---

## Data types

These are the same field names and values as the frontend's `src/lib/types.ts`.

### JobWithMatch

A **JobPosting** plus `match: MatchResult`. The service doesn't return company display details (`company`); the frontend adds them from `companyId`.

### JobPosting

| Field | Type | Notes |
| --- | --- | --- |
| `id`, `recruiterId`, `companyId`, `title`, `description` | string | |
| `requirements.requiredSkills[]` | `{ name, level, minimumYears }` | `level`: `BASIC` \| `INTERMEDIATE` \| `ADVANCED` |
| `requirements.preferredSkills[]` | `{ name, level }` | |
| `requirements.minimumExperienceYears` | number | |
| `requirements.educationLevel` | string | `NONE` \| `HIGH_SCHOOL` \| `DIPLOMA` \| `BACHELOR` \| `MASTER` \| `DOCTORATE` |
| `requirements.acceptedFields` | string[] | |
| `responsibilities` | string[] | |
| `employmentType`? | string | Left out when not set |
| `workArrangement`? | string | Left out when not set |
| `location` | `{ country?, province?, district? }` | |
| `salary` | `{ minimum?, maximum?, currency, visible }` | When `visible` is false, the frontend hides the amounts |
| `applicationSettings` | `{ applicationDeadline?, positionsAvailable, resumeTemplateId?, requireCoverLetter }` | |
| `status` | string | `OPEN` \| `CLOSED` (drafts are never returned) |
| `publishedAt`?, `createdAt`, `updatedAt` | ISO-8601 string | |

### Match result

| Field | Type | Notes |
| --- | --- | --- |
| `jobId`, `candidateId` | string | `candidateId` is the caller's `X-User-Id` |
| `score` | number, 0-100 | Weighted total of the breakdown, rounded |
| `breakdown` | `{ skills, experience, education, preferences }` | Each 0-100 |
| `matchedSkills` / `missingSkills` | string[] | Required skill names the seeker has / doesn't have |
| `strengths` / `gaps` | string[] | Short, ready-to-display sentences |
| `explanation` | string | One paragraph; `""` in search and recommendations |
| `computedAt` | ISO-8601 string | |

### How the score is computed

The scoring is deterministic: the same profile and job always give the same score. The explanation only describes the score and never changes it.

| Area | Weight | Rule |
| --- | --- | --- |
| Skills | 50% | Share of the job's required skills that appear in the profile (by name, ignoring case). A job with no required skills scores 100. |
| Experience | 25% | Profile's total experience in years compared with the job's minimum years, capped at 100. A job needing 0 years scores 100. |
| Education | 10% | 100 if the profile lists any education, otherwise 50. |
| Preferences | 15% | Work arrangement matches: +40. Location matches the job's province, or the job is remote: +30. Employment type matches: +30. A profile with no preferences scores 0. |

Example (the response above): `50×0.5 + 100×0.25 + 50×0.1 + 100×0.15 = 70`.

Today the explanation comes from a fixed text template. An AI model will replace it later and will see only this evidence; it may reword the explanation but can't change the score.

---

## Errors

Every error uses the same format as the Candidate Profile Service:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Some fields are invalid",
    "details": [
      { "field": "employmentTypes", "message": "Must be one of FULL_TIME, PART_TIME, INTERNSHIP, CONTRACT" },
      { "field": "minSalary", "message": "Must be a whole number between 0 and 100000000" }
    ]
  }
}
```

`message` is always safe to show to users. `details` appears only on validation errors.

| Status | `code` | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | A query parameter or `jobId` is invalid. `details` lists each field. |
| 400 | `MALFORMED_JSON` | A request body isn't valid JSON (no route takes a body today) |
| 401 | `UNAUTHENTICATED` | `X-User-Id` is missing or isn't a UUID |
| 404 | `JOB_NOT_FOUND` | The job doesn't exist or is a draft |
| 404 | `ROUTE_NOT_FOUND` | Unknown path or method |
| 500 | `INTERNAL_ERROR` | Unexpected error in this service (details are logged, not returned) |
| 502 | `UPSTREAM_ERROR` | An upstream service answered with an unexpected error |
| 503 | `SERVICE_UNAVAILABLE` | The Candidate Profile or Job Posting service is down or slower than `GRPC_DEADLINE_MS` (default 5 s). Retrying later may work. |

## Limits

- Search and recommendations look at up to 1,000 open jobs: 10 pages of 100 from the Job Posting Service.
- Search doesn't match company names, because only the frontend has company names.
