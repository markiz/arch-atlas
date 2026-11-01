import json,urllib.parse,urllib.request,re,html,io,time,pathlib,concurrent.futures
from PIL import Image
from atlas_source import FREE_PHOTO_WIDTH, PHOTO_QUALITY, fit_width, read_cards, read_photo_metadata, save_photo
from progress import Progress
root=pathlib.Path(__file__).resolve().parent.parent
cards=read_cards();candidates=json.loads((root/'raw/research-candidates.json').read_text());qmap={'osm-'+c['osmId']:c['qid'] for c in candidates};head={'User-Agent':'TbilisiAtlasResearch/0.2 (architecture research)'}
def fetch(url):
 for attempt in range(2):
  try:
   with urllib.request.urlopen(urllib.request.Request(url,headers=head),timeout=30) as r:return r.read()
  except Exception:
   if attempt==1:raise
   time.sleep(2)
def clean(x):return html.unescape(re.sub('<[^>]*>','',x or '')).strip()
def go(card):
 key=card['id'];q=qmap.get(key,'');current=card.get('photos',[])
 if not q or len(current)>=2:return key,None
 params={'action':'query','format':'json','generator':'search','gsrsearch':f'haswbstatement:P180={q}','gsrnamespace':'6','gsrlimit':'8','prop':'imageinfo','iiprop':'url|extmetadata','iiurlwidth':'1920'}
 try:
  j=json.loads(fetch('https://commons.wikimedia.org/w/api.php?'+urllib.parse.urlencode(params)))
  known={(read_photo_metadata(photo_id) or {}).get('source') for photo_id in current} - {None}
  for page in j.get('query',{}).get('pages',{}).values():
   title=page.get('title','')
   if re.search(r'(logo|stamp|coat of arms|map|plan|seal|portrait|icon|flag|plaque)',title,re.I):continue
   info=page.get('imageinfo',[{}])[0];meta=info.get('extmetadata',{});v=lambda k:clean(meta.get(k,{}).get('value',''))
   author,license,licenseurl=v('Artist'),v('LicenseShortName'),v('LicenseUrl');url=info.get('thumburl');source=info.get('descriptionurl')
   if not (author and license and licenseurl and url and source and source not in known):continue
   if not (license.startswith('CC BY') or license in ('CC0','Public domain','Public Domain')):continue
   if len(author)>180:author=author.split('\n')[0][:180]
   raw=fetch(url);img=Image.open(io.BytesIO(raw));img.thumbnail((1000,1000));photo_id=save_photo(img.convert('RGB'),quality=PHOTO_QUALITY,method=4)
   return key,{'id':photo_id,'author':author,'license':license,'licenseUrl':licenseurl,'source':source,'modifications':'уменьшен размер, преобразовано в WebP'}
 except Exception:return key,None
 return key,None
jobs=[card for card in cards.values() if len(card.get('photos',[]))<2]
found={}
progress=Progress(len(jobs),'search Commons depicts')
progress.start()
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
 for key,p in pool.map(go,jobs):
  if p:found[key]=p
  progress.advance(f'{key}: {"new photo" if p else "no photo"}')
progress.finish()
(root/'data/depicts-photos.json').write_text(json.dumps(found,ensure_ascii=False,indent=2));print('done',len(found),flush=True)
