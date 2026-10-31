import json,datetime,re,sys
from pathlib import Path
sys.path.insert(0,'.deps')
from shapely.geometry import Polygon
root=Path(__file__).resolve().parent.parent
candidates=json.loads((root/'raw/research-candidates.json').read_text()); entities=json.loads((root/'raw/wikidata-heritage.json').read_text());orig=json.loads((root/'public/atlas/buildings.json').read_text())
galleries=json.loads((root/'data/gallery-sources.json').read_text()) if (root/'data/gallery-sources.json').exists() else {}
already={b.get('osmId','').split('/')[-1] for b in orig if not b['id'].startswith('osm-')}
styles={'art_nouveau':'Модерн','neo-baroque':'Необарокко','neo-gothic':'Неоготика','neoclassicism':'Неоклассицизм','stalinist_neoclassicism':'Советский неоклассицизм','moorish_revival':'Неомавританский стиль','empire':'Ампир','constructivism':'Конструктивизм','byzantine':'Византийский стиль','islamic':'Исламская архитектура'}
def vals(ent,key):
 return [x['mainsnak']['datavalue']['value'] for x in ent.get('claims',{}).get(key,[]) if 'datavalue' in x.get('mainsnak',{}) and x.get('rank')!='deprecated']
def get_year(t,e):
 start=t.get('start_date','');m=re.fullmatch(r'(1[0-9]{3}|20[0-9]{2})(?:-\d\d(?:-\d\d)?)?',start)
 if m:
  year=int(m.group(1));return year,year,str(year)
 values=vals(e,'P571')
 for value in values:
  if isinstance(value,dict) and 'time' in value:
   m=re.match(r'^\+0*(\d{3,4})-',value['time']);prec=value.get('precision',0)
   if m and int(m.group(1))>300 and prec>=9:
    y=int(m.group(1));return y,y,str(y)
 return None,None,'Не установлена'
def label(e,language):return e.get('labels',{}).get(language,{}).get('value','')
extras=[]
for c in candidates:
 if c['osmId'] in already:continue
 t=c['tags'];q=c['qid'];e=entities.get(q,{});p=Polygon(c['coordinates'])
 if not p.is_valid or p.is_empty or p.area<=0:continue
 street=t.get('addr:street','');number=t.get('addr:housenumber','');address=' '.join(x for x in (street,number) if x) or 'Адрес уточняется'
 ru=t.get('name:ru') or label(e,'ru');ka=t.get('name:ka') or t.get('name') or label(e,'ka');en=t.get('name:en') or label(e,'en')
 name=ru or (f'Историческое здание · {address}' if address!='Адрес уточняется' else ka or en or f'Историческое здание · OSM {c["osmId"]}')
 sy=t.get('building:architecture','').split(';');sty=', '.join(styles[x] for x in sy if x in styles) or 'Не определён'
 year1,year2,yearLabel=get_year(t,e)
 justification='В OpenStreetMap объект отмечен как памятник культурного наследия.' if t.get('heritage') else 'В OpenStreetMap объект отмечен как историческое здание.'
 point=p.representative_point();id='osm-'+c['osmId'];photos=galleries.get(id,[])
 record={'id':id,'name':name,'nameKa':ka,'nameEn':en,'address':address,'district':'Тбилиси','minYear':year1,'maxYear':year2,'yearLabel':yearLabel,'architects':[t['architect']] if t.get('architect') else [],'style':sty,'description':justification,'history':'Сведения получены из открытых данных и требуют редакционной проверки.','coordinates':[round(point.x,7),round(point.y,7)],'photos':photos,'source':'https://www.openstreetmap.org/way/'+c['osmId'],'geometry':{'type':'Polygon','coordinates':[c['coordinates']]},'geometryQuality':'Контур OpenStreetMap; данные требуют редакционной проверки','osmId':'way/'+c['osmId']}
 if q:record['otherSource']='https://www.wikidata.org/wiki/'+q
 extras.append(record)
# Prefer items with attributable photographs and named sites. Keep 90 distinct additions.
extras.sort(key=lambda r:(-int(bool(r['photos'])),-int(not r['name'].startswith('Историческое здание')),r['id']))
extras=extras[:90]
if len(extras)<90:print('WARNING only',len(extras),'eligible extras')
(root/'data/heritage-extra.json').write_text(json.dumps(extras,ensure_ascii=False,separators=(',',':')))
print('extra',len(extras),'with photos',sum(bool(x['photos']) for x in extras),'two photos',sum(len(x['photos'])>1 for x in extras),'dates',sum(x['minYear']!=None for x in extras))
