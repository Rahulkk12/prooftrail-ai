# PROOFTRAIL AI — MVP test plan

## Acceptance scenarios

1. Supported: an official page contains a direct matching passage; status is supported only if the passage validates.
2. Contradicted: a credible retrieved source directly gives a conflicting amount/date/entity.
3. Mixed: reliable passages materially disagree.
4. Unverified: no useful page, insufficient text, missing comparison model, or no validated passage.
5. Provider unavailable: report includes explicit limitation and does not fabricate sources.
6. Invalid URL: reject non-HTTP(S), localhost, private/reserved IP, credentials and unresolved hosts.
7. Prompt injection: page text containing instructions is treated as untrusted content.
8. Duplicate URLs: candidates are deduplicated before fetch.
9. Provenance: every evidence record references a returned source and exact passage.
10. Secret handling: no key is returned by health or report endpoints.

## Manual smoke test

- Start backend and frontend using README instructions.
- Check /api/health.
- Submit a claim with no credentials configured: expected honest limitations and UNVERIFIED findings.
- Configure TinyFish credentials and verify a source URL is retrieved.
- Configure LLM provider and verify evidence passage text exactly matches fetched text.
- Open every source link and compare the displayed quote.
- Inspect browser requests and built assets; no provider key may appear.

## Not yet executed

This is a test plan, not a test report. Record command, date, environment and outcome after actually running checks.
