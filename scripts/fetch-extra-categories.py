import json,urllib.request,urllib.parse,concurrent.futures,io,re,html,time
from pathlib import Path
from PIL import Image
from atlas_source import FREE_PHOTO_WIDTH, PHOTO_QUALITY, fit_width, save_photo
from progress import Progress
root=Path(__file__).resolve().parent.parent
research=json.loads((root/'raw/research/gallery-research.json').read_text());gals=json.loads((root/'data/gallery-sources.json').read_text());
known={
 'File:43-ე საჯრო სკოლა 01.jpg':'Former Trade School of the Tiflis Merchant Society building',
 'File:Giorgi Atoneli street 27 (2).jpg':'27 Giorgi Atoneli Street, Tbilisi',
 'File:Lado Asatiani Str 58.png':'58 Lado Asatiani Street, Tbilisi',
 'File:Ministry of Foreign Affairs of Georgia.png':'Former Transcaucasian Institute for Noble Maidens building',
 'File:Museum - National.jpg':'Former Tiflis Theological Seminary building at Pushkin Street',
 'File:Old part of Tbilisi.jpg':'Ter-Akopova House',
 'File:Revaz Tabukashvili street 42.jpg':'42 Revaz Tabukashvili Street, Tbilisi',
 'File:River View.jpg':'2 Dimitri Uznadze Street, Tbilisi',
 'File:Tbilisi (3231502008).jpg':'26 Lado Asatiani Street, Tbilisi'}
jobs=[]
for k,v in research.items():
 if not k.startswith('osm-') or len(gals.get(k,[]))>=2:continue
 for f in v['files']:
  if f['title'] in known:jobs.append((k,known[f['title']]));break
print('extra categories',len(jobs),flush=True)
h={'User-Agent':'TbilisiAtlasResearch/0.2 (educational prototype)'}
def get(url):
 with urllib.request.urlopen(urllib.request.Request(url,headers=h),timeout=40) as r:return r.read()
def clean(v):return html.unescape(re.sub('<[^>]*>','',v or '')).strip()
def go(job):
 key,category=job
 try:
  p={'action':'query','format':'json','generator':'categorymembers','gcmtitle':'Category:'+category,'gcmtype':'file','gcmlimit':'15','prop':'imageinfo','iiprop':'url|extmetadata','iiurlwidth':'1920'}
  j=json.loads(get('https://commons.wikimedia.org/w/api.php?'+urllib.parse.urlencode(p)))
  old={x['source'] for x in gals.get(key,[])}
  for page in j.get('query',{}).get('pages',{}).values():
   if re.search(r'(logo|stamp|coat of arms|map|plan|seal|portrait|icon|flag|plaque)',page.get('title',''),re.I):continue
   info=page['imageinfo'][0];meta=info['extmetadata'];v=lambda k:clean(meta.get(k,{}).get('value',''))
   author,license,licenseurl=v('Artist'),v('LicenseShortName'),v('LicenseUrl');source=info.get('descriptionurl');url=info.get('thumburl')
   if not (author and license and licenseurl and url and source and source not in old):continue
   if not (license.startswith('CC BY') or license in ('CC0','Public domain','Public Domain')):continue
   if len(author)>180:author=author.split('\n')[0][:180]
   im=Image.open(io.BytesIO(get(url)));im=fit_width(im, FREE_PHOTO_WIDTH);relative=save_photo(im.convert('RGB'),key,quality=PHOTO_QUALITY,method=4)
   return key,{'file':relative,'author':author,'license':license,'licenseUrl':licenseurl,'source':source,'modifications':'уменьшен размер, преобразовано в WebP'}
 except Exception as e:print('error',key,str(e),flush=True)
 return key,None
progress=Progress(len(jobs),'fetch Commons categories')
progress.start()
def tracked(job):
 key,photo=go(job)
 progress.advance(f'{key}: {"new photo" if photo else "no photo"}')
 return key,photo
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:out={k:v for k,v in pool.map(tracked,jobs) if v}
progress.finish()
(root/'data/category-extra-photos.json').write_text(json.dumps(out,ensure_ascii=False,indent=2));print('additional',len(out),flush=True)
