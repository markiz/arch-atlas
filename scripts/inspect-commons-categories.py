import urllib.request,urllib.parse,json
entries=json.load(open('raw/gallery-research.json')); jobs=[(k,v['files'][0]['title']) for k,v in entries.items() if k.startswith('osm-') and len(v['files'])==1][:30]
params=urllib.parse.urlencode({'action':'query','format':'json','prop':'categories','cllimit':100,'titles':'|'.join(t for k,t in jobs)})
req=urllib.request.Request('https://commons.wikimedia.org/w/api.php?'+params,headers={'User-Agent':'TbilisiAtlasResearch/0.2'});
with urllib.request.urlopen(req,timeout=60) as r:j=json.load(r)
for p in j.get('query',{}).get('pages',{}).values():print('\n',p.get('title'),'|','; '.join(c['title'].removeprefix('Category:') for c in p.get('categories',[]) if not any(x in c['title'] for x in ['licenses','CC-','Self-published','Files with','Media with','Wikidata'])),flush=True)
