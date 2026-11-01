import xml.etree.ElementTree as ET, pathlib, json, math
import re
from progress import Progress
root=pathlib.Path(__file__).resolve().parent.parent
landmark_names=json.loads((root/'data/landmark-name-translations.json').read_text())
curated_name_variants=json.loads((root/'data/basemap-name-translations.json').read_text()) if (root/'data/basemap-name-translations.json').exists() else {}
landmark_cards={}
landmark_cards_dir=root/'data/landmarks/tbilisi'
if landmark_cards_dir.exists():
 for card_path in sorted(landmark_cards_dir.glob('*.json')):
  try: card=json.loads(card_path.read_text())
  except Exception: continue
  if card.get('osmId') and card.get('names'):landmark_cards[card['osmId']]=card
nodes={};node_tags={};ways={};relations={}
paths=sorted((root/'raw').glob('osm-grid-*.xml'))
parse_progress=Progress(len(paths),'parse OSM XML')
parse_progress.start()
for path in paths:
 try: doc=ET.parse(path).getroot()
 except Exception:
  parse_progress.advance(path.name)
  continue
 for node in doc.findall('node'):
  nodes[node.attrib['id']]=[round(float(node.attrib['lon']),6),round(float(node.attrib['lat']),6)]
  node_tags[node.attrib['id']]={t.attrib['k']:t.attrib['v'] for t in node.findall('tag')}
 for way in doc.findall('way'):
  ways[way.attrib['id']]={'refs':[n.attrib['ref'] for n in way.findall('nd')], 'tags':{t.attrib['k']:t.attrib['v'] for t in way.findall('tag')}}
 for relation in doc.findall('relation'):
  relations[relation.attrib['id']]={'members':[(m.attrib.get('type'),m.attrib.get('ref'),m.attrib.get('role')) for m in relation.findall('member')], 'tags':{t.attrib['k']:t.attrib['v'] for t in relation.findall('tag')}}
 parse_progress.advance(path.name)
parse_progress.finish()
features=[]
def landmark(tags):
 if tags.get('tourism')=='museum' or tags.get('amenity')=='museum':return 'museum'
 if tags.get('historic') in ('castle','fort','fortress'):return 'castle'
 if tags.get('amenity')=='place_of_worship' or tags.get('building') in ('church','chapel','cathedral'):return 'church'
 return None
