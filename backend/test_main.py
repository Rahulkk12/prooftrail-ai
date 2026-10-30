import unittest

from main import validate_public_url


class URLValidationTests(unittest.TestCase):
    def test_accepts_https_public_hostname_syntax(self):
        # DNS resolution is intentionally avoided in this test by using a public IP.
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


if __name__ == "__main__":
    unittest.main()
