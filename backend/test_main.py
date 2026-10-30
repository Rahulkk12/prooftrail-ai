import unittest
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient
from main import app, enforce_evidence_status, extract_exact_passage, validate_public_url


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

    def test_list_investigations_returns_list(self):
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
    def test_investigation_without_llm_never_forces_verdict(self, llm, fetch, search):
        search.return_value = [{"url": "https://8.8.8.8/official", "title": "Official notice", "domain": "example.org"}]
        fetch.return_value = ([{
            "url": "https://8.8.8.8/official",
            "final_url": "https://8.8.8.8/official",
            "title": "Official notice",
            "text": "The official notice confirms that the programme exists and is accepting applications."
        }], [])
        llm.return_value = None
        response = self.client.post("/api/investigations", json={
            "claim": "The programme exists and is accepting applications."
        })
        self.assertEqual(response.status_code, 200)
        report = response.json()
        self.assertEqual(report["status"], "completed_with_gaps")
        self.assertTrue(report["sources"])
        self.assertTrue(all(f["status"] == "UNVERIFIED" for f in report["findings"]))
        self.assertTrue(any("LLM_API_KEY" in x for x in report["limitations"]))
        self.assertTrue(report["investigation_id"].startswith("inv_"))
        report_response = self.client.get(
            f"/api/investigations/{report['investigation_id']}/report"
        )
        self.assertEqual(report_response.status_code, 200)
        self.assertEqual(report_response.json()["investigation_id"], report["investigation_id"])
        retry_response = self.client.post(
            f"/api/investigations/{report['investigation_id']}/retry"
        )
        self.assertEqual(retry_response.status_code, 200)
        retry_report = retry_response.json()
        self.assertNotEqual(retry_report["investigation_id"], report["investigation_id"])
        self.assertEqual(retry_report["retry_of"], report["investigation_id"])


if __name__ == "__main__":
    unittest.main()
