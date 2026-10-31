import json,urllib.parse,urllib.request,re,html,io,time,pathlib,concurrent.futures
from PIL import Image
root=pathlib.Path(__file__).resolve().parent.parent
extra=json.loads((root/'data/heritage-extra.json').read_text());candidates=json.loads((root/'raw/research-candidates.json').read_text());qmap={'osm-'+c['osmId']:c['qid'] for c in candidates};gals=json.loads((root/'data/gallery-sources.json').read_text());head={'User-Agent':'TbilisiAtlasResearch/0.2 (architecture research)'}
def fetch(url):
 for attempt in range(2):
  try:
   with urllib.request.urlopen(urllib.request.Request(url,headers=head),timeout=30) as r:return r.read()
  except Exception:
   if attempt==1:raise
   time.sleep(2)
def clean(x):return html.unescape(re.sub('<[^>]*>','',x or '')).strip()
def go(b):
 key=b['id'];q=qmap.get(key,'');current=gals.get(key,[])
 if not q or len(current)>=2:return key,None
 params={'action':'query','format':'json','generator':'search','gsrsearch':f'haswbstatement:P180={q}','gsrnamespace':'6','gsrlimit':'8','prop':'imageinfo','iiprop':'url|extmetadata','iiurlwidth':'900'}
 try:
  j=json.loads(fetch('https://commons.wikimedia.org/w/api.php?'+urllib.parse.urlencode(params)))
  known={p['source'] for p in current}
  for page in j.get('query',{}).get('pages',{}).values():
   title=page.get('title','')
   if re.search(r'(logo|stamp|coat of arms|map|plan|seal|portrait|icon|flag|plaque)',title,re.I):continue
   info=page.get('imageinfo',[{}])[0];meta=info.get('extmetadata',{});v=lambda k:clean(meta.get(k,{}).get('value',''))
   author,license,licenseurl=v('Artist'),v('LicenseShortName'),v('LicenseUrl');url=info.get('thumburl');source=info.get('descriptionurl')
   if not (author and license and licenseurl and url and source and source not in known):continue
   if not (license.startswith('CC BY') or license in ('CC0','Public domain','Public Domain')):continue
   if len(author)>180:author=author.split('\n')[0][:180]
   raw=fetch(url);img=Image.open(io.BytesIO(raw));img.thumbnail((1000,1000));name=key+'-depicts.webp';img.convert('RGB').save(root/'public/atlas/photos'/name,'WEBP',quality=73,method=4)
   return key,{'file':'photos/'+name,'author':author,'license':license,'licenseUrl':licenseurl,'source':source,'modifications':'уменьшен размер, преобразовано в WebP'}
 except Exception:return key,None
 return key,None
jobs=[b for b in extra if len(gals.get(b['id'],[]))<2]
found={}
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
 for i,(key,p) in enumerate(pool.map(go,jobs),1):
  if p:found[key]=p
  if i%10==0:print('Depicts searched',i,'/',len(jobs),'new photos',len(found),flush=True)
(root/'data/depicts-photos.json').write_text(json.dumps(found,ensure_ascii=False,indent=2));print('done',len(found),flush=True)
