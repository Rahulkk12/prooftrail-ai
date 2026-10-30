# PROOFTRAIL AI — MVP validation plan

## Automated CI coverage

The CI workflow installs backend dependencies, runs Python unit tests, installs frontend dependencies and runs the Vite production build.

Backend tests cover:
- HTTP(S) URL scheme, embedded credentials, localhost, loopback, private and link-local IP rejection.
- Supported/contradicted/mixed/unverified evidence status rules.
- Exact original source substring extraction across whitespace/newline differences.
- Paraphrase rejection.
- Health response does not expose credentials.
- Unknown report returns 404.
- Private source URL rejected by request validation.
- Mocked provider investigation returns UNVERIFIED when no LLM analysis is configured.
- Stored report retrieval and retry creates a new run linked to the prior investigation.

## Manual live-provider acceptance

1. Configure `TINYFISH_API_KEY` in backend/.env; never place it in frontend code.
2. Configure an OpenAI-compatible `LLM_API_KEY` and model accepted by the provider.
3. Start the backend and frontend using the README instructions.
4. Check `GET /api/health`; verify provider configuration booleans are true.
5. Submit a well-scoped public claim and inspect the run trace.
6. Confirm Search candidate URLs and Fetch result URLs correspond to actual public sources.
7. Open every source URL; compare every displayed quote character-for-character with the source text.
8. Confirm source access timestamps, publication metadata (when available), limitations and per-field statuses.
9. Submit a claim with a known conflict and confirm both supporting and contradicting evidence appear before MIXED is assigned.
10. Submit a claim with no evidence and confirm it stays UNVERIFIED.
11. Test a failed URL and a provider rate limit; confirm the report records a limitation rather than fabricating a source.
12. Retry a prior investigation and confirm the new report has a new ID and a retry_of reference.
13. Inspect browser network traffic and built frontend assets; provider keys must never appear.

## Security review before public deployment

- Add network-level egress restrictions to prevent private-network fetches and DNS rebinding.
- Revalidate every redirect target at the fetch boundary.
- Add authentication, rate limiting, abuse monitoring and retention controls.
- Review dependency updates and container image pinning.
- Avoid logging user secrets or raw provider credentials.
- Treat retrieved page text as untrusted input at every model boundary.

## Not yet certified

A green CI run is not proof of live TinyFish connectivity, factual accuracy, production SSRF resistance or safe multi-user deployment. Those require the live-provider and human-reviewed tests above.
