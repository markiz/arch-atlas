import json, glob, xml.etree.ElementTree as ET, pathlib, re, urllib.parse, urllib.request, time, math
root=pathlib.Path(__file__).resolve().parent.parent
nodes={}; ways={}; relations={}
for path in sorted((root/'raw').glob('osm-grid-*.xml')):
 d=ET.parse(path).getroot()
 for n in d.findall('node'): nodes[n.get('id')]=[float(n.get('lon')),float(n.get('lat'))]
 for w in d.findall('way'):
  tags={t.get('k'):t.get('v') for t in w.findall('tag')};refs=[n.get('ref') for n in w.findall('nd')]
  ways[w.get('id')]={'tags':tags,'refs':refs}
 for r in d.findall('relation'):
  relations[r.get('id')]={'tags':{t.get('k'):t.get('v') for t in r.findall('tag')},'members':[(m.get('type'),m.get('ref'),m.get('role')) for m in r.findall('member')]}
items=[]
for wid,w in ways.items():
 t=w['tags']; coords=[nodes[x] for x in w['refs'] if x in nodes]
 if not t.get('building') or len(coords)<4 or coords[0]!=coords[-1] or len(coords)!=len(w['refs']):continue
 if t.get('heritage') not in ('1','2','3') and not (t.get('historic') in ('house','building','church','castle','caravanserai','hotel','monastery') and (t.get('wikidata') or t.get('name:ru'))):continue
 if t.get('building') in ('roof','construction','garage'):continue
 # Discard minor additions and interior fragments.
 if t.get('building:part') and t.get('building')=='part':continue
 q=t.get('wikidata','');
 items.append({'osmId':wid,'tags':t,'coordinates':coords,'qid':q if re.fullmatch(r'Q[0-9]+',q) else ''})
print('Candidates:',len(items), 'Wikidata:',sum(bool(x['qid']) for x in items),flush=True)
(root/'raw/research-candidates.json').write_text(json.dumps(items,ensure_ascii=False))
qs=list(dict.fromkeys(x['qid'] for x in items if x['qid']))
headers={'User-Agent':'TbilisiAtlasResearch/0.2 (heritage research)'};allq={}
for start in range(0,len(qs),25):
 ids=qs[start:start+25];params=urllib.parse.urlencode({'action':'wbgetentities','ids':'|'.join(ids),'props':'labels|claims|sitelinks','languages':'ru|ka|en','format':'json'})
 for attempt in range(3):
  try:
   req=urllib.request.Request('https://www.wikidata.org/w/api.php?'+params,headers=headers)
   with urllib.request.urlopen(req,timeout=60) as r:j=json.load(r)
   allq.update(j.get('entities',{}));print('wikidata',len(allq),'/',len(qs),flush=True);break
  except Exception as e:
   print('Retry:',e,flush=True);time.sleep(2+attempt*3)
(root/'raw/wikidata-heritage.json').write_text(json.dumps(allq,ensure_ascii=False))
