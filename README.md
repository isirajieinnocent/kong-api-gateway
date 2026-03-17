Kong API Gateway — Grade Service
A Kubernetes-based API Gateway setup using Kong Ingress Controller to manage, secure, and rate-limit a Grade API service.

Overview
This project deploys a Grade API service on Kubernetes and exposes it through a Kong API Gateway with:

Key-based Authentication — Only authorized consumers with a valid API key can access the API

Rate Limiting — Limits each consumer to 5 requests per minute

Ingress Routing — Routes traffic from /grades to the backend service on port 3000

Architecture
text
Client Request
     │
     ▼
Kong Ingress Controller (/grades)
     │
     ├── Plugin: key-auth (grade-auth)
     ├── Plugin: rate-limiting (grade-rate-limit)
     │
     ▼
grade-service-api (port 3000)
Repository Structure
text
kong-api-gateway/
├── namespace.yaml            # Kubernetes namespace (grade-demo)
├── grade-api-deployment.yaml # Grade API deployment manifest
├── grade-api-service.yaml    # Grade API service (ClusterIP/NodePort)
├── kong-ingress.yaml         # Kong Ingress routing rules
├── kong-consumer.yaml        # Kong consumer definition
├── kong-auth-plugin.yaml     # Key authentication plugin
├── kong-rate-plugin.yaml     # Rate limiting plugin (5 req/min)
└── kong-secrete.yaml         # API key secret for consumer
Prerequisites
Kubernetes cluster (v1.20+)

Kong Ingress Controller installed

kubectl configured to point to your cluster

Installation
Create the Namespace
bash
kubectl apply -f namespace.yaml
Deploy the Grade API
bash
kubectl apply -f grade-api-deployment.yaml
kubectl apply -f grade-api-service.yaml
Apply Kong Plugins
bash
kubectl apply -f kong-auth-plugin.yaml
kubectl apply -f kong-rate-plugin.yaml
Create Consumer & Secret
bash
kubectl apply -f kong-secrete.yaml
kubectl apply -f kong-consumer.yaml
Apply the Ingress
bash
kubectl apply -f kong-ingress.yaml
Usage
Once deployed, send requests to the /grades endpoint with a valid API key:

bash
curl -X GET http://<KONG_PROXY_IP>/grades \
  -H "apikey: your-api-key-here"
Authentication
This API uses key-auth plugin. Requests without a valid apikey header will be rejected with 401 Unauthorized.

Rate Limiting
Each consumer is limited to 5 requests per minute. Exceeding the limit returns 429 Too Many Requests.

Configuration
Plugin	Setting	Value
key-auth	Key header name	apikey
key-auth	Hide credentials	true
rate-limiting	Requests per minute	5
rate-limiting	Limit by	consumer
rate-limiting	Policy	local
License
MIT