def ukrainian_name(value):
 replacements=[('доходный дом','прибутковий будинок'),('переулок','провулок'),('улица','вулиця'),('набережная','набережна'),('площадь','площа'),('проспект','проспект'),('мост','міст'),('бывший','колишній'),('бывшая','колишня'),('бывшее','колишня'),('писателей','письменників'),('писателя','письменника'),('Грузии','Грузії'),('Тбилиси','Тбілісі'),('Руставели','Руставелі'),('Кашвети','Кашветі'),('Анчисхати','Анчисхаті'),('Сиони','Сіоні'),('Гаприндашвили','Гаприндашвілі'),('Габашвили','Габашвілі'),('Одишвили','Одішвілі'),('Чавчавадзе','Чавчавадзе'),('Мтацминда','Мтацмінда'),('ул.','вул.'),('пр-т','просп.'),('пер.','пров.'),('пл.','пл.'),('бульвар','бульвар'),('тупик','тупик'),('проезд','проїзд'),('шоссе','шосе'),('дом','будинок'),('здание','будівля'),('церковь','церква'),('храм','храм'),('собор','собор'),('базилика','базиліка'),('музей','музей'),('театр','театр'),('школа','школа'),('баня','лазня'),('бани','лазні'),('дворец','палац'),('караван-сарай','караван-сарай')]
 replacements.extend([('бывшее здание','колишня будівля'),('духовной семинарии','духовної семінарії'),('бывший пансион','колишній пансіон'),('благородных девиц','шляхетних дівчат'),('писателей','письменників'),('Грузинского Оружия','грузинської зброї'),('Грузии','Грузії'),('Тбилисский','Тбіліський'),('Тбилисская','Тбіліська'),('Тбилисской','Тбіліської'),('Тбилисского','Тбіліського'),('имени','імені'),('синий','синій'),('Пёстрая','строката'),('Евангелиста','Євангеліста'),('монастырь','монастир'),('Мелик-Азарянца','Мелік-Азарянця'),('Татищева','Татіщева'),('Гаприндашвили','Гаприндашвілі'),('Габашвили','Габашвілі'),('Марджанишвили','Марджанішвілі'),('Чавчанидзе','Чавчанідзе'),('Бебутовых','Бебутових'),('Орбелиани','Орбеліані'),('Анчисхати','Анчисхаті'),('Кашвети','Кашветі'),('Сиони','Сіоні'),('отель','готель'),('кинотеатр','кінотеатр'),('торговая школа','торгова школа'),('закавказского','закавказького'),('купеческого общества','купецького товариства')])
 for source,target in sorted(replacements,key=lambda pair:-len(pair[0])):
  value=re.sub(r'(?<!\w)'+re.escape(source)+r'(?!\w)',lambda match:target.capitalize() if match.group(0)[0].isupper() else target,value,flags=re.IGNORECASE)
 # Ukrainian spelling for remaining Russian Cyrillic letters; Georgian names
 # already have a Russian OSM form in almost all mapped features.
 chars={'а':'а','б':'б','в':'в','г':'г','д':'д','е':'е','ё':'йо','ж':'ж','з':'з','и':'и','й':'й','к':'к','л':'л','м':'м','н':'н','о':'о','п':'п','р':'р','с':'с','т':'т','у':'у','ф':'ф','х':'х','ц':'ц','ч':'ч','ш':'ш','щ':'щ','ъ':'','ы':'и','ь':'ь','э':'е','ю':'ю','я':'я','ґ':'ґ','і':'і','ї':'ї','є':'є'}
 return ''.join(chars.get(char.lower(),char).upper() if char.isupper() and char.lower() in chars else chars.get(char.lower(),char) for char in value)
def georgian_label(value,language):
 latin={'ა':'a','ბ':'b','გ':'g','დ':'d','ე':'e','ვ':'v','ზ':'z','თ':'t','ი':'i','კ':'k','ლ':'l','მ':'m','ნ':'n','ო':'o','პ':'p','ჟ':'zh','რ':'r','ს':'s','ტ':'t','უ':'u','ფ':'p','ქ':'k','ღ':'gh','ყ':'q','შ':'sh','ჩ':'ch','ც':'ts','ძ':'dz','წ':'ts','ჭ':'ch','ხ':'kh','ჯ':'j','ჰ':'h'}
 russian={'ა':'а','ბ':'б','გ':'г','დ':'д','ე':'е','ვ':'в','ზ':'з','თ':'т','ი':'и','კ':'к','ლ':'л','მ':'м','ნ':'н','ო':'о','პ':'п','ჟ':'ж','რ':'р','ს':'с','ტ':'т','უ':'у','ფ':'ф','ქ':'к','ღ':'г','ყ':'к','შ':'ш','ჩ':'ч','ც':'ц','ძ':'дз','წ':'ц','ჭ':'ч','ხ':'х','ჯ':'дж','ჰ':'х'}
 ukr={'ა':'а','ბ':'б','გ':'г','დ':'д','ე':'е','ვ':'в','ზ':'з','თ':'т','ი':'і','კ':'к','ლ':'л','მ':'м','ნ':'н','ო':'о','პ':'п','ჟ':'ж','რ':'р','ს':'с','ტ':'т','უ':'у','ფ':'ф','ქ':'к','ღ':'г','ყ':'к','შ':'ш','ჩ':'ч','ც':'ц','ძ':'дз','წ':'ц','ჭ':'ч','ხ':'х','ჯ':'дж','ჰ':'г'}
 endings=[('სახლ-მუზეუმი',('House Museum','дом-музей','будинок-музей')),('მუზეუმი',('Museum','музей','музей')),('შესახვევი',('Lane','переулок','провулок')),('ქუჩა',('Street','улица','вулиця')),('გამზირი',('Avenue','проспект','проспект')),('აღმართი',('Ascent','подъём','підйом')),('გასასვლელი',('Passage','проезд','проїзд')),('ჩიხი',('Dead End','тупик','тупик')),('ხიდი',('Bridge','мост','міст')),('მოედანი',('Square','площадь','площа')),('სამრეკლო',('Bell Tower','колокольня','дзвіниця')),('სამლოცველო',('Chapel','часовня','каплиця')),('ეკლესია',('Church','церковь','церква')),('ტაძარი',('Cathedral','собор','собор')),('ბაზილიკა',('Basilica','базилика','базиліка')),('დარბაზი',('Hall','зал','зала')),('ქარვასლა',('Caravanserai','караван-сарай','караван-сарай')),('აბანო',('Bath','баня','лазня')),('სასახლე',('Palace','дворец','палац')),('სკოლა',('School','школа','школа')),('კონსერვატორია',('Conservatoire','консерватория','консерваторія'))]
 core=value.strip();suffix=''
 for ending,translations in endings:
  if core.endswith(ending):core=core[:-len(ending)].strip();suffix=translations[{'en':0,'ru':1,'uk':2}[language]];break
 table={'en':latin,'ru':russian,'uk':ukr}[language]
 transliterated=''.join(table.get(char,char) for char in core)
 if language=='en':transliterated=transliterated.title()
 return (transliterated+' '+suffix).strip()
