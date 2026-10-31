import {Fragment,useEffect,useMemo,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import type {FeatureCollection} from 'geojson';
import type {Building,Data,Filters} from './types';
import {filterBuildings,normalize,period,periods} from './domain';
import MapView from './MapView';

type View='map'|'catalog';
const initialFilters:Filters={query:'',from:'',to:'',architect:'',style:''};
const base=import.meta.env.BASE_URL+'atlas/';
function Icon({name,size=18}:{name:string;size?:number}){
 const common={width:size,height:size,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.6,strokeLinecap:'round' as const,strokeLinejoin:'round' as const,'aria-hidden':true as const};
 const paths:Record<string,React.ReactNode>={search:<><circle cx="10.8" cy="10.8" r="6.5"/><path d="m16 16 4 4"/></>,map:<><path d="m3 6 6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/></>,list:<><path d="M9 6h12M9 12h12M9 18h12"/><path d="M4 6h.01M4 12h.01M4 18h.01"/></>,close:<><path d="M5 5l14 14M19 5 5 19"/></>,arrow:<><path d="M5 12h14M13 6l6 6-6 6"/></>,pin:<><path d="M19 10c0 5-7 10-7 10S5 15 5 10a7 7 0 0 1 14 0Z"/><circle cx="12" cy="10" r="2"/></>,sliders:<><path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="2" fill="currentColor"/><circle cx="16" cy="17" r="2" fill="currentColor"/></>,external:<><path d="M13 5h6v6M19 5 10 14"/><path d="M19 14v5H5V5h5"/></>};
 return <svg {...common}>{paths[name]}</svg>
}
function PeriodChoices({selected,onToggle,onHover,className}:{selected:string[];onToggle:(label:string)=>void;onHover:(label:string|null)=>void;className:string}){
 const options=[...periods,{label:'Несколько периодов',min:null,max:null,color:'#999b91'}];
 return <div className={className}>{options.map(p=><button type="button" key={p.label} className={selected.includes(p.label)?'active':''} aria-pressed={selected.includes(p.label)} onMouseEnter={()=>onHover(p.label)} onMouseLeave={()=>onHover(null)} onFocus={()=>onHover(p.label)} onBlur={()=>onHover(null)} onClick={()=>onToggle(p.label)}><i style={{background:p.color}}/>{p.label}</button>)}</div>
}
function PeriodPicker({selected,onToggle,onHover}:{selected:string[];onToggle:(label:string)=>void;onHover:(label:string|null)=>void}){
 const options=[...periods,{label:'Несколько периодов',min:null,max:null,color:'#999b91'}];
 const summary=selected.length===0?'Все периоды':selected.length===1?selected[0]:`Выбрано: ${selected.length}`;
 return <details className="period-picker"><summary><span>{summary}</span><i aria-hidden="true"/></summary><div className="period-picker-menu">{options.map(p=><label key={p.label} onMouseEnter={()=>onHover(p.label)} onMouseLeave={()=>onHover(null)}><input type="checkbox" checked={selected.includes(p.label)} onChange={()=>onToggle(p.label)}/><i style={{background:p.color}}/>{p.label}</label>)}</div></details>
}
function PhotoLightbox({building,src,index,total,description,onClose,onNext,onPrevious,opener}:{building:Building;src:string;index:number;total:number;description?:string;onClose:()=>void;onNext:()=>void;onPrevious:()=>void;opener:{current:HTMLButtonElement|null}}){
 const closeButton=useRef<HTMLButtonElement>(null);
 useEffect(()=>{const previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';closeButton.current?.focus();const key=(event:KeyboardEvent)=>{if(event.key==='Escape')onClose();else if(event.key==='ArrowRight')onNext();else if(event.key==='ArrowLeft')onPrevious()};window.addEventListener('keydown',key);return()=>{window.removeEventListener('keydown',key);document.body.style.overflow=previousOverflow;opener.current?.focus()}},[]);
 return createPortal(<div className="lightbox-backdrop" role="dialog" aria-modal="true" aria-label={`Фотографии: ${building.name}`} onClick={event=>{if(event.target===event.currentTarget)onClose()}}><div className="lightbox" onClick={event=>{if(event.target===event.currentTarget)onClose()}}><div className="lightbox-top"><span>{String(index+1).padStart(2,'0')} / {String(total).padStart(2,'0')}</span><button ref={closeButton} className="lightbox-close" onClick={onClose} aria-label="Закрыть фотографию"><Icon name="close" size={22}/></button></div><div className="lightbox-view" onClick={event=>{if(event.target===event.currentTarget)onClose()}}>{total>1&&<button className="lightbox-nav previous" onClick={onPrevious} aria-label="Предыдущая фотография">‹</button>}<img src={src} alt={`${building.name}, фотография ${index+1}`}/>{total>1&&<button className="lightbox-nav next" onClick={onNext} aria-label="Следующая фотография">›</button>}</div><div className="lightbox-caption"><strong>{building.name}</strong>{description&&<p>{description}</p>}</div></div></div>,document.body);
}
function parseHash(){const p=new URLSearchParams(location.hash.slice(1));return {view:p.get('view')==='catalog'?'catalog' as View:'map' as View,id:p.get('building')}}
function Loader({onReady}:{onReady:(d:Data)=>void}){
 const [status,setStatus]=useState('Подготавливаем карту и фотографии'),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
 useEffect(()=>{let cancelled=false,handedOff=false;const urls:string[]=[];const controller=new AbortController();async function run(){try{
  setError('');setStatus('Загружаем карту и данные…');
  const get=async(path:string,revision=__ATLAS_REVISION__)=>{const r=await fetch(`${base}${path}?v=${encodeURIComponent(revision)}`,{signal:controller.signal});if(!r.ok)throw new Error(`Не удалось загрузить ${path}`);return r};
  const manifest=await (await get('manifest.json')).json() as {version:number;revision:string;files:{path:string;size:number;sha256:string}[]};
  if(manifest.version!==1||!Array.isArray(manifest.files))throw new Error('Неизвестная версия пакета');
  if(!crypto.subtle)throw new Error('Для проверки пакета откройте атлас через HTTPS или localhost');
  const files=new Map<string,ArrayBuffer>();let done=0;const total=manifest.files.reduce((n,f)=>n+f.size,0);let loaded=0;
  let nextFile=0;const loadNext=async()=>{while(nextFile<manifest.files.length){const f=manifest.files[nextFile++];
    if(f.path.includes('..')||f.path.startsWith('/'))throw new Error('Некорректный путь в пакете');
    const bytes=await (await get(f.path,f.sha256)).arrayBuffer();
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(x=>x.toString(16).padStart(2,'0')).join('');
    if(bytes.byteLength!==f.size||hash!==f.sha256)throw new Error(`Поврежден файл ${f.path}`);
    files.set(f.path,bytes);done++;loaded+=f.size;
    if(!cancelled)setStatus(`Загружено ${(loaded/1048576).toFixed(1)} из ${(total/1048576).toFixed(1)} МБ · ${done}/${manifest.files.length}`);
  }};await Promise.all(Array.from({length:Math.min(6,manifest.files.length)},loadNext));
  const decode=(path:string)=>{const bytes=files.get(path);if(!bytes)throw new Error(`В пакете нет ${path}`);return JSON.parse(new TextDecoder().decode(bytes))};
  const buildings:Building[]=decode('buildings.json'),basemap:FeatureCollection=decode('basemap.geojson');const photos:Record<string,string[]>={};
  for(const item of buildings){photos[item.id]=[];for(const photo of item.photos??(item.photo?[item.photo]:[])){const bytes=files.get(photo.file);if(!bytes)throw new Error(`В пакете нет фото ${item.name}`);const url=URL.createObjectURL(new Blob([bytes],{type:'image/webp'}));urls.push(url);photos[item.id].push(url)}}
  if(!cancelled){handedOff=true;onReady({buildings,basemap,photos})}
 }catch(e){controller.abort();urls.forEach(URL.revokeObjectURL);if(!cancelled)setError(e instanceof Error?e.message:'Ошибка загрузки')}}run();return()=>{cancelled=true;controller.abort();if(!handedOff)urls.forEach(URL.revokeObjectURL)}},[attempt]);
 return <div className="loading"><div className="loading-mark">ა<span>•</span></div><p className="eyebrow">АРХИТЕКТУРНЫЙ АТЛАС</p><h1>Атлас Тбилиси</h1><div className="loader-line"/><p>{error||status}</p>{error&&<button className="primary-button" onClick={()=>setAttempt(x=>x+1)}>Попробовать снова</button>}</div>
}
function Inspector({building,photo,onClose,onMap,onFilter}:{building:Building;photo:string[];onClose:()=>void;onMap:()=>void;onFilter:(key:'architect'|'style',value:string)=>void}){
 const [photoIndex,setPhotoIndex]=useState(0),[lightboxOpen,setLightboxOpen]=useState(false);const credits=(building.photos??(building.photo?[building.photo]:[]))[photoIndex];
 const close=useRef<HTMLButtonElement>(null),photoOpener=useRef<HTMLButtonElement>(null);useEffect(()=>{close.current?.focus()},[building.id]);useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!lightboxOpen)onClose()};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)},[building.id,lightboxOpen]);
 const googleMapsUrl=building.googlePlaceId?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${building.nameEn||building.name}, ${building.address}, Tbilisi, Georgia`)}&query_place_id=${encodeURIComponent(building.googlePlaceId)}`:`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${building.coordinates[1]},${building.coordinates[0]}`)}`;
 function nextPhoto(){setPhotoIndex(i=>(i+1)%photo.length)}
 function previousPhoto(){setPhotoIndex(i=>(i+photo.length-1)%photo.length)}
 const p=period(building.minYear,building.maxYear)!;
 return <><aside className="inspector" aria-label={`Информация: ${building.name}`}>
  <div className="inspect-top"><span>ОБЪЕКТ АТЛАСА <span className="index-no">/ {building.id.toUpperCase()}</span></span><button ref={close} className="icon-btn" onClick={onClose} aria-label="Закрыть карточку"><Icon name="close"/></button></div>
  <div className="inspect-scroll">
   <div className="photo-wrap">{photo.length?<><button ref={photoOpener} className="photo-open" onClick={()=>setLightboxOpen(true)} aria-label={`Открыть фотографию ${photoIndex+1} на весь экран`}><img src={photo[photoIndex]} alt={`${building.name}, фотография ${photoIndex+1}`}/></button>{photo.length>1&&<><button className="photo-prev" aria-label="Предыдущая фотография" onClick={previousPhoto}>‹</button><button className="photo-next" aria-label="Следующая фотография" onClick={nextPhoto}>›</button></>}<span className="photo-number">{String(photoIndex+1).padStart(2,"0")} / {String(photo.length).padStart(2,"0")}</span></>:<div className="no-photo">Фотографии пока нет</div>}</div>
   <div className="inspect-body"><div className="inspect-meta"><span><span className="period-dot" style={{background:p.color}}/>{p.label}</span><span>{building.district}</span></div>
    <h2>{building.name}</h2><p className="georgian">{building.nameKa}</p><a className="address address-link" href={googleMapsUrl} target="_blank" rel="noopener noreferrer" aria-label={`Открыть адрес «${building.address}» в Google Картах`}><Icon name="pin" size={15}/>{building.address}<Icon name="external" size={12}/></a>
    <p className="description">{building.description}</p>
    <div className="details"><div><span>ПОСТРОЕНО</span><strong>{building.yearLabel}</strong></div><div><span>СТИЛЬ</span><strong>{building.style&&building.style!=='Не определён'&&building.style!=='Не установлен'?<button className="detail-filter" onClick={()=>onFilter('style',building.style)} aria-label={`Фильтр по стилю: ${building.style}`}>{building.style}</button>:building.style}</strong></div><div className="full"><span>АРХИТЕКТОР</span><strong>{building.architects.length?building.architects.map((architect,index)=><Fragment key={architect}>{index>0?', ':''}<button className="detail-filter" onClick={()=>onFilter('architect',architect)} aria-label={`Фильтр по архитектору: ${architect}`}>{architect}</button></Fragment>):'Не установлен'}</strong></div></div>
    <div className="section-rule"/><p className="eyebrow">ИСТОРИЯ ЗДАНИЯ</p><p className="history">{building.history}</p>
    <button className="text-link map-link" onClick={onMap}><Icon name="pin" size={15}/> Показать на карте <Icon name="arrow" size={16}/></button>
    <div className="credits"><p>ДАННЫЕ И ФОТОГРАФИЯ</p><a href={building.source} target="_blank" rel="noreferrer">Источник сведений <Icon name="external" size={12}/></a>{building.otherSource&&<a href={building.otherSource} target="_blank" rel="noreferrer">Дополнительный источник <Icon name="external" size={12}/></a>}{credits&&<><a href={credits.source} target="_blank" rel="noreferrer">Фото: {credits.author} · {credits.license} <Icon name="external" size={12}/></a><span>{credits.modifications}. <a href={credits.licenseUrl} target="_blank" rel="noreferrer">Условия лицензии</a></span></>}<span>{building.geometryQuality}.</span></div>
   </div>
  </div>
 </aside>{lightboxOpen&&credits&&<PhotoLightbox building={building} src={photo[photoIndex]} index={photoIndex} total={photo.length} description={credits.description} onClose={()=>setLightboxOpen(false)} onNext={nextPhoto} onPrevious={previousPhoto} opener={photoOpener}/>}</>
}
function AppContent({data}:{data:Data}){
 const init=useMemo(parseHash,[]),[city,setCity]=useState('tbilisi'),[view,setView]=useState<View>(init.view),[selected,setSelected]=useState<string|null>(init.id),[filters,setFilters]=useState<Filters>(initialFilters),[showFilters,setShowFilters]=useState(false),[showLegend,setShowLegend]=useState(true),[hoveredPeriod,setHoveredPeriod]=useState<string|null>(null),[selectedPeriods,setSelectedPeriods]=useState<string[]>([]),[focus,setFocus]=useState<{id:string;serial:number}|null>(null),[reset,setReset]=useState(0),[fit,setFit]=useState(0),[sort,setSort]=useState('name');
 const opener=useRef<HTMLElement|null>(null),firstHash=useRef(true),hadActiveFilters=useRef(false);
 const filtered=useMemo(()=>{const results=filterBuildings(data.buildings,filters) as Building[];return selectedPeriods.length?results.filter(b=>selectedPeriods.includes(period(b.minYear,b.maxYear)!.label)):results},[data.buildings,filters,selectedPeriods]);
 const architects=useMemo(()=>[...new Set(data.buildings.flatMap(x=>x.architects))].sort((a,b)=>a.localeCompare(b,'ru')),[data.buildings]);
 const styles=useMemo(()=>[...new Set(data.buildings.map(x=>x.style))].sort((a,b)=>a.localeCompare(b,'ru')),[data.buildings]);
 const selectedBuilding=data.buildings.find(x=>x.id===selected)||null;
 const sorted=[...filtered].sort((a,b)=>sort==='name'?a.name.localeCompare(b.name,'ru'):sort==='old'?(a.minYear??Infinity)-(b.minYear??Infinity)||a.name.localeCompare(b.name,'ru'):(b.minYear??-Infinity)-(a.minYear??-Infinity)||a.name.localeCompare(b.name,'ru'));
 useEffect(()=>{const p=new URLSearchParams();p.set('view',view);if(selected)p.set('building',selected);const hash='#'+p.toString();if(firstHash.current){firstHash.current=false;if(location.hash!==hash)history.replaceState(null,'',hash)}else if(location.hash!==hash)history.pushState(null,'',hash)},[view,selected]);
 useEffect(()=>{const pop=()=>{const h=parseHash();setView(h.view);setSelected(h.id)};window.addEventListener('popstate',pop);return()=>window.removeEventListener('popstate',pop)},[]);
 useEffect(()=>{if(selected&&!filtered.some(x=>x.id===selected))setSelected(null)},[filtered,selected]);
 function select(id:string){opener.current=document.activeElement as HTMLElement;setSelected(id)}
 function close(){setSelected(null);setTimeout(()=>opener.current?.focus(),0)}
 function goMap(id:string){setView('map');setSelected(id);setFocus({id,serial:Date.now()})}
 function update<K extends keyof Filters>(key:K,value:Filters[K]){setFilters(x=>({...x,[key]:value}))}
 function filterBy(key:'architect'|'style',value:string){setFilters(x=>({...x,[key]:value}));setShowFilters(true)}
 function resetFilters(){setFilters(initialFilters);setSelectedPeriods([]);setHoveredPeriod(null)}
 function togglePeriod(label:string){setHoveredPeriod(null);setSelectedPeriods(current=>current.includes(label)?current.filter(x=>x!==label):[...current,label])}
 const activeCount=Number(!!filters.from||!!filters.to)+Number(!!filters.architect)+Number(!!filters.style)+Number(selectedPeriods.length>0);
 const hasActiveFilters=!!filters.query.trim()||activeCount>0;
 useEffect(()=>{if(hadActiveFilters.current&&!hasActiveFilters)setReset(x=>x+1);hadActiveFilters.current=hasActiveFilters},[hasActiveFilters]);
 const highlightedPeriods=hoveredPeriod?[...new Set([...selectedPeriods,hoveredPeriod])]:selectedPeriods;
 return <div className="app-shell">
  <header className="header"><div className="brand"><span className="brand-symbol">ა</span><span className="brand-name">АТЛАС<br/><b>{city==='tbilisi'?'ТБИЛИСИ':city==='batumi'?'БАТУМИ':'КУТАИСИ'}</b></span></div><div className="header-right"><label className="city-label" htmlFor="city">ГОРОД</label><select id="city" className="city-select" value={city} onChange={e=>setCity(e.target.value)}><option value="tbilisi">Тбилиси</option><option value="batumi">Батуми</option><option value="kutaisi">Кутаиси</option></select></div></header>
  <main className="workspace">
   {city==='tbilisi'?<>
   <div className="toolbar"><label className="search"><Icon name="search" size={18}/><input aria-label="Поиск по атласу" value={filters.query} onChange={e=>update('query',e.target.value)} placeholder="Название, архитектор, адрес…"/>{filters.query&&<button onClick={()=>update('query','')} aria-label="Очистить поиск"><Icon name="close" size={14}/></button>}</label><button className={'filter-button '+(showFilters?'active':'')} onClick={()=>setShowFilters(!showFilters)} aria-expanded={showFilters}><Icon name="sliders" size={17}/> Фильтры {activeCount>0&&<span className="filter-count">{activeCount}</span>}</button><div className="view-toggle" role="group" aria-label="Вид атласа"><button className={view==='map'?'active':''} onClick={()=>setView('map')}><Icon name="map" size={16}/> Карта</button><button className={view==='catalog'?'active':''} onClick={()=>setView('catalog')}><Icon name="list" size={16}/> Каталог</button></div></div>
   {showFilters&&<div className="filter-panel"><div className="period-filter"><span className="period-filter-label">Период постройки</span><PeriodPicker selected={selectedPeriods} onToggle={togglePeriod} onHover={setHoveredPeriod}/></div><div><label htmlFor="from">Год от</label><input id="from" type="number" placeholder="Например, 1800" value={filters.from} onChange={e=>update('from',e.target.value)}/></div><div><label htmlFor="to">Год до</label><input id="to" type="number" placeholder="Например, 1920" value={filters.to} onChange={e=>update('to',e.target.value)}/></div><div><label htmlFor="architect">Архитектор</label><select id="architect" value={filters.architect} onChange={e=>update('architect',e.target.value)}><option value="">Все архитекторы</option>{architects.map(x=><option key={x}>{x}</option>)}<option value="unknown">Не установлен</option></select></div><div><label htmlFor="style">Стиль</label><select id="style" value={filters.style} onChange={e=>update('style',e.target.value)}><option value="">Все стили</option>{styles.map(x=><option key={x}>{x}</option>)}</select></div><button className="reset-filter" onClick={resetFilters}>Сбросить</button></div>}
   <div className={'content '+(selectedBuilding?'has-selection':'')}>
    <div className="view-main">{view==='map'?<><MapView buildings={filtered} allBuildings={data.buildings} basemap={data.basemap as FeatureCollection} selected={selected} onSelect={select} focus={focus} reset={reset} fit={fit} showFit={hasActiveFilters} onFit={()=>setFit(x=>x+1)} highlightedPeriods={highlightedPeriods}/><div className="map-caption"><span className="caption-dot"/> ТБИЛИСИ, ГРУЗИЯ <span className="caption-line"/> {hasActiveFilters?`${filtered.length}/${data.buildings.length}`:data.buildings.length} ОБЪЕКТОВ</div><button className="overview" onClick={()=>setReset(x=>x+1)} title="Вернуться к центру">⌖</button><div className={'legend '+(!showLegend?'compact':'')}><div className="legend-head"><span>ПЕРИОД ПОСТРОЙКИ</span><button onClick={()=>setShowLegend(!showLegend)} aria-label={showLegend?'Свернуть легенду':'Развернуть легенду'}>{showLegend?'−':'+'}</button></div>{showLegend&&<><div className="legend-colors">{periods.slice(0,7).map(p=><span key={p.label} style={{background:p.color}}/>)}</div><div className="legend-range"><span>ДО 1800</span><span>1992 И ПОЗЖЕ</span></div><PeriodChoices className="legend-list legend-period-options" selected={selectedPeriods} onToggle={togglePeriod} onHover={setHoveredPeriod}/><p>Цвет показывает датировку здания. Выбор периода — в панели фильтров.</p></>}</div></>:<div className="catalog"><div className="catalog-head"><div><h2>Каталог</h2></div><label>Сортировка <select value={sort} onChange={e=>setSort(e.target.value)}><option value="name">По названию</option><option value="old">Сначала старые</option><option value="new">Сначала новые</option></select></label></div>{!sorted.length?<div className="empty"><h3>Ничего не найдено</h3><p>Попробуйте изменить запрос или сбросить фильтры.</p><button onClick={resetFilters}>Сбросить фильтры</button></div>:<div className="cards">{sorted.map(b=><article key={b.id} className="card"><button className="card-image" onClick={()=>select(b.id)} aria-label={'Подробнее: '+b.name}>{data.photos[b.id]?.length?<img src={data.photos[b.id][0]} alt=""/>:<div className="no-photo">Фотографии пока нет</div>}<span className="card-year"><i style={{background:period(b.minYear,b.maxYear)!.color}}/>{b.yearLabel}</span></button><div className="card-body"><span className="card-district">{b.district} / {b.style}</span><button className="card-title" onClick={()=>select(b.id)}>{b.name}</button><p>{b.address}</p><button className="text-link" onClick={()=>goMap(b.id)}>На карте <Icon name="arrow" size={15}/></button></div></article>)}</div>}</div>}</div>
    {selectedBuilding&&<Inspector key={selectedBuilding.id} building={selectedBuilding} photo={data.photos[selectedBuilding.id]} onClose={close} onMap={()=>goMap(selectedBuilding.id)} onFilter={filterBy}/>}
   </div>
   </>:<div className="city-empty"><h1>{city==='batumi'?'Батуми':'Кутаиси'}</h1><p>Данные об архитектуре этого города пока не добавлены.</p><button onClick={()=>setCity('tbilisi')}>Вернуться к карте Тбилиси</button></div>}
   <footer><span>Данные: © участники OpenStreetMap</span></footer>
  </main>
 </div>
}
export default function App(){const [data,setData]=useState<Data|null>(null);return data?<AppContent data={data}/>:<Loader onReady={setData}/>}
