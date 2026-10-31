import importlib.util
import io
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location(
    'atlas_progress', Path(__file__).parents[1] / 'scripts/progress.py'
)
progress_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(progress_module)


class ProgressTests(unittest.TestCase):
    def make(self, total, **kwargs):
        stream = io.StringIO()
        progress = progress_module.Progress(
            total, 'test job', stream=stream, min_interval=0, **kwargs
        )
        return progress, stream

    def test_known_total_has_percent_and_eta(self):
        progress, stream = self.make(4)
        progress.start()
        progress.update(2)
        progress.update(4)
        progress.finish()
        lines = stream.getvalue().splitlines()
        self.assertEqual(len(lines), 3)
        self.assertIn('[2/4  50%]', lines[1])
        self.assertIn('left', lines[1])
        self.assertIn('[4/4 100%]', lines[2])
        self.assertIn('done', lines[2])

    def test_unknown_total_has_no_eta(self):
        progress, stream = self.make(None)
        progress.start()
        progress.update(3)
        progress.finish()
        output = stream.getvalue()
        self.assertIn('[3]', output)
        self.assertNotIn('left', output)

    def test_finish_is_idempotent(self):
        progress, stream = self.make(1)
        progress.start()
        progress.advance('one')
        progress.finish()
        progress.finish()
        self.assertEqual(len(stream.getvalue().splitlines()), 2)

    def test_bytes_units(self):
        progress, stream = self.make(2048, unit='bytes')
        progress.start()
        progress.update(2048)
        progress.finish()
        self.assertIn('2.0 KiB/2.0 KiB', stream.getvalue())


if __name__ == '__main__':
    unittest.main()
