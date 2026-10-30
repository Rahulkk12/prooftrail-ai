import json
import os
import unittest
from unittest.mock import AsyncMock, patch, MagicMock

import httpx
from fastapi.testclient import TestClient

from main import (
    app,
    enforce_evidence_status,
    extract_exact_passage,
    rule_based_claim_decomposition,
    tinyfish_search,
    tinyfish_fetch,
    validate_public_url,
    page_cache,
)


class URLValidationTests(unittest.TestCase):
    def test_accepts_public_ip(self):
        self.assertEqual(validate_public_url("https://8.8.8.8/path"), "https://8.8.8.8/path")

    def test_rejects_localhost(self):
        with self.assertRaises(ValueError):
            validate_public_url("http://localhost:8000")

    def test_rejects_loopback_ip(self):
        with self.assertRaises(ValueError):
            validate_public_url("http://127.0.0.1")

    def test_rejects_private_ip(self):
        with self.assertRaises(ValueError):
            validate_public_url("http://192.168.1.10")

    def test_rejects_link_local_ip(self):
        with self.assertRaises(ValueError):
            validate_public_url("http://169.254.169.254/latest/meta-data")

    def test_rejects_non_http_scheme(self):
        with self.assertRaises(ValueError):
            validate_public_url("file:///etc/passwd")

    def test_rejects_embedded_credentials(self):
        with self.assertRaises(ValueError):
            validate_public_url("https://user:password@example.com/")


class EvidenceStatusPolicyTests(unittest.TestCase):
    def test_supported_requires_supporting_passage(self):
        self.assertEqual(enforce_evidence_status("SUPPORTED", {"SUPPORTS"}), "SUPPORTED")
        self.assertEqual(enforce_evidence_status("SUPPORTED", {"CONTRADICTS"}), "UNVERIFIED")
        self.assertEqual(enforce_evidence_status("SUPPORTED", {"SUPPORTS", "CONTRADICTS"}), "MIXED")

    def test_contradicted_requires_contradicting_passage(self):
        self.assertEqual(enforce_evidence_status("CONTRADICTED", {"CONTRADICTS"}), "CONTRADICTED")
        self.assertEqual(enforce_evidence_status("CONTRADICTED", {"SUPPORTS"}), "UNVERIFIED")
        self.assertEqual(enforce_evidence_status("CONTRADICTED", {"SUPPORTS", "CONTRADICTS"}), "MIXED")

    def test_mixed_requires_both_relations(self):
        self.assertEqual(enforce_evidence_status("MIXED", {"SUPPORTS", "CONTRADICTS"}), "MIXED")
        self.assertEqual(enforce_evidence_status("MIXED", {"SUPPORTS"}), "UNVERIFIED")

    def test_exact_passage_returns_original_source_slice(self):
        source = "The award is ₹50,000\nfor eligible applicants."
        quote = extract_exact_passage(source, "The award is ₹50,000 for eligible applicants.")
        self.assertEqual(quote, source)

    def test_paraphrased_passage_is_rejected(self):
        self.assertIsNone(extract_exact_passage("The award is ₹50,000.", "The award is ₹60,000."))

    def test_unknown_status_is_unverified(self):
        self.assertEqual(enforce_evidence_status("LIKELY_TRUE", {"SUPPORTS"}), "UNVERIFIED")

    def test_unverified_never_upgraded(self):
        self.assertEqual(enforce_evidence_status("UNVERIFIED", {"SUPPORTS", "CONTRADICTS"}), "UNVERIFIED")


