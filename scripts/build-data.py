import xml.etree.ElementTree as ET, pathlib, json, math
root=pathlib.Path(__file__).resolve().parent.parent
nodes={};ways={}
for path in sorted((root/'raw').glob('osm-grid-*.xml')):
 try: doc=ET.parse(path).getroot()
 except Exception: continue
 for node in doc.findall('node'):
  nodes[node.attrib['id']]=[round(float(node.attrib['lon']),6),round(float(node.attrib['lat']),6)]
 for way in doc.findall('way'):
  ways[way.attrib['id']]={'refs':[n.attrib['ref'] for n in way.findall('nd')], 'tags':{t.attrib['k']:t.attrib['v'] for t in way.findall('tag')}}
features=[];building_ways=[]
for wid,w in ways.items():
 coords=[nodes[x] for x in w['refs'] if x in nodes]
 if len(coords)!=len(w['refs']) or len(coords)<2:continue
 tags=w['tags']; closed=len(coords)>3 and coords[0]==coords[-1]; kind=None
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
  name=tags.get('name:ru') or tags.get('name') or tags.get('name:ka')
  if name:props['name']=name
 # Exclude extremely small generic building footprints to keep the static map light.
 if kind=='building':
  xs=[p[0] for p in coords];ys=[p[1] for p in coords]
  if max(xs)-min(xs)<.00006 and max(ys)-min(ys)<.00006:continue
 geom={'type':'Polygon','coordinates':[coords]} if closed and kind in ('building','green','water') else {'type':'LineString','coordinates':coords}
 features.append({'type':'Feature','properties':props,'geometry':geom})

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
(root/'public/atlas/buildings.json').write_text(json.dumps(rows,ensure_ascii=False,separators=(',',':')))
(root/'public/atlas/basemap.geojson').write_text(json.dumps({'type':'FeatureCollection','features':features},ensure_ascii=False,separators=(',',':')))
print('OSM nodes',len(nodes),'ways',len(ways),'basemap',len(features),'buildings',len(rows))
