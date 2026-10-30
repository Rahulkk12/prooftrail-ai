import unittest

from main import enforce_evidence_status, extract_exact_passage, validate_public_url


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

    def test_contradicted_requires_contradicting_passage(self):
        self.assertEqual(enforce_evidence_status("CONTRADICTED", {"CONTRADICTS"}), "CONTRADICTED")
        self.assertEqual(enforce_evidence_status("CONTRADICTED", {"SUPPORTS"}), "UNVERIFIED")

    def test_mixed_requires_both_relations(self):
        self.assertEqual(enforce_evidence_status("MIXED", {"SUPPORTS", "CONTRADICTS"}), "MIXED")
        self.assertEqual(enforce_evidence_status("MIXED", {"SUPPORTS"}), "UNVERIFIED")

    def test_exact_passage_returns_original_source_slice(self):
        source = "The award is ₹50,000\\nfor eligible applicants."
        quote = extract_exact_passage(source, "The award is ₹50,000 for eligible applicants.")
        self.assertEqual(quote, source)

    def test_paraphrased_passage_is_rejected(self):
        self.assertIsNone(extract_exact_passage("The award is ₹50,000.", "The award is ₹60,000."))

    def test_unknown_status_is_unverified(self):
        self.assertEqual(enforce_evidence_status("LIKELY_TRUE", {"SUPPORTS"}), "UNVERIFIED")

    def test_unverified_never_upgraded(self):
        self.assertEqual(enforce_evidence_status("UNVERIFIED", {"SUPPORTS", "CONTRADICTS"}), "UNVERIFIED")


if __name__ == "__main__":
    unittest.main()