class ClaimDecompositionTests(unittest.TestCase):
    def test_rule_based_decomposition_extracts_amount_and_deadline(self):
        claim = "The Government announced a ₹50,000 scholarship for college students before 30 November 2026."
        fields = rule_based_claim_decomposition(claim)
        self.assertTrue(len(fields) >= 2)
        has_amount = any(f["value"] == "₹50,000" for f in fields)
        has_deadline = any("November" in (f["date"] or "") for f in fields)
        self.assertTrue(has_amount, "Expected financial amount field extracted")
        self.assertTrue(has_deadline, "Expected application deadline field extracted")

    def test_rule_based_decomposition_generates_queries(self):
        claim = "Google is hiring remote interns with ₹40,000 stipend closing on 15 December."
        fields = rule_based_claim_decomposition(claim)
        for f in fields:
            self.assertTrue(f.get("official_query"), "Expected official_query to be populated")
            self.assertTrue(f.get("independent_query"), "Expected independent_query to be populated")


class TinyFishAdapterMockedTests(unittest.TestCase):
    @patch("main.TINYFISH_KEY", "test_mock_api_key")
    @patch("main.request_with_retry", new_callable=AsyncMock)
    def test_tinyfish_search_normalizes_results_schema(self, mock_request):
        # Mock official TinyFish Search API response structure
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "query": "stem fellowship official",
            "total_results": 2,
            "results": [
                {
                    "position": 1,
                    "site_name": "education.gov.in",
                    "title": "National STEM Scheme Guidelines",
                    "snippet": "Provides ₹50,000 stipend to students...",
                    "url": "https://education.gov.in/stem",
                },
                {
                    "position": 2,
                    "site_name": "pib.gov.in",
                    "title": "PIB Press Release on Scholarships",
                    "snippet": "Clarification on deadline dates...",
                    "url": "https://pib.gov.in/press/10293",
                },
            ],
        }
        mock_request.return_value = mock_resp

        import asyncio
        results = asyncio.run(tinyfish_search("stem fellowship official"))
        self.assertEqual(len(results), 2)
        self.assertEqual(results[0]["publisher"], "education.gov.in")
        self.assertEqual(results[0]["url"], "https://education.gov.in/stem")
        self.assertEqual(results[1]["publisher"], "pib.gov.in")

    @patch("main.TINYFISH_KEY", "test_mock_api_key")
    @patch("main.request_with_retry", new_callable=AsyncMock)
    def test_tinyfish_fetch_and_caching(self, mock_request):
        # Clear cache for isolated test
        page_cache._cache.clear()

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "results": [
                {
                    "url": "https://education.gov.in/stem",
                    "final_url": "https://education.gov.in/stem",
                    "title": "National STEM Scheme Guidelines",
                    "text": "# National STEM Scheme\nProvides ₹50,000 stipend for eligible students.",
                }
            ],
            "errors": [],
        }
        mock_request.return_value = mock_resp

        import asyncio
        pages, errors = asyncio.run(tinyfish_fetch(["https://education.gov.in/stem"]))
        self.assertEqual(len(pages), 1)
        self.assertEqual(pages[0]["title"], "National STEM Scheme Guidelines")
        self.assertEqual(len(errors), 0)

        # Second fetch of identical URL should hit cache without issuing network call
        mock_request.reset_mock()
        cached_pages, _ = asyncio.run(tinyfish_fetch(["https://education.gov.in/stem"]))
        self.assertEqual(len(cached_pages), 1)
        self.assertEqual(mock_request.call_count, 0, "Expected cache hit to skip network request")


class APIContractTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_health_endpoint_does_not_expose_credentials(self):
        response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["status"], "ok")
        self.assertNotIn("api_key", payload)
        self.assertNotIn("secret", payload)
        self.assertIn("version", payload)
        self.assertIn("database", payload)

    def test_list_investigations_returns_history(self):
        response = self.client.get("/api/investigations")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertIn("investigations", payload)
        self.assertIn("total", payload)

    def test_report_not_found_returns_404(self):
        response = self.client.get("/api/investigations/inv_does_not_exist/report")
        self.assertEqual(response.status_code, 404)

    def test_private_source_url_is_rejected_at_input(self):
        response = self.client.post("/api/investigations", json={
            "claim": "This is a sufficiently long claim for validation.",
            "source_url": "http://127.0.0.1/private"
        })
        self.assertEqual(response.status_code, 422)

    @patch("main.tinyfish_search", new_callable=AsyncMock)
    @patch("main.tinyfish_fetch", new_callable=AsyncMock)
    @patch("main.llm_json", new_callable=AsyncMock)
    def test_mocked_end_to_end_investigation_pipeline(self, mock_llm, mock_fetch, mock_search):
        mock_search.return_value = [
            {"url": "https://8.8.8.8/official", "title": "Official Portal", "publisher": "Official Division"}
        ]
        mock_fetch.return_value = ([
            {
                "url": "https://8.8.8.8/official",
                "final_url": "https://8.8.8.8/official",
                "title": "Official Portal Notice",
                "text": "The government scholarship provides a direct benefit transfer of ₹50,000 for college students.",
            }
        ], [])
        mock_llm.return_value = None  # Simulates conservative evaluation without LLM forcing

        response = self.client.post("/api/investigations", json={
            "claim": "The government scholarship provides a direct benefit transfer of ₹50,000 for college students."
        })
        self.assertEqual(response.status_code, 200)
        report = response.json()
        self.assertTrue(report["investigation_id"].startswith("inv_"))
        self.assertEqual(report["status"], "completed_with_gaps")
        self.assertTrue(len(report["sources"]) > 0)

        # Test Metadata Endpoint
        meta_res = self.client.get(f"/api/investigations/{report['investigation_id']}")
        self.assertEqual(meta_res.status_code, 200)
        meta_data = meta_res.json()
        self.assertEqual(meta_data["id"], report["investigation_id"])

        # Test Export Endpoint JSON
        export_json = self.client.get(f"/api/investigations/{report['investigation_id']}/export?format=json")
        self.assertEqual(export_json.status_code, 200)
        self.assertEqual(export_json.headers["content-type"], "application/json")

        # Test Export Endpoint Markdown
        export_md = self.client.get(f"/api/investigations/{report['investigation_id']}/export?format=markdown")
        self.assertEqual(export_md.status_code, 200)
        self.assertIn("text/markdown", export_md.headers["content-type"])
        self.assertIn("# PROOFTRAIL AI", export_md.text)

        # Test Retry Endpoint
        retry_res = self.client.post(f"/api/investigations/{report['investigation_id']}/retry")
        self.assertEqual(retry_res.status_code, 200)
        retry_report = retry_res.json()
        self.assertNotEqual(retry_report["investigation_id"], report["investigation_id"])
        self.assertEqual(retry_report["retry_of"], report["investigation_id"])


# ---------------------------------------------------------------------------
# Live Provider Integration Tests (Clearly Distinguished)
# ---------------------------------------------------------------------------

@unittest.skipUnless(
    os.getenv("RUN_LIVE_TINYFISH_TESTS") == "1" and os.getenv("TINYFISH_API_KEY"),
    "Live TinyFish credentials not provided. Set RUN_LIVE_TINYFISH_TESTS=1 and TINYFISH_API_KEY to run live acceptance tests."
)
class LiveTinyFishIntegrationTests(unittest.TestCase):
    """These tests execute real authenticated network calls against live TinyFish APIs.
    Skipped by default in CI to avoid consuming API quota without credentials.
    """

    def test_live_tinyfish_search(self):
        import asyncio
        results = asyncio.run(tinyfish_search("Government of India scholarship schemes 2026", location="IN"))
        self.assertIsInstance(results, list)
        if results:
            self.assertIn("url", results[0])
            self.assertTrue(results[0]["url"].startswith("http"))

    def test_live_tinyfish_fetch(self):
        import asyncio
        pages, errors = asyncio.run(tinyfish_fetch(["https://example.com/"]))
        self.assertIsInstance(pages, list)
        if pages:
            self.assertIn("text", pages[0])


if __name__ == "__main__":
    unittest.main()