def name_candidates(tags):
 values=[]
 for key in ('name:ka','name','name:ru','name:en','name:uk'):
  value=tags.get(key)
  if value and value not in values:values.append(value)
 return values
def apply_landmark_card(props,osm_id):
 card=landmark_cards.get(osm_id)
 if not card:return props
 names=card.get('names') or {}
 if all(names.get(language) for language in ('ru','en','ka','uk')):
  props['names']={language:names[language] for language in ('ru','en','ka','uk')}
  props['name']=props['names']['ru']
 return props
def translated_names(tags):
 candidates=name_candidates(tags)
 for source in candidates:
  if source in curated_name_variants:
   return {'originalLanguage':'ka','names':curated_name_variants[source]}
 original=tags.get('name:ka') or (tags.get('name') if re.search('[\\u10a0-\\u10ff]',tags.get('name','')) else '') or tags.get('name:ru') or tags.get('name:en') or tags.get('name') or ''
 original_language='ka' if re.search('[\\u10a0-\\u10ff]',original) else ('en' if tags.get('name:en') else 'ru')
 is_georgian=bool(re.search('[\\u10a0-\\u10ff]',original))
 names={'ru':tags.get('name:ru') or (georgian_label(original,'ru') if is_georgian else tags.get('name') or original),
        'en':tags.get('name:en') or (georgian_label(original,'en') if is_georgian else tags.get('name') or tags.get('name:ru') or original),
        'ka':tags.get('name:ka') or (tags.get('name') if re.search('[\\u10a0-\\u10ff]',tags.get('name','')) else original),
        'uk':tags.get('name:uk') or (georgian_label(original,'uk') if is_georgian else ukrainian_name(tags.get('name:ru') or tags.get('name') or original))}
 # Editorial translations override OSM tags for landmarks; values are objects
 # with all four languages. Older string values are treated as Russian-only.
 for source in candidates:
  entry=landmark_names.get(source)
  if not entry:continue
  if isinstance(entry,str):entry={'ru':entry}
  for language,value in entry.items():
   if language in names and isinstance(value,str) and value.strip():names[language]=value
  break
 return {'originalLanguage':original_language,'names':names}
node_progress=Progress(len(node_tags),'scan landmark nodes')
node_progress.start()
for index,(nid,tags) in enumerate(node_tags.items(),1):
 if index%1000==0:node_progress.update(index,f'{len(features)} features')
 category=landmark(tags)
 if category:
  props={'kind':'landmark','category':category,'osmId':f'node/{nid}'};props.update(translated_names(tags));props=apply_landmark_card(props,f'node/{nid}');name=props['names']['ru']
  if name:props['name']=name
  if not name:continue
  features.append({'type':'Feature','properties':props,'geometry':{'type':'Point','coordinates':nodes[nid]}})
