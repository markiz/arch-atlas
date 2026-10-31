import xml.etree.ElementTree as ET, pathlib, json, math
import re
root=pathlib.Path(__file__).resolve().parent.parent
landmark_names=json.loads((root/'data/landmark-name-translations.json').read_text())
curated_name_variants=json.loads((root/'data/basemap-name-translations.json').read_text()) if (root/'data/basemap-name-translations.json').exists() else {}
attribute_translations=json.loads((root/'data/building-attribute-translations.json').read_text())
nodes={};node_tags={};ways={};relations={}
for path in sorted((root/'raw').glob('osm-grid-*.xml')):
 try: doc=ET.parse(path).getroot()
 except Exception: continue
 for node in doc.findall('node'):
  nodes[node.attrib['id']]=[round(float(node.attrib['lon']),6),round(float(node.attrib['lat']),6)]
  node_tags[node.attrib['id']]={t.attrib['k']:t.attrib['v'] for t in node.findall('tag')}
 for way in doc.findall('way'):
  ways[way.attrib['id']]={'refs':[n.attrib['ref'] for n in way.findall('nd')], 'tags':{t.attrib['k']:t.attrib['v'] for t in way.findall('tag')}}
 for relation in doc.findall('relation'):
  relations[relation.attrib['id']]={'members':[(m.attrib.get('type'),m.attrib.get('ref'),m.attrib.get('role')) for m in relation.findall('member')], 'tags':{t.attrib['k']:t.attrib['v'] for t in relation.findall('tag')}}
features=[];building_ways=[]
def landmark(tags):
 if tags.get('tourism')=='museum' or tags.get('amenity')=='museum':return 'museum'
 if tags.get('historic') in ('castle','fort','fortress'):return 'castle'
 if tags.get('amenity')=='place_of_worship' or tags.get('building') in ('church','chapel','cathedral'):return 'church'
 return None
def landmark_name(tags):
 name=tags.get('name:ru') or tags.get('name') or tags.get('name:ka') or tags.get('name:en')
 return landmark_names.get(name,name)
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
def translated_names(tags):
 for source in (tags.get('name:ka'),tags.get('name:ru'),tags.get('name:en'),tags.get('name:uk'),tags.get('name')):
  if source in curated_name_variants:
   return {'originalLanguage':'ka','names':curated_name_variants[source]}
 original=tags.get('name:ka') or (tags.get('name') if re.search('[\\u10a0-\\u10ff]',tags.get('name','')) else '') or tags.get('name:ru') or tags.get('name:en') or tags.get('name') or ''
 original_language='ka' if re.search('[\\u10a0-\\u10ff]',original) else ('en' if tags.get('name:en') else 'ru')
 is_georgian=bool(re.search('[\\u10a0-\\u10ff]',original))
 ru=tags.get('name:ru') or landmark_names.get(original) or (georgian_label(original,'ru') if is_georgian else tags.get('name') or original)
 en=tags.get('name:en') or (georgian_label(original,'en') if is_georgian else tags.get('name') or ru)
 ka=tags.get('name:ka') or (tags.get('name') if re.search('[\\u10a0-\\u10ff]',tags.get('name','')) else original)
 uk=tags.get('name:uk') or (georgian_label(original,'uk') if is_georgian else ukrainian_name(ru))
 return {'originalLanguage':original_language,'names':{'ru':ru,'en':en,'ka':ka,'uk':uk}}
for nid,tags in node_tags.items():
 category=landmark(tags)
 if category:
  props={'kind':'landmark','category':category,'osmId':f'node/{nid}'};props.update(translated_names(tags));name=props['names']['ru']
  if name:props['name']=name
  features.append({'type':'Feature','properties':props,'geometry':{'type':'Point','coordinates':nodes[nid]}})
for rid,relation in relations.items():
 tags=relation['tags'];category=landmark(tags)
 if not category:continue
 coords=[]
 for member_type,ref,role in relation['members']:
  if member_type=='way' and role in ('','outer') and ref in ways:
   coords.extend(nodes[n] for n in ways[ref]['refs'] if n in nodes)
 if coords:
  center=[round(sum(p[i] for p in coords)/len(coords),6) for i in (0,1)]
  props={'kind':'landmark','category':category,'osmId':f'relation/{rid}'};props.update(translated_names(tags));name=props['names']['ru']
  if name:props['name']=name
  features.append({'type':'Feature','properties':props,'geometry':{'type':'Point','coordinates':center}})
