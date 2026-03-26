# Kong API Gateway — Grade Service

A production-style API Gateway setup using [Kong](https://konghq.com/) to secure and rate-limit a Grade Submission REST API.

Supports two deployment targets:
- **Local development** — Docker Compose (no Kubernetes required)
- **Production** — Kubernetes with Kong Ingress Controller

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   Client                                                    │
│     │                                                       │
│     │  Authorization: Bearer <JWT>                          │
│     ▼                                                       │
│   Kong API Gateway  (port 8000)                             │
│     │                                                       │
│     ├── Plugin: jwt           ← validates Bearer JWT token  │
│     ├── Plugin: rate-limiting ← 5 requests/min per consumer │
│     │                                                       │
│     ▼                                                       │
│   Grade API Service  (port 3000)                            │
│     │                                                       │
│     ├── GET  /grades   → returns all grade submissions      │
│     └── POST /grades   → submit a new grade                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Repository Structure

```
kong-api-gateway/
│
├── app/
│   └── grade-api/
│       ├── src/index.js          # Express REST API
│       ├── package.json
│       └── Dockerfile
│
├── token-generator/
│   ├── generate-token.js         # Generates signed JWT tokens for testing
│   └── package.json
│
├── kong/
│   └── kong.yaml                 # Kong declarative config (Docker Compose)
│
├── docker-compose.yaml           # Local dev: Kong + Grade API
│
├── namespace.yaml                # K8s namespace
├── grade-api-deployment.yaml     # K8s deployment
├── grade-api-service.yaml        # K8s service
├── kong-ingress.yaml             # K8s ingress with plugin annotations
├── kong-jwt-plugin.yaml          # K8s KongPlugin — jwt
├── kong-jwt-secret.yaml          # K8s Secret — JWT credential
├── kong-consumer.yaml            # K8s KongConsumer
├── kong-rate-plugin.yaml         # K8s KongPlugin — rate-limiting
├── kong-auth-plugin.yaml         # K8s KongPlugin — key-auth (legacy)
└── kong-secrete.yaml             # K8s Secret — API key (legacy)
```

---

## Running Locally with Docker Compose

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose
- [Node.js](https://nodejs.org/) v18+ (for the token generator only)

### 1. Start the Stack

```bash
docker-compose up --build
```

This starts two containers:
- `grade-api` — the Grade REST API on port 3000
- `kong` — the API Gateway on port 8000 (proxy) and 8001 (admin)

Wait until you see:
```
kong  | Kong started
```

### 2. Generate a JWT Token

In a new terminal:

```bash
cd token-generator
npm install
npm run generate
```

This prints a signed JWT token and ready-to-use `curl` commands.

### 3. Call the API Through Kong

Use the token from step 2:

```bash
# Get all grades
curl -X GET http://localhost:8000/grades \
  -H "Authorization: Bearer <your-token>"

# Submit a grade
curl -X POST http://localhost:8000/grades \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/json" \
  -d '{"student": "Alice", "subject": "Mathematics", "grade": 92}'
```

### 4. Verify Kong is Working

**Missing token → 401:**
```bash
curl http://localhost:8000/grades
# {"message":"Unauthorized"}
```

**Inspect Kong via Admin API:**
```bash
curl http://localhost:8001/services    # loaded services
curl http://localhost:8001/routes      # loaded routes
curl http://localhost:8001/consumers   # loaded consumers
curl http://localhost:8001/plugins     # active plugins
```

---

## API Reference

### `GET /grades`

Returns all submitted grades.

```json
{
  "total": 1,
  "grades": [
    {
      "id": 1,
      "student": "Alice",
      "subject": "Mathematics",
      "grade": 92,
      "submitted_at": "2026-03-27T10:00:00.000Z"
    }
  ]
}
```

### `POST /grades`

Submit a new grade.

**Request body:**

| Field     | Type   | Required | Validation      |
|-----------|--------|----------|-----------------|
| `student` | string | yes      | non-empty       |
| `subject` | string | yes      | non-empty       |
| `grade`   | number | yes      | 0–100 inclusive |

```bash
curl -X POST http://localhost:8000/grades \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"student":"Alice","subject":"Mathematics","grade":92}'
```

### `GET /health`

Health check — used by Docker healthcheck, bypasses Kong auth.

```json
{ "status": "ok", "uptime": 42.3 }
```

---

## Error Responses

| Scenario                     | Status | Message                                          |
|------------------------------|--------|--------------------------------------------------|
| Missing Authorization header | `401`  | Unauthorized                                     |
| Invalid JWT signature        | `401`  | Invalid signature                                |
| Expired token                | `401`  | Token has expired                                |
| Unknown issuer               | `401`  | No credentials found for given 'iss'             |
| Rate limit exceeded          | `429`  | API rate limit exceeded                          |
| Missing required fields      | `400`  | Missing required fields: student, subject, grade |
| Grade out of range           | `400`  | grade must be a number between 0 and 100         |
| Wrong HTTP method            | `405`  | Method not allowed                               |

---

## JWT Configuration

| Setting              | Value                     | Purpose                                 |
|----------------------|---------------------------|-----------------------------------------|
| `key_claim_name`     | `iss`                     | Claim used to look up consumer          |
| `claims_to_verify`   | `exp`                     | Rejects expired tokens                  |
| `header_names`       | `Authorization`           | `Authorization: Bearer <token>`         |
| `maximum_expiration` | `3600`                    | Token must expire within 1 hour         |
| `algorithm`          | `HS256`                   | HMAC-SHA256 symmetric signing           |
| `iss` value          | `grade-submission-issuer` | Must match `iss` claim in token         |

---

## Deploying to Kubernetes

```bash
kubectl apply -f namespace.yaml
kubectl apply -f grade-api-deployment.yaml
kubectl apply -f grade-api-service.yaml
kubectl apply -f kong-jwt-plugin.yaml
kubectl apply -f kong-rate-plugin.yaml
kubectl apply -f kong-jwt-secret.yaml   # edit 'secret' first: openssl rand -base64 64
kubectl apply -f kong-consumer.yaml
kubectl apply -f kong-ingress.yaml
```

---

## Security Notes

- Replace the JWT `secret` before any real deployment: `openssl rand -base64 64`
- For production, switch to `RS256` — Kong only needs the public key, never the signing key
- Switch rate-limiting `policy` from `local` to `redis` for multi-replica Kong deployments
- Enable HTTPS on the Kong proxy to prevent token interception in transit

---

## License

MIT