node_progress.finish()
for rid,relation in relations.items():
 tags=relation['tags'];category=landmark(tags)
 if not category:continue
 coords=[]
 for member_type,ref,role in relation['members']:
  if member_type=='way' and role in ('','outer') and ref in ways:
   coords.extend(nodes[n] for n in ways[ref]['refs'] if n in nodes)
 if coords:
  center=[round(sum(p[i] for p in coords)/len(coords),6) for i in (0,1)]
  props={'kind':'landmark','category':category,'osmId':f'relation/{rid}'};props.update(translated_names(tags));props=apply_landmark_card(props,f'relation/{rid}');name=props['names']['ru']
  if name:props['name']=name
  if not name:continue
  features.append({'type':'Feature','properties':props,'geometry':{'type':'Point','coordinates':center}})
way_progress=Progress(len(ways),'scan OSM ways')
way_progress.start()
for index,(wid,w) in enumerate(ways.items(),1):
 if index%1000==0:way_progress.update(index,f'{len(features)} features')
 coords=[nodes[x] for x in w['refs'] if x in nodes]
 if len(coords)!=len(w['refs']) or len(coords)<2:continue
 tags=w['tags']; closed=len(coords)>3 and coords[0]==coords[-1]; kind=None
 category=landmark(tags)
 if category and closed:
  props={'kind':'landmark','category':category,'osmId':f'way/{wid}'};props.update(translated_names(tags));props=apply_landmark_card(props,f'way/{wid}');name=props['names']['ru']
  if name:props['name']=name
  if not name:continue
  features.append({'type':'Feature','properties':props,'geometry':{'type':'Polygon','coordinates':[coords]}})
 if 'building' in tags and closed:
  kind='building'
 elif tags.get('highway') in ('motorway','trunk','primary','secondary','tertiary','residential','unclassified','living_street','pedestrian','service','footway','path','steps'):
  kind='road';
 elif tags.get('waterway') in ('river','stream','canal') or tags.get('natural')=='water':kind='water'
 elif tags.get('leisure') in ('park','garden') or tags.get('landuse') in ('grass','forest','recreation_ground') or tags.get('natural') in ('wood','grassland'):kind='green'
 if not kind:continue
 props={'kind':kind}
 if kind=='road':
  props['class']=tags['highway']
  props['osmId']=f'way/{wid}'
  props.update(translated_names(tags));name=props['names']['ru']
  if name:props['name']=name
 # Exclude extremely small generic building footprints to keep the static map light.
 if kind=='building':
  xs=[p[0] for p in coords];ys=[p[1] for p in coords]
  if max(xs)-min(xs)<.00006 and max(ys)-min(ys)<.00006:continue
 geom={'type':'Polygon','coordinates':[coords]} if closed and kind in ('building','green','water') else {'type':'LineString','coordinates':coords}
 features.append({'type':'Feature','properties':props,'geometry':geom})
way_progress.finish()