for wid,w in ways.items():
 coords=[nodes[x] for x in w['refs'] if x in nodes]
 if len(coords)!=len(w['refs']) or len(coords)<2:continue
 tags=w['tags']; closed=len(coords)>3 and coords[0]==coords[-1]; kind=None
 category=landmark(tags)
 if category and closed:
  props={'kind':'landmark','category':category,'osmId':f'way/{wid}'};props.update(translated_names(tags));name=props['names']['ru']
  if name:props['name']=name
  features.append({'type':'Feature','properties':props,'geometry':{'type':'Polygon','coordinates':[coords]}})
 if 'building' in tags and closed:
  building_ways.append((wid,coords,tags));kind='building'
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
 for element in city_data.get('elements',[]):
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
   props.update(translated_names(tags));name=props['names']['ru']
   if name:props['name']=name
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
 print('City-wide streets, parks and museums added',added)

# Full Tbilisi building outlines are extracted locally from the regional PBF.
building_extract=root/'raw/osm-tbilisi-building-outlines.geojson'
if building_extract.exists():
 building_data=json.loads(building_extract.read_text())
 local_ids={('way',x) for x in ways}
 added=0
 for feature in building_data.get('features',[]):
  props=feature.get('properties') or {};osm_id=props.get('osmId','')
  if not osm_id.startswith('way/') or ('way',osm_id[4:]) in local_ids:continue
  geometry=feature.get('geometry')
  if not geometry or geometry.get('type') not in ('Polygon','MultiPolygon'):continue
  features.append(feature);local_ids.add(('way',osm_id[4:]));added+=1
 print('Tbilisi-wide building outlines added',added)

def inside(p, poly):
 x,y=p;c=False
 for a,b in zip(poly,poly[1:]):
  if (a[1]>y)!=(b[1]>y) and x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]:c=not c
 return c
