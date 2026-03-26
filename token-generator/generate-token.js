#!/usr/bin/env node

/**
 * JWT Token Generator
 *
 * Generates a signed JWT token that Kong will accept on the /grades route.
 * The iss, algorithm, and secret must match what is configured in:
 *   - kong/kong.yaml (docker-compose)
 *   - kong-jwt-secret.yaml (Kubernetes)
 */

const jwt = require('jsonwebtoken');

// ── Configuration ─────────────────────────────────────────────────────────────
// These values must match kong/kong.yaml → consumers[0].jwt_secrets[0]
const ISS    = 'grade-submission-issuer';
const SECRET = 'grade-super-secret-jwt-signing-key-replace-in-production-min32chars';
const ALGO   = 'HS256';
const TTL    = 3600; // seconds — must be ≤ maximum_expiration in jwt plugin config
// ─────────────────────────────────────────────────────────────────────────────

const now = Math.floor(Date.now() / 1000);

const payload = {
  iss: ISS,                // Kong uses this to look up the consumer credential
  sub: 'grade-submission', // subject — identifies the consumer
  iat: now,                // issued at
  exp: now + TTL,          // expiry
};

const token = jwt.sign(payload, SECRET, { algorithm: ALGO });

console.log('\n=== Generated JWT Token ===\n');
console.log(token);
console.log('\n=== Token Payload ===\n');
console.log(JSON.stringify(payload, null, 2));
console.log('\n=== Usage Examples ===\n');
console.log('# Get all grades:');
console.log(`curl -X GET http://localhost:8000/grades \\`);
console.log(`  -H "Authorization: Bearer ${token}"\n`);
console.log('# Submit a grade:');
console.log(`curl -X POST http://localhost:8000/grades \\`);
console.log(`  -H "Authorization: Bearer ${token}" \\`);
console.log(`  -H "Content-Type: application/json" \\`);
console.log(`  -d '{"student":"Alice","subject":"Mathematics","grade":92}'\n`);
console.log(`Token expires in ${TTL / 60} minutes.\n`);
