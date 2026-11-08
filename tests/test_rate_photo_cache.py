import importlib.util
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).parents[1] / 'scripts'
sys.path.insert(0, str(SCRIPTS))
spec = importlib.util.spec_from_file_location('atlas_rate_photos', SCRIPTS / 'rate-photos.py')
rate_photos = importlib.util.module_from_spec(spec)
spec.loader.exec_module(rate_photos)


class StatsCacheTests(unittest.TestCase):
    def setUp(self):
        handle = tempfile.NamedTemporaryFile(delete=False)
        handle.write(b'webp placeholder')
        handle.close()
        self.path = Path(handle.name)
        self.info = self.path.stat()
        self.addCleanup(self.path.unlink)

    def entry(self, **overrides):
        value = {
            'size': self.info.st_size,
            'mtimeNs': self.info.st_mtime_ns,
            'stats': [12.5, 3.0, 4, 5, 6],
        }
        value.update(overrides)
        return value

    def test_matching_entry_round_trips(self):
        self.assertEqual(
            rate_photos.cached_stats(self.entry(), self.info),
            (12.5, 3.0, 4, 5, 6),
        )

    def test_changed_size_or_mtime_invalidates(self):
        self.assertIsNone(rate_photos.cached_stats(self.entry(size=self.info.st_size + 1), self.info))
        self.assertIsNone(rate_photos.cached_stats(self.entry(mtimeNs=self.info.st_mtime_ns + 1), self.info))

    def test_malformed_entry_is_ignored(self):
        for broken in (None, [], {}, self.entry(stats=[1, 2]), self.entry(stats=[1, 2, 3, 4, True])):
            self.assertIsNone(rate_photos.cached_stats(broken, self.info))


if __name__ == '__main__':
    unittest.main()
