"""Build a portable demo from reviewed explicit inputs, never from a directory glob."""
from pathlib import Path, PurePosixPath
import argparse
import hashlib
import json
import re
import tempfile
import zipfile
from html.parser import HTMLParser

ROOT = Path(__file__).resolve().parents[1]
INPUTS = {
    'index.html':'web/index.html', 'style.css':'web/style.css', 'core.js':'web/core.js',
    'demo-bank.js':'web/demo-bank.js', 'app.js':'web/app.js', 'mark.svg':'web/mark.svg',
    'question-bank.example.json':'banks/demo.json', 'README.md':'docs/DEMO_README.md',
    'LICENSE':'LICENSE', 'NOTICE':'NOTICE', 'COMMERCIAL_LICENSE.md':'COMMERCIAL_LICENSE.md',
    'serve.py':'tools/serve.py',
}

def digest(data): return hashlib.sha256(data).hexdigest()

def verify(data):
    assert set(data) == set(INPUTS)
    assert all(not PurePosixPath(name).is_absolute() and '..' not in PurePosixPath(name).parts for name in data)
    class References(HTMLParser):
        def handle_starttag(self, tag, attrs):
            for key,value in attrs:
                if key in {'src','href'} and value and not value.startswith(('https://','#','data:')):
                    assert value in data, 'Missing runtime resource'
    References().feed(data['index.html'].decode('utf-8'))
    for name,content in data.items():
        text=content.decode('utf-8')
        assert not re.search(r'(?i)[A-Z]:[\\/](?:Users|Codex Projects)[\\/]|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----', text), 'Private path/key marker'
        assert not re.search(r'\b(?:gh[pousr]_[A-Za-z0-9]{25,}|github_pat_[A-Za-z0-9_]{30,}|sk-proj-[A-Za-z0-9_-]{20,})\b',text), 'Credential pattern'

def build(output):
    version=json.loads((ROOT/'package.json').read_text(encoding='utf-8'))['version']
    assert re.fullmatch(r'\d+\.\d+\.\d+(?:-[a-z0-9.]+)?',version)
    data={name:(ROOT/source).read_bytes().replace(b'\r\n',b'\n') for name,source in INPUTS.items()}
    verify(data)
    data['SHA256SUMS.txt']=''.join(digest(data[name])+'  '+name+'\n' for name in sorted(data)).encode()
    output=Path(output); output.mkdir(parents=True,exist_ok=True)
    target=output/('living-room-study-'+version+'-demo.zip')
    handle=tempfile.NamedTemporaryFile(prefix='reviewed-demo-',suffix='.tmp',dir=output,delete=False)
    pending=Path(handle.name);handle.close()
    with zipfile.ZipFile(pending,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as archive:
        for name,content in sorted(data.items()):
            info=zipfile.ZipInfo(name,date_time=(2026,1,1,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED
            info.create_system=3;info.external_attr=0o100644<<16
            archive.writestr(info,content)
    with zipfile.ZipFile(pending) as archive:
        assert archive.testzip() is None
        assert set(archive.namelist())==set(data) and len(archive.namelist())==len(data)
        assert all(archive.read(name)==content for name,content in data.items())
    pending.replace(target)
    report={'file':target.name,'bytes':target.stat().st_size,'sha256':digest(target.read_bytes()),'files':len(data),'checks':['explicit-inputs','utf8','runtime-references','generic-private-patterns','zip-entries','crc','byte-equality','sha256sums']}
    Path(str(target)+'.sha256').write_text(report['sha256']+'  '+target.name+'\n',encoding='utf-8')
    (output/'package-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    return report

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--output',type=Path,default=ROOT/'dist')
    print(json.dumps(build(parser.parse_args().output),ensure_ascii=False))
