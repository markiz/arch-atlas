import json, pathlib, urllib.request, urllib.parse, re, html, concurrent.futures, time
from PIL import Image
from atlas_source import save_photo
from progress import Progress
ROOT=pathlib.Path(__file__).resolve().parent.parent
HEAD={'User-Agent':'TbilisiArchitectureAtlas/0.1 (personal educational prototype)'}
ARTICLES={
'opera':'Georgian National Opera Theater',
'writers':'Writers\' House of Georgia',
'imeli':'IMELI Building',
'parliament':'Georgian Parliament Building (Tbilisi)',
'assembly':'Tbilisi Assembly Building',
'rustaveli':'Rustaveli Theatre',
'kashveti':'Kashveti Church',
'university':'Tbilisi State University',
'museum':'Georgian National Museum',
'anchiskhati':'Anchiskhati Basilica',
'sioni':'Sioni Cathedral',
'metekhi':'Metekhi church',
'narikala':'Narikala',
'blue-monastery':'Blue Monastery, Tbilisi',
}
def read(url):
 req=urllib.request.Request(url,headers=HEAD)
 with urllib.request.urlopen(req,timeout=45) as r:return r.read()
def clean(s): return html.unescape(re.sub('<[^>]*>','',s or '')).strip()
progress = Progress(len(ARTICLES), 'fetch Wikipedia/Commons')

def get(item):
 key,title=item
 try:
  url='https://en.wikipedia.org/api/rest_v1/page/summary/'+urllib.parse.quote(title.replace(' ','_'),safe='')
  wiki=json.loads(read(url)); (ROOT/'raw'/f'{key}.json').write_text(json.dumps(wiki,ensure_ascii=False,indent=2))
  thumb=wiki.get('originalimage',wiki.get('thumbnail',{})).get('source','')
  if '/commons/' not in thumb:return {'id':key,'error':'no Commons photo','coordinates':wiki.get('coordinates'),'title':wiki.get('title')}
  # The source contains the original Commons filename before the generated thumbnail name.
  parts=urllib.parse.urlparse(thumb).path.split('/')
  filename=urllib.parse.unquote(parts[-2] if 'thumb' in parts else parts[-1])
  params=urllib.parse.urlencode({'action':'query','format':'json','prop':'imageinfo','iiprop':'url|extmetadata','iiurlwidth':'1000','titles':'File:'+filename})
  commons=json.loads(read('https://commons.wikimedia.org/w/api.php?'+params))
  page=next(iter(commons['query']['pages'].values())); info=page['imageinfo'][0]; meta=info.get('extmetadata',{})
  val=lambda k:clean(meta.get(k,{}).get('value',''))
  license=val('LicenseShortName'); artist=val('Artist'); licenseurl=val('LicenseUrl')
  if not license or not artist or not licenseurl:return {'id':key,'error':'license or author missing','coordinates':wiki.get('coordinates'),'title':wiki.get('title'),'photo':filename}
  imgurl=info.get('thumburl',info.get('url'))
  img=read(imgurl); temp=ROOT/'raw'/f'{key}.image';temp.write_bytes(img)
  im=Image.open(temp);im.thumbnail((1100,1100));relative=save_photo(im.convert('RGB'),key,quality=78,method=5);temp.unlink()
  result={'id':key,'title':wiki.get('title'),'coordinates':wiki.get('coordinates'),'wiki':wiki.get('content_urls',{}).get('desktop',{}).get('page'),'photo':{'file':relative,'author':artist,'license':license,'licenseUrl':licenseurl,'source':info.get('descriptionurl'),'modifications':'уменьшен размер, преобразовано в WebP'},'extract':wiki.get('extract','')}
  return result
 except Exception as e: return {'id':key,'error':str(e)}
def tracked(item):
 result=get(item)
 progress.advance(f"{result['id']}: {result.get('error','ok')}")
 return result

progress.start()
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:
 results=list(ex.map(tracked,ARTICLES.items()))
progress.finish()
(ROOT/'raw'/'wikimedia-results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
for r in results: print(r['id'], r.get('coordinates'),r.get('error','ok'), flush=True)
