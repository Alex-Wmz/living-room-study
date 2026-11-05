import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import zipfile

SOURCE=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('study_release_builder',SOURCE/'tools/build_release.py')
builder=importlib.util.module_from_spec(spec);spec.loader.exec_module(builder)

class ReviewedReleaseTest(unittest.TestCase):
    def test_actual_zip_excludes_unknown_private_and_build_files(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp)/'source';root.mkdir()
            for relative in [*builder.INPUTS.values(),'package.json']:
                target=root/relative;target.parent.mkdir(parents=True,exist_ok=True)
                target.write_bytes((SOURCE/relative).read_bytes())
            (root/'web/ignored.private.json').write_text('{"value":"synthetic-only"}',encoding='utf-8')
            (root/'.env').write_text('SYNTHETIC_EXAMPLE=not-a-credential',encoding='utf-8')
            with patch.object(builder,'ROOT',root):report=builder.build(Path(temp)/'out')
            with zipfile.ZipFile(Path(temp)/'out'/report['file']) as archive:
                self.assertEqual(set(archive.namelist()),set(builder.INPUTS)|{'SHA256SUMS.txt'})
                self.assertEqual(archive.read('LICENSE'),(SOURCE/'LICENSE').read_bytes())
                self.assertEqual(json.loads(archive.read('question-bank.example.json')),json.loads((SOURCE/'banks/demo.json').read_text(encoding='utf-8')))
                for line in archive.read('SHA256SUMS.txt').decode().splitlines():
                    sha,name=line.split('  ',1);self.assertEqual(builder.digest(archive.read(name)),sha)
                unpacked=Path(temp)/'unpacked';unpacked.mkdir();archive.extractall(unpacked)
                runtime_spec=importlib.util.spec_from_file_location('unpacked_demo_server',unpacked/'serve.py')
                runtime=importlib.util.module_from_spec(runtime_spec);runtime_spec.loader.exec_module(runtime)
                self.assertEqual(runtime.ROOT,unpacked)
    def test_same_inputs_make_identical_runtime_archives(self):
        with tempfile.TemporaryDirectory() as temp:
            a=builder.build(Path(temp)/'a');b=builder.build(Path(temp)/'b')
            self.assertEqual(a['sha256'],b['sha256'])

if __name__=='__main__':unittest.main()
