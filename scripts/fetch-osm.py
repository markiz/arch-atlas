import concurrent.futures, pathlib, urllib.request, urllib.parse, time, json
root=pathlib.Path(__file__).resolve().parent.parent
jobs=[]
for i in range(4):
 for j in range(4):
  l=44.783+i*.007; b=41.687+j*.006
  jobs.append((f'grid-{i}-{j}',(l,b,l+.007,b+.006)))
def get(job):
 name,box=job; path=root/'raw'/f'osm-{name}.xml'
 if path.exists() and path.stat().st_size>1000:return (name,'cached',path.stat().st_size)
 url='https://api.openstreetmap.org/api/0.6/map?'+urllib.parse.urlencode({'bbox':','.join(f'{x:.6f}' for x in box)})
 try:
  req=urllib.request.Request(url,headers={'User-Agent':'TbilisiArchitectureAtlas/0.1 (research prototype)'})
  with urllib.request.urlopen(req,timeout=60) as res: data=res.read()
  path.write_bytes(data);return (name,'ok',len(data))
 except Exception as e:return(name,str(e),0)
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
 for value in pool.map(get,jobs):print(*value,flush=True)
