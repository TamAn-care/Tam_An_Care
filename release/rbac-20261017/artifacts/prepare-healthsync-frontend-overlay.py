from pathlib import Path
import shutil, tarfile, io, json, hashlib

root=Path(__file__).resolve().parents[1]
out=root/'release-proposal/healthsync-frontend-overlay'
if out.exists():shutil.rmtree(out)
shutil.copytree(root/'frontend-healthsync-merge/dist',out/'dist')
(out/'Dockerfile').write_text('''FROM tamancare-health-sync-frontend:v37.4-20261013
LABEL org.tamancare.release-candidate="rbac-frontend-20261017"
COPY dist/ /usr/share/nginx/html/
''')
manifest={'baseImage':'tamancare-health-sync-frontend:v37.4-20261013','expectedBaseImageId':'sha256:7252e1521bcd55a9a5302c5a888169c97574fd19539abe01cb8b8dbb86475aa7','source':'Health Sync frontend source with reviewed RBAC patch','patchedFiles':11,'productionChanged':False,'build':'PASS'}
(out/'overlay-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
archive=io.BytesIO()
with tarfile.open(fileobj=archive,mode='w:gz') as t:
 for p in sorted(out.rglob('*')):
  if p.is_file():t.add(p,arcname=p.relative_to(out).as_posix())
(root/'release-proposal/healthsync-frontend-overlay.tar.gz').write_bytes(archive.getvalue())
print('FRONTEND_OVERLAY_SHA256='+hashlib.sha256(archive.getvalue()).hexdigest())
