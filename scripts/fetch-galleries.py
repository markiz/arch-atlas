import json,pathlib,urllib.parse,urllib.request,time,re,html,concurrent.futures,threading,io
from PIL import Image
root=pathlib.Path(__file__).resolve().parent.parent
rows=json.loads((root/'raw/research-candidates.json').read_text()); entities=json.loads((root/'raw/wikidata-heritage.json').read_text());existing=json.loads((root/'public/atlas/buildings.json').read_text());meta={}; lock=threading.Lock()
headers={'User-Agent':'TbilisiAtlasResearch/0.2 (heritage research; educational project)'}
def getjson(params):
 url='https://commons.wikimedia.org/w/api.php?'+urllib.parse.urlencode(params)
 for n in range(3):
  try:
   with urllib.request.urlopen(urllib.request.Request(url,headers=headers),timeout=45) as r:return json.load(r)
  except Exception as e:
   if n==2:raise
   time.sleep(2+n*3)
def claims(q,k):
 return [x['mainsnak']['datavalue']['value'] for x in entities.get(q,{}).get('claims',{}).get(k,[]) if 'datavalue' in x.get('mainsnak',{})]
def clean(s):return html.unescape(re.sub('<[^>]*>','',s or '')).strip()
def get_info(p):
 try:
  info=p['imageinfo'][0];ex=info['extmetadata'];v=lambda k:clean(ex.get(k,{}).get('value',''))
  lic=v('LicenseShortName');author=v('Artist');lu=v('LicenseUrl');cats=v('Categories').lower()
  if not lic or not author or not lu or 'non-free' in cats or 'copyright violation' in cats:return None
  if not (lic.startswith('CC BY') or lic in ('CC0','Public domain','Public Domain')):return None
  title=p['title']; url=info.get('thumburl') or info.get('url')
  if not url or not re.search(r'\.(jpe?g|png|webp)(\?|$)',url,re.I):return None
  if len(author)>180:author=author.split('\n')[0][:180]
  return {'title':title,'url':url,'author':author,'license':lic,'licenseUrl':lu,'source':info.get('descriptionurl'),'modifications':'уменьшен размер, преобразовано в WebP'}
 except (KeyError,IndexError,TypeError):return None
entries={}
for r in rows:
 q=r['qid']; im=claims(q,'P18');cat=claims(q,'P373');
 entries['osm-'+r['osmId']]={'p18':im[0] if im else None,'category':cat[0] if cat else None,'files':[]}
manual={'opera':'Tbilisi Opera House','writers':"Writers' House of Georgia",'imeli':'IMEL Building, Tbilisi','rustaveli':'Rustaveli Theatre','kashveti':'Kashveti Church','anchiskhati':'Anchiskhati Basilica','sioni':'Sioni Cathedral of Tbilisi','metekhi':'Metekhi church','synagogue':'Great Synagogue of Tbilisi','conservatoire':'Tbilisi State Conservatoire'}
for b in existing:entries[b['id']]={'p18':None,'category':manual[b['id']],'files':[]}
base={'action':'query','format':'json','prop':'imageinfo','iiprop':'url|extmetadata','iiurlwidth':'900'}
# Resolve all first images in batches. Keep the exact original title from Wikidata.
first=[('osm-'+r['osmId'],claims(r['qid'],'P18')[0]) for r in rows if claims(r['qid'],'P18')]
for start in range(0,len(first),30):
 batch=first[start:start+30]
 try:
  j=getjson({**base,'titles':'|'.join('File:'+title for _,title in batch)})
  bytitle={p['title'].replace('_',' '):get_info(p) for p in j.get('query',{}).get('pages',{}).values()}
  for key,title in batch:
   info=bytitle.get(('File:'+title).replace('_',' '))
   if info:entries[key]['files'].append(info)
  print('Wikimedia primary',min(start+30,len(first)),'/',len(first),flush=True)
 except Exception as e:print('primary batch error',e,flush=True)
# Categories are object-specific, rather than broad generic categories.
def category(job):
 key,entry=job;cat=entry.get('category')
 if not cat:return (key,[])
 try:
  j=getjson({**base,'generator':'categorymembers','gcmtitle':'Category:'+cat,'gcmtype':'file','gcmlimit':'12'})
  photos=[]
  for p in j.get('query',{}).get('pages',{}).values():
   info=get_info(p)
   if info and not re.search(r'(logo|stamp|coat of arms|map|plan|seal|portrait|icon|flag)',info['title'],re.I):photos.append(info)
  return(key,photos[:4])
 except Exception as e:return(key,[])
jobs=[x for x in entries.items() if x[1].get('category')]
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
 for i,(key,found) in enumerate(pool.map(category,jobs),1):
  known={x['title'] for x in entries[key]['files']}
  entries[key]['files']+= [x for x in found if x['title'] not in known]
  if i%5==0:print('Wikimedia categories',i,'/',len(jobs),flush=True)
(root/'raw/gallery-research.json').write_text(json.dumps(entries,ensure_ascii=False,indent=2))
# Existing objects keep their current hero, but receive up to two different images.
selected=[]
for key,e in entries.items():
 files=e['files'][:(2 if key not in manual else 2)]
 for i,f in enumerate(files):selected.append((key,i,f))
def download(job):
 key,i,info=job;name=f'{key}-g{i+1}.webp';path=root/'public/atlas/photos'/name
 if path.exists() and path.stat().st_size>64:return(key,i,{'file':'photos/'+name,**{k:v for k,v in info.items() if k not in ('url','title')}})
 try:
  req=urllib.request.Request(info['url'],headers=headers)
  with urllib.request.urlopen(req,timeout=45) as r:raw=r.read()
  im=Image.open(io.BytesIO(raw));im.thumbnail((1000,1000));im.convert('RGB').save(path,'WEBP',quality=73,method=4)
  return(key,i,{'file':'photos/'+name,**{k:v for k,v in info.items() if k not in ('url','title')}})
 except Exception as e:return(key,i,None)
results={}
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
 for idx,(key,i,p) in enumerate(pool.map(download,selected),1):
  if p:results.setdefault(key,[]).append(p)
  if idx%10==0:print('Photos',idx,'/',len(selected),'downloaded',sum(map(len,results.values())),flush=True)
(root/'data/gallery-sources.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
print('Complete',sum(map(len,results.values())),'photos',len(results),'buildings',flush=True)