wik={x['id']:x for x in json.loads((root/'data/editorial_sources.json').read_text())}
# Manual editorial entries; the full source pages are referenced per record.
rows=[
 dict(id='opera',name='Тбилисский театр оперы и балета',nameKa='თბილისის ოპერისა და ბალეტის თეატრი',nameEn='Tbilisi Opera and Ballet Theatre',address='проспект Шота Руставели, 25',district='Мтацминда',minYear=1896,maxYear=1896,yearLabel='1880–1896',architects=['Виктор Шрётер'],style='Неомавританский стиль',description='Полосатые фасады, арки и восточный орнамент делают оперный театр одним из самых узнаваемых зданий проспекта Руставели.',history='Нынешнее здание построено по проекту Виктора Шрётера и открылось в 1896 году. Первое здание тбилисской оперы, открытое в 1851 году на другом месте, было уничтожено пожаром.',source='https://www.scantbilisi.ge/en/objects/326/BALLET-STATE-THEATRE'),
 dict(id='writers',name='Дом писателей Грузии',nameKa='მწერალთა სახლი',nameEn="Writers’ House of Georgia",address='улица Иване Мачабели, 13',district='Сололаки',minYear=1905,maxYear=1905,yearLabel='1903–1905',architects=['Карл Заар','Александр Озеров','Корнели Татищев'],style='Модерн',description='Особняк Давида Сараджишвили — выразительный образец тбилисского модерна с садом и тщательно проработанными интерьерами.',history='Дом строился в 1903–1905 годах по проекту Карла Заара при участии Александра Озерова и Корнели Татищева. Позднее он стал важным центром литературной жизни Грузии.',source='https://writershouse.ge/index.php?lng=eng&m=135'),
 dict(id='bank-georgia',name='Бывшее министерство автомобильных дорог',nameKa='საქართველოს ბანკის სათავო ოფისი',nameEn='Bank of Georgia headquarters',address='улица Гагарина, 29а',district='Сабуртало',minYear=1975,maxYear=1975,yearLabel='1975',architects=['Георгий Чахава','Зураб Джалагания'],style='Советский модернизм',description='Здание на склоне собрано из пересекающихся горизонтальных объемов, поднятых на опорах над землей. Это один из самых известных памятников советского модернизма Тбилиси.',history='Завершено в 1975 году для Министерства автомобильных дорог Грузинской ССР по проекту Георгия Чахавы и Зураба Джалагании. Позднее здание приспособили для штаб-квартиры банка.',source='https://taa.net.ge/en/archive-geo/ministry-of-road-construction/'),
 dict(id='imeli',name='Здание ИМЭЛИ',nameKa='იმელის შენობა',nameEn='IMELI Building',address='проспект Шота Руставели, 29',district='Мтацминда',minYear=1938,maxYear=1938,yearLabel='1934–1938',architects=['Алексей Щусев'],style='Советский неоклассицизм',description='Монументальная колоннада и каменный декор выделяют здание бывшего института на проспекте Руставели.',history='Здание построено в 1934–1938 годах по проекту Алексея Щусева для грузинского филиала института Маркса — Энгельса — Ленина. В XXI веке комплекс был перестроен.',source='https://www.tbilisiarchitecture.net/imeli-building/'),
 dict(id='rustaveli',name='Театр имени Шота Руставели',nameKa='შოთა რუსთაველის თეატრი',nameEn='Rustaveli National Theatre',address='проспект Шота Руставели, 17',district='Мтацминда',minYear=1901,maxYear=1901,yearLabel='1898–1901',architects=['Корнели Татищев','Александр Шимкевич'],style='Эклектика',description='Театральное здание с богато оформленным фасадом создавалось для Тифлисского артистического общества.',history='Трехэтажное здание построено в 1898–1901 годах по проекту Корнели Татищева и Александра Шимкевича. Сегодня в нем работает Национальный театр имени Шота Руставели.',source='https://scantbilisi.ge/en/objects/268/Rustaveli-National-Theatre-17%2C-Rustaveli-Ave'),
 dict(id='kashveti',name='Церковь Кашвети',nameKa='ქაშვეთის ეკლესია',nameEn='Kashveti Church',address='проспект Шота Руставели',district='Мтацминда',minYear=1910,maxYear=1910,yearLabel='1904–1910',architects=['Леопольд Бильфельд'],style='Грузинское возрождение',description='Храм на проспекте Руставели переосмысляет формы средневековой грузинской церковной архитектуры.',history='Нынешнюю церковь построили в 1904–1910 годах по проекту Леопольда Бильфельда на месте более раннего храма. Образцом для проекта послужил собор Самтависи XI века.',source='https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4229'),
 dict(id='anchiskhati',name='Базилика Анчисхати',nameKa='ანჩისხატის ბაზილიკა',nameEn='Anchiskhati Basilica',address='улица Иоане Шавтели',district='Старый Тбилиси',minYear=501,maxYear=600,yearLabel='VI век',architects=[],style='Раннехристианская базилика',description='Старинная трехнефная базилика в историческом центре считается древнейшей сохранившейся церковью Тбилиси.',history='Основание храма относят к VI веку. На протяжении веков церковь неоднократно ремонтировали и перестраивали; название связано с иконой, перенесенной из Анчи в XVII веке.',source='https://georgianencyclopedia.ge/en/form_eng/374'),
 dict(id='sioni',name='Сионский собор',nameKa='სიონის ღვთისმშობლის მიძინების ტაძარი',nameEn='Tbilisi Sioni Cathedral',address='улица Сиони, 4',district='Старый Тбилиси',minYear=1201,maxYear=1300,yearLabel='XIII век; позднейшие изменения',architects=[],style='Средневековая грузинская архитектура',description='Исторический кафедральный собор стоит на правом берегу Куры в старой части города.',history='Первый храм на этом месте относят к VI–VII векам. Он неоднократно разрушался и восстанавливался; существующее здание основано на перестройке XIII века с последующими изменениями.',source='https://georgia.travel/sioni-cathedral'),
 dict(id='metekhi',name='Храм Метехи',nameKa='მეტეხის ღვთისმშობლის ეკლესია',nameEn='Metekhi Church',address='Метехский подъём',district='Старый Тбилиси',minYear=1201,maxYear=1300,yearLabel='XIII век',architects=[],style='Средневековая грузинская архитектура',description='Храм стоит на скале над Курой, напротив исторического центра Тбилиси.',history='Сохранившуюся церковь построили в XIII веке при царе Деметре II на месте более раннего храма. Прилегающая крепость позднее была разрушена.',source='https://georgia.travel/metekhi-church'),
 dict(id='synagogue',name='Большая синагога Тбилиси',nameKa='თბილისის დიდი სინაგოგა',nameEn='Great Synagogue of Tbilisi',address='улица Коте Абхази, 45–47',district='Старый Тбилиси',minYear=1895,maxYear=1913,yearLabel='конец XIX — начало XX века',architects=[],style='Эклектика',description='Кирпичное здание с арочными окнами — исторический центр религиозной жизни еврейской общины Тбилиси.',history='Синагога связана с общиной выходцев из Ахалцихе. Источники расходятся в датировке: одни указывают 1895–1903, другие — 1904–1913 годы. До уточнения сохранен общий интервал.',source='https://cja.huji.ac.il/index.php?id=290958&mode=alone',otherSource='https://dbs.anumuseum.org.il/skn/en/c6/e23552465/'),
 dict(id='conservatoire',name='Тбилисская консерватория',nameKa='თბილისის სახელმწიფო კონსერვატორია',nameEn='Tbilisi State Conservatoire',address='улица Александра Грибоедова, 8–10',district='Мтацминда',minYear=1904,maxYear=1904,yearLabel='1901–1904',architects=['Александр Шимкевич'],style='Эклектика',description='Здание бывшего музыкального училища на улице Грибоедова соединяет элементы ренессанса и барокко.',history='Музыкальное училище построено в 1901–1904 годах по проекту Александра Шимкевича; торжественное открытие концертного зала состоялось в 1904 году.',source='https://www.scantbilisi.ge/en/objects/314/Tbilisi-State-Conservatoire'),
]
# Фотография бывшего министерства автодорог не включается до проверки прав на архитектурное произведение.
rows=[b for b in rows if b['id'] != 'bank-georgia']
for b in rows:
 data=wik.get(b['id'],{}); coord=data.get('coordinates');photo=data.get('photo')
 if not coord or not photo:raise SystemExit('Missing verified input: '+b['id'])
 p=[coord['lon'],coord['lat']];matches=[]
 if data.get('googlePlaceId'):b['googlePlaceId']=data['googlePlaceId']
 for wid,poly,tags in building_ways:
  xs=[q[0] for q in poly];ys=[q[1] for q in poly]
  if min(xs)<=p[0]<=max(xs) and min(ys)<=p[1]<=max(ys) and inside(p,poly):
   area=(max(xs)-min(xs))*(max(ys)-min(ys));matches.append((area,wid,poly,tags))
 matches.sort(key=lambda x:x[0]); b['coordinates']=p;b['photo']=photo
 if matches:
  _,wid,poly,tags=matches[0];b['geometry']={'type':'Polygon','coordinates':[poly]};b['geometryQuality']='Контур OpenStreetMap; автоматическое сопоставление по координате, требует ручной проверки';b['osmId']=f'way/{wid}'
  print(b['id'],'match',wid,tags.get('name',''))
 else:
  b['geometry']=None;b['geometryQuality']='Точное очертание не установлено; показана точка';print(b['id'],'point only')