# City-wide extract contains only mapped streets, public green areas and museums.
city_extract=root/'raw/osm-tbilisi-selected.json'
if city_extract.exists():
 city_data=json.loads(city_extract.read_text())
 local_ids={('node',x) for x in nodes}|{('way',x) for x in ways}|{('relation',x) for x in relations}
 added=0
 def city_coords(element):
  return [[round(float(p['lon']),6),round(float(p['lat']),6)] for p in element.get('geometry',[])]
 def polygon_center(ring):
  area=0;cx=0;cy=0
  for a,b in zip(ring,ring[1:]):
   cross=a[0]*b[1]-b[0]*a[1];area+=cross;cx+=(a[0]+b[0])*cross;cy+=(a[1]+b[1])*cross
  if abs(area)<1e-15:return [sum(p[0] for p in ring)/len(ring),sum(p[1] for p in ring)/len(ring)]
  return [cx/(3*area),cy/(3*area)]
 city_elements=city_data.get('elements',[])
 city_progress=Progress(len(city_elements),'add city basemap')
 city_progress.start()
 for index,element in enumerate(city_elements,1):
  if index%500==0:city_progress.update(index,f'{added} features')
  osm_type=element.get('type');osm_id=element.get('id')
  if (osm_type,str(osm_id)) in local_ids:continue
  tags=element.get('tags',{});kind=None;geometry=None;props={'osmId':f'{osm_type}/{osm_id}'}
  if osm_type=='way' and tags.get('highway') in ('motorway','trunk','primary','secondary','tertiary','residential','unclassified','living_street','pedestrian'):
   coords=city_coords(element)
   if len(coords)<2:continue
   kind='road';props['class']=tags['highway'];geometry={'type':'LineString','coordinates':coords}
   props.update(translated_names(tags));name=props['names']['ru']
   if name:props['name']=name
  elif osm_type=='way' and (tags.get('leisure') in ('park','garden') or tags.get('landuse')=='recreation_ground'):
   coords=city_coords(element)
   if len(coords)<4 or coords[0]!=coords[-1]:continue
   kind='green';geometry={'type':'Polygon','coordinates':[coords]}
  elif (tags.get('tourism')=='museum' or tags.get('amenity')=='museum'):
   kind='landmark';props['category']='museum'
   props.update(translated_names(tags));props=apply_landmark_card(props,f'{osm_type}/{osm_id}');name=props['names']['ru']
   if name:props['name']=name
   if not name:continue
   if 'lon' in element and 'lat' in element:point=[float(element['lon']),float(element['lat'])]
   elif 'bounds' in element:
    bounds=element['bounds'];point=[(bounds['minlon']+bounds['maxlon'])/2,(bounds['minlat']+bounds['maxlat'])/2]
   else:
    coords=city_coords(element)
    if len(coords)<3:continue
    point=polygon_center(coords if coords[0]==coords[-1] else coords+[coords[0]])
   geometry={'type':'Point','coordinates':[round(float(point[0]),6),round(float(point[1]),6)]}
  else:continue
  props['kind']=kind
  features.append({'type':'Feature','properties':props,'geometry':geometry});added+=1
 city_progress.finish()
 print('City-wide streets, parks and museums added',added)

# Full Tbilisi building outlines are extracted locally from the regional PBF.
building_extract=root/'raw/osm-tbilisi-building-outlines.geojson'
if building_extract.exists():
 building_data=json.loads(building_extract.read_text())
 local_ids={('way',x) for x in ways}
 added=0
 building_features=building_data.get('features',[])
 building_progress=Progress(len(building_features),'add building outlines')
 building_progress.start()
 for index,feature in enumerate(building_features,1):
  if index%1000==0:building_progress.update(index,f'{added} features')
  props=feature.get('properties') or {};osm_id=props.get('osmId','')
  if not osm_id.startswith('way/') or ('way',osm_id[4:]) in local_ids:continue
  geometry=feature.get('geometry')
  if not geometry or geometry.get('type') not in ('Polygon','MultiPolygon'):continue
  features.append(feature);local_ids.add(('way',osm_id[4:]));added+=1
 building_progress.finish()
 print('Tbilisi-wide building outlines added',added)

# Atlas cards are stored one JSON per object in data/atlas/<city>/ and packed by
# scripts/assemble-atlas.mjs. This builder owns only the basemap and the
# city-wide building outlines; it must not create or edit card records.
building_outlines=[feature for feature in features if feature['properties'].get('kind')=='building']
basemap_features=[feature for feature in features if feature['properties'].get('kind')!='building']
write_progress=Progress(2,'write map layers')
write_progress.start()
(root/'public/atlas/basemap.geojson').write_text(json.dumps({'type':'FeatureCollection','features':basemap_features},ensure_ascii=False,separators=(',',':')))
write_progress.advance('basemap.geojson')
(root/'public/atlas/building-outlines.geojson').write_text(json.dumps({'type':'FeatureCollection','features':building_outlines},ensure_ascii=False,separators=(',',':')))
write_progress.advance('building-outlines.geojson')
write_progress.finish()
print('OSM nodes',len(nodes),'ways',len(ways),'basemap',len(basemap_features),'building outlines',len(building_outlines))
