from pathlib import Path
import json, shutil, tarfile, io, hashlib

root=Path(__file__).resolve().parents[1]
manifest=json.loads((root/'release-proposal/change-manifest.json').read_text())
out=root/'release-proposal/healthsync-overlay'
if out.exists():shutil.rmtree(out)
(out/'dist').mkdir(parents=True)
modules=[]
changed={item['file'] for item in manifest['files']}
force={'api/src/residents/resident.module.ts'}
for name in sorted(changed|force):
 if not name.startswith('api/src/') or not name.endswith('.ts'):continue
 src=root/'api/dist'/name[len('api/src/'):]
 src=src.with_suffix('.js')
 if not src.is_file():raise SystemExit('MISSING_COMPILED_MODULE '+str(src))
 rel=src.relative_to(root/'api/dist')
 dest=out/'dist'/rel;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(src,dest)
 modules.append({'path':'dist/'+rel.as_posix(),'sha256':hashlib.sha256(dest.read_bytes()).hexdigest()})
deps=root/'api/node_modules'
for package in ['@nestjs/platform-express','multer','proxy-addr','brace-expansion','fast-uri','source-map-js']:
 src=deps/package
 if not src.is_dir():src=root/'frontend/node_modules'/package
 if not src.is_dir():raise SystemExit('MISSING_PATCHED_DEPENDENCY '+str(src))
 dest=out/'deps'/package;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copytree(src,dest,symlinks=False)
dockerfile='''FROM tamancare-health-sync-api:v21.4-20261013
LABEL org.tamancare.release-candidate="rbac-20261017" org.tamancare.base-image-id="sha256:72057c2f6f06070d5ebe7abc09f2402449f9367d348d1496528b6dc345ee9a5c"
COPY dist/ /app/dist/
COPY deps/ /app/node_modules/
'''
(out/'Dockerfile').write_text(dockerfile)
(out/'overlay-manifest.json').write_text(json.dumps({'baseImage':'tamancare-health-sync-api:v21.4-20261013','expectedBaseImageId':'sha256:72057c2f6f06070d5ebe7abc09f2402449f9367d348d1496528b6dc345ee9a5c','modules':modules,'dependencies':['@nestjs/platform-express','multer','proxy-addr','brace-expansion','fast-uri','source-map-js'],'productionChanged':False},indent=2)+'\n')
archive=io.BytesIO()
with tarfile.open(fileobj=archive,mode='w:gz') as tar:
 for p in sorted(out.rglob('*')):
  if p.is_file():tar.add(p,arcname=p.relative_to(out).as_posix())
(root/'release-proposal/healthsync-overlay.tar.gz').write_bytes(archive.getvalue())
print('OVERLAY_MODULES='+str(len(modules)))
print('OVERLAY_SHA256='+hashlib.sha256(archive.getvalue()).hexdigest())