overrides_path=root/'data/geometry-overrides.json'
if overrides_path.exists():
 overrides=json.loads(overrides_path.read_text())
 for b in rows:
  if b['id'] in overrides:b.update(overrides[b['id']])
curated_path=root/'data/curated-extra-photos.json'
curated=json.loads(curated_path.read_text()) if curated_path.exists() else {}
for b in rows:
 photos=[b['photo']];extra=curated.get(b['id'])
 if extra and extra['source']!=b['photo']['source']:photos.append(extra)
 b['photos']=photos
extra_path=root/'data/heritage-extra.json'
if extra_path.exists():rows.extend(json.loads(extra_path.read_text()))
address_translations_path=root/'data/building-address-translations.json'
address_translations=json.loads(address_translations_path.read_text()) if address_translations_path.exists() else {}
for building in rows:
 translations=address_translations.get(building['id'])
 if translations is None or set(translations)!={'ru','en','ka','uk'}:
  raise SystemExit('Missing address translations: '+building['id'])
 if any(not isinstance(value,str) for value in translations.values()):
  raise SystemExit('Invalid address translation: '+building['id'])
 building['addresses']=translations
 building['address']=translations['ru']
google_places_path=root/'data/google-place-ids.json'
if google_places_path.exists():
 google_places=json.loads(google_places_path.read_text())
 buildings_by_id={b['id']:b for b in rows}
 for place in google_places:
  building=buildings_by_id.get(place['id'])
  if building is None:raise SystemExit('Google Place ID references unknown building: '+place['id'])
  building['googlePlaceId']=place['placeId']
  building['googlePlaceIdSource']=place['sourceUrl']
