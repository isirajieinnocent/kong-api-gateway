# Kong API Gateway — Grade Service

A Kubernetes-based API Gateway setup using [Kong Ingress Controller](https://docs.konghq.com/kubernetes-ingress-controller/) to manage, secure, and rate-limit a Grade API service.

## Overview

This project deploys a Grade API service on Kubernetes and exposes it through a Kong API Gateway with:

- **JWT OAuth 2.0 Authentication** — Stateless, signed JWT Bearer tokens validate consumer identity
- **Rate Limiting** — Limits each consumer to 5 requests per minute
- **Ingress Routing** — Routes traffic from `/grades` to the backend service on port 3000

## Architecture

```
Client Request
     │
     ▼
Kong Ingress Controller (/grades)
     │
     ├── Plugin: jwt (grade-jwt)             ← validates Bearer JWT token
     ├── Plugin: rate-limiting (grade-rate-limit)
     │
     ▼
grade-service-api (port 3000)
```

### JWT OAuth 2.0 Token Flow

```
1. Client signs a JWT using the shared secret (HS256)
        │
        ▼
2. Client sends:  Authorization: Bearer <signed-jwt>
        │
        ▼
3. Kong extracts the 'iss' claim → looks up matching KongConsumer credential
        │
        ▼
4. Kong verifies signature + expiry (exp claim)
        │
        ▼
5. Authenticated request forwarded to Grade API
```

## Repository Structure

```
kong-api-gateway/
├── namespace.yaml              # Kubernetes namespace (grade-demo)
├── grade-api-deployment.yaml   # Grade API deployment manifest
├── grade-api-service.yaml      # Grade API service (ClusterIP)
├── kong-ingress.yaml           # Kong Ingress routing rules
├── kong-consumer.yaml          # Kong consumer definition
├── kong-jwt-plugin.yaml        # JWT OAuth 2.0 authentication plugin  ← NEW
├── kong-jwt-secret.yaml        # JWT signing credential for consumer   ← NEW
├── kong-auth-plugin.yaml       # Key-auth plugin (legacy, kept for reference)
├── kong-rate-plugin.yaml       # Rate limiting plugin (5 req/min)
└── kong-secrete.yaml           # API key secret (legacy, kept for reference)
```

## Prerequisites

- Kubernetes cluster (v1.20+)
- Kong Ingress Controller installed
- `kubectl` configured to point to your cluster
- A tool to generate JWT tokens (e.g., `jwt-cli`, Python `PyJWT`, or any OAuth2 library)

## Installation

### 1. Create the Namespace

```bash
kubectl apply -f namespace.yaml
```

### 2. Deploy the Grade API

```bash
kubectl apply -f grade-api-deployment.yaml
kubectl apply -f grade-api-service.yaml
```

### 3. Apply Kong Plugins

```bash
kubectl apply -f kong-jwt-plugin.yaml
kubectl apply -f kong-rate-plugin.yaml
```

### 4. Create Consumer & JWT Credential

> **Important:** Before applying, replace the `secret` value in `kong-jwt-secret.yaml`
> with a strong, randomly-generated key:
>
> ```bash
> openssl rand -base64 64
> ```

```bash
kubectl apply -f kong-jwt-secret.yaml
kubectl apply -f kong-consumer.yaml
```

### 5. Apply the Ingress

```bash
kubectl apply -f kong-ingress.yaml
```

## Usage

### Step 1 — Generate a JWT Token

Use the **same secret and issuer** configured in `kong-jwt-secret.yaml`.

**Using Python (PyJWT):**

```python
import jwt
import time

payload = {
    "iss": "grade-submission-issuer",   # must match the 'key' in kong-jwt-secret.yaml
    "exp": int(time.time()) + 3600,     # expires in 1 hour
    "sub": "grade-submission"
}

token = jwt.encode(payload, "grade-super-secret-jwt-signing-key-replace-in-production-min32chars", algorithm="HS256")
print(token)
```

**Using jwt-cli:**

```bash
jwt encode \
  --alg HS256 \
  --secret "grade-super-secret-jwt-signing-key-replace-in-production-min32chars" \
  --claim iss=grade-submission-issuer \
  --exp=$(date -d "+1 hour" +%s)
```

### Step 2 — Call the API

```bash
TOKEN="<paste-your-jwt-token-here>"

# GET request
curl -X GET http://<KONG_PROXY_IP>/grades \
  -H "Authorization: Bearer $TOKEN"

# POST request
curl -X POST http://<KONG_PROXY_IP>/grades \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"student": "Alice", "grade": 95}'
```

### Error Responses

| Scenario                        | HTTP Status | Message                          |
|---------------------------------|-------------|----------------------------------|
| Missing `Authorization` header  | `401`       | Unauthorized                     |
| Malformed or invalid JWT        | `401`       | Invalid signature                |
| Expired JWT (`exp` in the past) | `401`       | Token has expired                |
| Unknown issuer (`iss` mismatch) | `401`       | No credentials found for given 'iss' |
| Rate limit exceeded             | `429`       | API rate limit exceeded          |

## Configuration

### JWT Plugin (`kong-jwt-plugin.yaml`)

| Setting              | Value           | Description                                     |
|----------------------|-----------------|-------------------------------------------------|
| `key_claim_name`     | `iss`           | JWT claim used to identify the consumer         |
| `claims_to_verify`   | `exp`           | Reject tokens that are expired                  |
| `header_names`       | `Authorization` | Read JWT from `Authorization: Bearer` header    |
| `maximum_expiration` | `3600`          | Token must expire within 1 hour of issuance     |

### JWT Credential (`kong-jwt-secret.yaml`)

| Setting     | Value                        | Description                                     |
|-------------|------------------------------|-------------------------------------------------|
| `key`       | `grade-submission-issuer`    | Must match the `iss` claim in the JWT           |
| `algorithm` | `HS256`                      | HMAC-SHA256 symmetric signing algorithm         |
| `secret`    | *(set your own)*             | Shared secret for signing and verifying tokens  |

### Rate Limiting Plugin (`kong-rate-plugin.yaml`)

| Setting              | Value      | Description                          |
|----------------------|------------|--------------------------------------|
| Requests per minute  | `5`        | Max requests allowed per minute      |
| Limit by             | `consumer` | Tracked per authenticated consumer   |
| Policy               | `local`    | In-memory rate limit counter         |

## Security Recommendations

- **Rotate the JWT secret** regularly and store it in a secrets manager (e.g., HashiCorp Vault, AWS Secrets Manager)
- **Use short expiry times** — tokens should expire in minutes or hours, not days
- **Switch to RS256** for production: use an RSA private key to sign tokens and configure Kong with the public key only — this prevents Kong itself from issuing tokens
- **Enable HTTPS** on your Kong proxy to prevent token interception in transit

## RS256 (Asymmetric) Setup (Production Recommended)

Generate an RSA key pair:

```bash
# Private key (kept by the token issuer / auth server)
openssl genrsa -out jwt-private.pem 2048

# Public key (given to Kong for verification only)
openssl rsa -in jwt-private.pem -pubout -out jwt-public.pem
```

Update `kong-jwt-secret.yaml`:

```yaml
stringData:
  kongCredType: jwt
  key: "grade-submission-issuer"
  algorithm: "RS256"
  rsa_public_key: |
    -----BEGIN PUBLIC KEY-----
    <paste contents of jwt-public.pem here>
    -----END PUBLIC KEY-----
```

## License

MIT