source_tags={**{f'node/{key}':value for key,value in node_tags.items()},**{f'way/{key}':value['tags'] for key,value in ways.items()},**{f'relation/{key}':value['tags'] for key,value in relations.items()}}
georgian_generic={
 'საცხოვრებელი სახლი':('Жилой дом','Residential building','Житловий будинок'),
 'კოშკი':('Башня','Tower','Вежа'),
 'ლაბორატორია':('Лаборатория','Laboratory','Лабораторія'),
 'სათბური':('Оранжерея','Greenhouse','Оранжерея'),
 'ყოფილი მუზეუმი':('Бывший музей','Former museum','Колишній музей'),
 'ფოლკლორის მუზეუმი':('Музей фольклора','Folklore Museum','Музей фольклору'),
 'სკოლა #68':('Школа № 68','School No. 68','Школа № 68'),
 'თეატრალური ინსტიტუტი':('Театральный институт','Theatre Institute','Театральний інститут'),
 'კომპოზიტორთა კავშირი':('Союз композиторов','Composers’ Union','Спілка композиторів'),
}
for building in rows:
 tags=source_tags.get(building.get('osmId',''),{})
 if not building.get('nameKa') and tags.get('name:ka'):building['nameKa']=tags['name:ka']
 if not building.get('nameEn') and tags.get('name:en'):building['nameEn']=tags['name:en']
 if not building.get('name') and tags.get('name:ru'):building['name']=tags['name:ru']
 original=building.get('nameKa') or tags.get('name:ka') or tags.get('name') or 'შენობა'
 if original in georgian_generic:
  ru,en,uk=georgian_generic[original]
 else:
  ru=building.get('name') or tags.get('name:ru') or original
  en=building.get('nameEn') or tags.get('name:en') or ru
  uk=tags.get('name:uk') or ukrainian_name(ru)
 if re.search('[\\u10a0-\\u10ff]',ru):
  ru=georgian_generic.get(ru,(ru,'',''))[0] or ru
 building['name']=ru
 building['nameEn']=en
 building['nameKa']=original
 building['nameUk']=uk
 building['originalLanguage']='ka'
 building['names']={'ru':ru,'en':en,'ka':original,'uk':uk}
building_name_translations_path=root/'data/building-name-translations.json'
building_name_translations=json.loads(building_name_translations_path.read_text()) if building_name_translations_path.exists() else {}
if building_name_translations_path.exists():
 for building in rows:
  overrides=building_name_translations.get(building['id'],{})
  building['names'].update(overrides)
  building['name']=building['names']['ru'];building['nameEn']=building['names']['en'];building['nameKa']=building['names']['ka'];building['nameUk']=building['names']['uk']
text_translations_path=root/'data/building-text-translations.json'
text_translations=json.loads(text_translations_path.read_text()) if text_translations_path.exists() else {}
for building in rows:
 translations=text_translations.get(building['id'])
 if translations is None:raise SystemExit('Missing text translations: '+building['id'])
 building['descriptions']=translations['descriptions']
 building['description']=building['descriptions']['ru']
 histories=translations.get('histories',{})
 building['history']=histories.get('ru','')
 if histories:building['histories']=histories
 else:building.pop('histories',None)
 style_id=attribute_translations['styleIdBySource'].get(building['style'])
 if style_id is None:raise SystemExit('Missing style key: '+building['style'])
 year_label_id=attribute_translations['yearLabelIdBySource'].get(building['yearLabel'])
 if year_label_id is None:raise SystemExit('Missing construction label key: '+building['yearLabel'])
 district_id=attribute_translations['districtIdBySource'].get(building['district'])
 if district_id is None:raise SystemExit('Missing district key: '+building['district'])
 building['styleId']=style_id
 building['styles']=attribute_translations['styles'][style_id]['labels']
 building['yearLabelId']=year_label_id
 building['yearLabels']=attribute_translations['yearLabels'][year_label_id]['labels']
 building['districtId']=district_id
 building['districts']=attribute_translations['districts'][district_id]['labels']
 architect_ids=[];architects_by_language={lang:[] for lang in ('ru','en','ka','uk')}
 for value in building.get('architects',[]):
  for source_name in (part.strip() for part in value.split(';')):
   if not source_name:continue
   architect_id=attribute_translations['architectIdBySource'].get(source_name)
   if architect_id is None:raise SystemExit('Missing architect key: '+source_name)
   architect_ids.append(architect_id)
   labels=attribute_translations['architects'][architect_id]['labels']
   for lang in architects_by_language:architects_by_language[lang].append(labels[lang])
 building['architectIds']=architect_ids
 building['architectsByLanguage']=architects_by_language
 building['architects']=architects_by_language['ru']
(root/'public/atlas/buildings.json').write_text(json.dumps(rows,ensure_ascii=False,separators=(',',':')))
building_outlines=[feature for feature in features if feature['properties'].get('kind')=='building']
basemap_features=[feature for feature in features if feature['properties'].get('kind')!='building']
(root/'public/atlas/basemap.geojson').write_text(json.dumps({'type':'FeatureCollection','features':basemap_features},ensure_ascii=False,separators=(',',':')))
(root/'public/atlas/building-outlines.geojson').write_text(json.dumps({'type':'FeatureCollection','features':building_outlines},ensure_ascii=False,separators=(',',':')))
print('OSM nodes',len(nodes),'ways',len(ways),'basemap',len(basemap_features),'building outlines',len(building_outlines),'buildings',len(rows))
