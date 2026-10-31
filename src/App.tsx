import {Fragment,useEffect,useMemo,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import type {FeatureCollection} from 'geojson';
import type {Building,Data,Filters} from './types';
import {filterBuildings,normalize,period,periods,styleEntries} from './domain';
import MapView from './MapView';
import {I18nContext,translate,type Language,useI18n} from './i18n';

type View='map'|'catalog';
const initialFilters:Filters={query:'',from:'',to:'',architect:[],style:[]};
const base=import.meta.env.BASE_URL+'atlas/';
function Icon({name,size=18}:{name:string;size?:number}){
 const common={width:size,height:size,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.6,strokeLinecap:'round' as const,strokeLinejoin:'round' as const,'aria-hidden':true as const};
 const paths:Record<string,React.ReactNode>={search:<><circle cx="10.8" cy="10.8" r="6.5"/><path d="m16 16 4 4"/></>,map:<><path d="m3 6 6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/></>,list:<><path d="M9 6h12M9 12h12M9 18h12"/><path d="M4 6h.01M4 12h.01M4 18h.01"/></>,close:<><path d="M5 5l14 14M19 5 5 19"/></>,arrow:<><path d="M5 12h14M13 6l6 6-6 6"/></>,pin:<><path d="M19 10c0 5-7 10-7 10S5 15 5 10a7 7 0 0 1 14 0Z"/><circle cx="12" cy="10" r="2"/></>,sliders:<><path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="2" fill="currentColor"/><circle cx="16" cy="17" r="2" fill="currentColor"/></>,external:<><path d="M13 5h6v6M19 5 10 14"/><path d="M19 14v5H5V5h5"/></>};
 return <svg {...common}>{paths[name]}</svg>
}
function PeriodChoices({selected,onToggle,onHover,className}:{selected:string[];onToggle:(label:string)=>void;onHover:(label:string|null)=>void;className:string}){
 const {t}=useI18n();
 const options=[...periods,{label:'Несколько периодов',min:null,max:null,color:'#999b91'}];
 return <div className={className}>{options.map(p=><button type="button" key={p.label} className={selected.includes(p.label)?'active':''} aria-pressed={selected.includes(p.label)} onMouseEnter={()=>onHover(p.label)} onMouseLeave={()=>onHover(null)} onFocus={()=>onHover(p.label)} onBlur={()=>onHover(null)} onClick={()=>onToggle(p.label)}><i style={{background:p.color}}/>{t(p.label)}</button>)}</div>
}
function PeriodPicker({selected,onToggle,onHover}:{selected:string[];onToggle:(label:string)=>void;onHover:(label:string|null)=>void}){
 const {t}=useI18n();
 const options=[...periods,{label:'Несколько периодов',min:null,max:null,color:'#999b91'}];
 const summary=selected.length===0?t('Все периоды'):selected.length===1?t(selected[0]):`${t('Выбрано: ')}${selected.length}`;
 return <details className="period-picker"><summary><span>{summary}</span><i aria-hidden="true"/></summary><div className="period-picker-menu">{options.map(p=><label key={p.label} onMouseEnter={()=>onHover(p.label)} onMouseLeave={()=>onHover(null)}><input type="checkbox" checked={selected.includes(p.label)} onChange={()=>onToggle(p.label)}/><i style={{background:p.color}}/>{t(p.label)}</label>)}</div></details>
}
function MultiSelect({id,label,allLabel,options,selected,onToggle}:{id:string;label:string;allLabel:string;options:{value:string;label:string;count:number}[];selected:string[];onToggle:(value:string)=>void}){
 const {t,language}=useI18n();
 const [query,setQuery]=useState('');
 const visible=options.filter(option=>normalize(option.label).includes(normalize(query)));
 const selectedLabels=selected.map(value=>options.find(option=>option.value===value)?.label||value);
 const more=selected.length>3?(language==='ru'?`, ещё ${selected.length-3}`:language==='ka'?`, კიდევ ${selected.length-3}`:language==='uk'?`, ще ${selected.length-3}`:`, +${selected.length-3} more`):'';
 const summary=selected.length===0?t(allLabel):selectedLabels.slice(0,3).join(', ')+more;
 return <div className="multi-filter"><label id={`${id}-label`}>{t(label)}</label><details className="multi-picker"><summary aria-labelledby={`${id}-label`}><span>{summary}</span><i aria-hidden="true"/></summary><div className="multi-picker-menu"><label className="multi-search"><Icon name="search" size={14}/><input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder={t('Найти…')} aria-label={t('Поиск: ')+t(label)}/></label>{selected.length>0&&<button type="button" className="multi-clear" onClick={()=>selected.forEach(onToggle)}>{t('Снять выбор')}</button>}<div className="multi-options">{visible.length?visible.map(option=><label key={option.value} className="multi-option"><input type="checkbox" checked={selected.includes(option.value)} onChange={()=>onToggle(option.value)}/><span>{option.label}</span><small>{option.count}</small></label>):<p className="multi-empty">{t('Совпадений нет')}</p>}</div></div></details></div>
}
function PhotoLightbox({building,src,index,total,description,onClose,onNext,onPrevious,opener}:{building:Building;src:string;index:number;total:number;description?:string;onClose:()=>void;onNext:()=>void;onPrevious:()=>void;opener:{current:HTMLButtonElement|null}}){
 const {t,language}=useI18n();
 const name=building.names?.[language]||building.name;
 const closeButton=useRef<HTMLButtonElement>(null);
 useEffect(()=>{const previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';closeButton.current?.focus();const key=(event:KeyboardEvent)=>{if(event.key==='Escape')onClose();else if(event.key==='ArrowRight')onNext();else if(event.key==='ArrowLeft')onPrevious()};window.addEventListener('keydown',key);return()=>{window.removeEventListener('keydown',key);document.body.style.overflow=previousOverflow;opener.current?.focus()}},[]);
 return createPortal(<div className="lightbox-backdrop" role="dialog" aria-modal="true" aria-label={t("Фотографии: ")+name} onClick={event=>{if(event.target===event.currentTarget)onClose()}}><div className="lightbox" onClick={event=>{if(event.target===event.currentTarget)onClose()}}><div className="lightbox-top"><span>{String(index+1).padStart(2,'0')} / {String(total).padStart(2,'0')}</span><button ref={closeButton} className="lightbox-close" onClick={onClose} aria-label={t("Закрыть фотографию")}><Icon name="close" size={22}/></button></div><div className="lightbox-view" onClick={event=>{if(event.target===event.currentTarget)onClose()}}>{total>1&&<button className="lightbox-nav previous" onClick={onPrevious} aria-label={t("Предыдущая фотография")}>‹</button>}<img src={src} alt={`${name}, фотография ${index+1}`}/>{total>1&&<button className="lightbox-nav next" onClick={onNext} aria-label={t("Следующая фотография")}>›</button>}</div><div className="lightbox-caption"><strong>{name}</strong>{description&&<p>{description}</p>}</div></div></div>,document.body);
}
function parseHash(){const p=new URLSearchParams(location.hash.slice(1));return {view:p.get('view')==='catalog'?'catalog' as View:'map' as View,id:p.get('building')}}
function Loader({onReady}:{onReady:(d:Data)=>void}){
 const {t}=useI18n();
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
 return <div className="loading"><div className="loading-mark">ა<span>•</span></div><p className="eyebrow">{t('АРХИТЕКТУРНЫЙ АТЛАС')}</p><h1>{t('Атлас Тбилиси')}</h1><div className="loader-line"/><p>{error||t(status)}</p>{error&&<button className="primary-button" onClick={()=>setAttempt(x=>x+1)}>{t('Попробовать снова')}</button>}</div>
}
function Inspector({building,photo,onClose,onMap,onFilter}:{building:Building;photo:string[];onClose:()=>void;onMap:()=>void;onFilter:(key:'architect'|'style',value:string)=>void}){
 const {t,language}=useI18n();
 const name=building.names?.[language]||building.name;
 const description=building.descriptions?.[language]||building.description;
 const history=building.histories?.[language]||(language==='ru'?building.history:'');
 const individualStyles=styleEntries(building,language);
 const constructionLabel=building.yearLabels?.[language]||building.yearLabel;
 const district=building.districts?.[language]||building.district;
 const architects=building.architectsByLanguage?.[language]||building.architects;
 const [photoIndex,setPhotoIndex]=useState(0),[lightboxOpen,setLightboxOpen]=useState(false);const credits=(building.photos??(building.photo?[building.photo]:[]))[photoIndex];
 const close=useRef<HTMLButtonElement>(null),photoOpener=useRef<HTMLButtonElement>(null);useEffect(()=>{close.current?.focus()},[building.id]);useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!lightboxOpen)onClose()};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)},[building.id,lightboxOpen]);
 const googleMapsUrl=building.googlePlaceId?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${building.nameEn||building.name}, ${building.address}, Tbilisi, Georgia`)}&query_place_id=${encodeURIComponent(building.googlePlaceId)}`:`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${building.coordinates[1]},${building.coordinates[0]}`)}`;
 function nextPhoto(){setPhotoIndex(i=>(i+1)%photo.length)}
 function previousPhoto(){setPhotoIndex(i=>(i+photo.length-1)%photo.length)}
 const p=period(building.minYear,building.maxYear)!;
 return <><aside className="inspector" aria-label={t("Информация: ")+name}>
  <div className="inspect-top"><span>{t("ОБЪЕКТ АТЛАСА")} <span className="index-no">/ {building.id.toUpperCase()}</span></span><button ref={close} className="icon-btn" onClick={onClose} aria-label={t("Закрыть карточку")}><Icon name="close"/></button></div>
  <div className="inspect-scroll">
   <div className="photo-wrap">{photo.length?<><button ref={photoOpener} className="photo-open" onClick={()=>setLightboxOpen(true)} aria-label={t("Открыть фотографию ")+`${photoIndex+1}`+t(" на весь экран")}><img src={photo[photoIndex]} alt={`${name}, фотография ${photoIndex+1}`}/></button>{photo.length>1&&<><button className="photo-prev" aria-label={t("Предыдущая фотография")} onClick={previousPhoto}>‹</button><button className="photo-next" aria-label={t("Следующая фотография")} onClick={nextPhoto}>›</button></>}<span className="photo-number">{String(photoIndex+1).padStart(2,"0")} / {String(photo.length).padStart(2,"0")}</span></>:<div className="no-photo">{t('Фотографии пока нет')}</div>}</div>
   <div className="inspect-body"><div className="inspect-meta"><span><span className="period-dot" style={{background:p.color}}/>{t(p.label)}</span><span>{district}</span></div>
    <h2>{name}</h2><p className="georgian">{building.nameKa}</p><a className="address address-link" href={googleMapsUrl} target="_blank" rel="noopener noreferrer" aria-label={t("Открыть адрес «")+building.address+t("» в Google Картах")}><Icon name="pin" size={15}/>{building.address}<Icon name="external" size={12}/></a>
    <p className="description">{description}</p>
    <div className="details"><div><span>{t("ПОСТРОЕНО")}</span><strong>{constructionLabel}</strong></div><div><span>{t("СТИЛЬ")}</span><strong>{individualStyles.map((item,index)=><Fragment key={item.id}>{index>0?', ':''}{item.id!=='undetermined'?<button className="detail-filter" onClick={()=>onFilter('style',item.id)} aria-label={t("Фильтр по стилю: ")+item.label}>{item.label}</button>:item.label}</Fragment>)}</strong></div><div className="full"><span>{t("АРХИТЕКТОР")}</span><strong>{architects.length?architects.map((architect,index)=><Fragment key={building.architectIds[index]||architect}>{index>0?', ':''}<button className="detail-filter" onClick={()=>onFilter('architect',building.architectIds[index]||architect)} aria-label={t("Фильтр по архитектору: ")+architect}>{architect}</button></Fragment>):t('Не установлен')}</strong></div></div>
    {history.trim()&&<><div className="section-rule"/><p className="eyebrow">{t('ИСТОРИЯ ЗДАНИЯ')}</p><p className="history">{history}</p></>}
    <button className="text-link map-link" onClick={onMap}><Icon name="pin" size={15}/> {t('Показать на карте')} <Icon name="arrow" size={16}/></button>
    <div className="credits"><p>{t('ДАННЫЕ И ФОТОГРАФИЯ')}</p><a href={building.source} target="_blank" rel="noreferrer">{t('Источник сведений')} <Icon name="external" size={12}/></a>{building.otherSource&&<a href={building.otherSource} target="_blank" rel="noreferrer">{t('Дополнительный источник')} <Icon name="external" size={12}/></a>}{credits&&<><a href={credits.source} target="_blank" rel="noreferrer">{t("Фото: ")}{credits.author} · {credits.license} <Icon name="external" size={12}/></a><span>{t(credits.modifications)}. <a href={credits.licenseUrl} target="_blank" rel="noreferrer">{t('Условия лицензии')}</a></span></>}<span>{t(building.geometryQuality)}.</span></div>
   </div>
  </div>
 </aside>{lightboxOpen&&credits&&<PhotoLightbox building={building} src={photo[photoIndex]} index={photoIndex} total={photo.length} description={credits.description} onClose={()=>setLightboxOpen(false)} onNext={nextPhoto} onPrevious={previousPhoto} opener={photoOpener}/>}</>
}
function AppContent({data}:{data:Data}){
 const {language,t,setLanguage}=useI18n();
 const init=useMemo(parseHash,[]),[city,setCity]=useState('tbilisi'),[view,setView]=useState<View>(init.view),[selected,setSelected]=useState<string|null>(init.id),[filters,setFilters]=useState<Filters>(initialFilters),[showFilters,setShowFilters]=useState(false),[showLegend,setShowLegend]=useState(true),[hoveredPeriod,setHoveredPeriod]=useState<string|null>(null),[selectedPeriods,setSelectedPeriods]=useState<string[]>([]),[focus,setFocus]=useState<{id:string;serial:number}|null>(null),[reset,setReset]=useState(0),[fit,setFit]=useState(0),[sort,setSort]=useState('name');
 const opener=useRef<HTMLElement|null>(null),firstHash=useRef(true),hadActiveFilters=useRef(false);
 const filtered=useMemo(()=>{const results=filterBuildings(data.buildings,filters) as Building[];return selectedPeriods.length?results.filter(b=>selectedPeriods.includes(period(b.minYear,b.maxYear)!.label)):results},[data.buildings,filters,selectedPeriods]);
 const architects=useMemo(()=>{const byId=new Map<string,{value:string;label:string;count:number}>();for(const building of data.buildings)building.architectIds.forEach((id,index)=>{const existing=byId.get(id);if(existing)existing.count++;else byId.set(id,{value:id,label:building.architectsByLanguage[language][index]||building.architects[index]||id,count:1})});const options=[...byId.values()].sort((a,b)=>a.label.localeCompare(b.label,language));const unknownCount=data.buildings.filter(building=>building.architects.length===0).length;if(unknownCount)options.push({value:'unknown',label:t('Не установлен'),count:unknownCount});return options},[data.buildings,language,t]);
 const styleOptions=useMemo(()=>{const byId=new Map<string,{value:string;label:string;count:number}>();for(const building of data.buildings)for(const style of styleEntries(building,language)){const existing=byId.get(style.id);if(existing)existing.count++;else byId.set(style.id,{value:style.id,label:style.label,count:1})}return [...byId.values()].sort((a,b)=>a.label.localeCompare(b.label,language))},[data.buildings,language]);
 const selectedBuilding=data.buildings.find(x=>x.id===selected)||null;
 const sortName=(building:Building)=>building.names?.[language]||building.name;const sorted=[...filtered].sort((a,b)=>sort==='name'?sortName(a).localeCompare(sortName(b),language):sort==='old'?(a.minYear??Infinity)-(b.minYear??Infinity)||sortName(a).localeCompare(sortName(b),language):(b.minYear??-Infinity)-(a.minYear??-Infinity)||sortName(a).localeCompare(sortName(b),language));
 useEffect(()=>{const p=new URLSearchParams();p.set('view',view);if(selected)p.set('building',selected);const hash='#'+p.toString();if(firstHash.current){firstHash.current=false;if(location.hash!==hash)history.replaceState(null,'',hash)}else if(location.hash!==hash)history.pushState(null,'',hash)},[view,selected]);
 useEffect(()=>{const pop=()=>{const h=parseHash();setView(h.view);setSelected(h.id)};window.addEventListener('popstate',pop);return()=>window.removeEventListener('popstate',pop)},[]);
 useEffect(()=>{if(selected&&!filtered.some(x=>x.id===selected))setSelected(null)},[filtered,selected]);
 function select(id:string){opener.current=document.activeElement as HTMLElement;setSelected(id)}
 function close(){setSelected(null);setTimeout(()=>opener.current?.focus(),0)}
 function goMap(id:string){setView('map');setSelected(id);setFocus({id,serial:Date.now()})}
 function update<K extends keyof Filters>(key:K,value:Filters[K]){setFilters(x=>({...x,[key]:value}))}
 function filterBy(key:'architect'|'style',value:string){setFilters(x=>({...x,[key]:x[key].includes(value)?x[key]:[...x[key],value]}));setShowFilters(true)}
 function toggleMultiFilter(key:'architect'|'style',value:string){setFilters(x=>({...x,[key]:x[key].includes(value)?x[key].filter(item=>item!==value):[...x[key],value]}))}
 function resetFilters(){setFilters(initialFilters);setSelectedPeriods([]);setHoveredPeriod(null)}
 function togglePeriod(label:string){setHoveredPeriod(null);setSelectedPeriods(current=>current.includes(label)?current.filter(x=>x!==label):[...current,label])}
 const activeCount=Number(!!filters.from||!!filters.to)+Number(filters.architect.length>0)+Number(filters.style.length>0)+Number(selectedPeriods.length>0);
 const hasActiveFilters=!!filters.query.trim()||activeCount>0;
 useEffect(()=>{if(hadActiveFilters.current&&!hasActiveFilters)setReset(x=>x+1);hadActiveFilters.current=hasActiveFilters},[hasActiveFilters]);
 const highlightedPeriods=hoveredPeriod?[...new Set([...selectedPeriods,hoveredPeriod])]:selectedPeriods;
 return <div className="app-shell">
  <header className="header"><div className="brand"><span className="brand-symbol">ა</span><span className="brand-name">{t('АРХИТЕКТУРНЫЙ АТЛАС')}<br/><b>{t(city==='tbilisi'?'Тбилиси':city==='batumi'?'Батуми':'Кутаиси').toLocaleUpperCase(language==='ka'?'ka':language==='uk'?'uk':'en')}</b></span></div><div className="header-right"><label className="city-label" htmlFor="city">{t('ГОРОД')}</label><select id="city" className="city-select" value={city} onChange={e=>setCity(e.target.value)}><option value="tbilisi">{t('Тбилиси')}</option><option value="batumi">{t('Батуми')}</option><option value="kutaisi">{t('Кутаиси')}</option></select><label className="city-label language-label" htmlFor="language">{t('ЯЗЫК')}</label><select id="language" className="city-select language-select" aria-label={t('ЯЗЫК')} value={language} onChange={e=>setLanguage(e.target.value as Language)}><option value="ru">Русский</option><option value="en">English</option><option value="ka">ქართული</option><option value="uk">Українська</option></select></div></header>
  <main className="workspace">
   {city==='tbilisi'?<>
   <div className="toolbar"><label className="search"><Icon name="search" size={18}/><input aria-label={t("Поиск по атласу")} value={filters.query} onChange={e=>update('query',e.target.value)} placeholder={t("Название, архитектор, адрес…")}/>{filters.query&&<button onClick={()=>update('query','')} aria-label={t("Очистить поиск")}><Icon name="close" size={14}/></button>}</label><button className={'filter-button '+(showFilters?'active':'')} onClick={()=>setShowFilters(!showFilters)} aria-expanded={showFilters}><Icon name="sliders" size={17}/> {t("Фильтры")} {activeCount>0&&<span className="filter-count">{activeCount}</span>}</button><div className="view-toggle" role="group" aria-label={t("Вид атласа")}><button className={view==='map'?'active':''} onClick={()=>setView('map')}><Icon name="map" size={16}/> {t('Карта')}</button><button className={view==='catalog'?'active':''} onClick={()=>setView('catalog')}><Icon name="list" size={16}/> {t('Каталог')}</button></div></div>
   {showFilters&&<div className="filter-panel"><div className="period-filter"><span className="period-filter-label">{t('Период постройки')}</span><PeriodPicker selected={selectedPeriods} onToggle={togglePeriod} onHover={setHoveredPeriod}/></div><div><label htmlFor="from">{t('Год от')}</label><input id="from" type="number" placeholder={t("Например, 1800")} value={filters.from} onChange={e=>update('from',e.target.value)}/></div><div><label htmlFor="to">{t('Год до')}</label><input id="to" type="number" placeholder={t("Например, 1920")} value={filters.to} onChange={e=>update('to',e.target.value)}/></div><MultiSelect id="architect" label="Архитектор" allLabel="Все архитекторы" options={architects} selected={filters.architect} onToggle={value=>toggleMultiFilter('architect',value)}/><MultiSelect id="style" label="Стиль" allLabel="Все стили" options={styleOptions} selected={filters.style} onToggle={value=>toggleMultiFilter('style',value)}/><button className="reset-filter" onClick={resetFilters}>{t('Сбросить')}</button></div>}
   <div className={'content '+(selectedBuilding?'has-selection':'')}>
   <div className="view-main">{view==='map'?<><MapView buildings={filtered} allBuildings={data.buildings} basemap={data.basemap as FeatureCollection} selected={selected} onSelect={select} focus={focus} reset={reset} fit={fit} showFit={hasActiveFilters} onFit={()=>setFit(x=>x+1)} highlightedPeriods={highlightedPeriods}/><div className="map-caption"><span className="caption-dot"/> {t('ТБИЛИСИ, ГРУЗИЯ')} <span className="caption-line"/> {hasActiveFilters?`${filtered.length}/${data.buildings.length}`:data.buildings.length} {t('ОБЪЕКТОВ')}</div><button className="overview" onClick={()=>setReset(x=>x+1)} title={t('Вернуться к центру')}>⌖</button><div className={'legend '+(!showLegend?'compact':'')}><div className="legend-head"><span>{t('Период постройки')}</span><button onClick={()=>setShowLegend(!showLegend)} aria-label={t(showLegend?'Свернуть легенду':'Развернуть легенду')}>{showLegend?'−':'+'}</button></div>{showLegend&&<><div className="legend-colors">{periods.slice(0,7).map(p=><span key={p.label} style={{background:p.color}}/>)}</div><div className="legend-range"><span>{t('ДО 1800')}</span><span>{t('1992 И ПОЗЖЕ')}</span></div><PeriodChoices className="legend-list legend-period-options" selected={selectedPeriods} onToggle={togglePeriod} onHover={setHoveredPeriod}/><p>{t('Цвет показывает датировку здания. Выбор периода — в панели фильтров.')}</p></>}</div></>:<div className="catalog"><div className="catalog-head"><div><h2>{t('Каталог')}</h2></div><label>{t('Сортировка')} <select value={sort} onChange={e=>setSort(e.target.value)}><option value="name">{t('По названию')}</option><option value="old">{t('Сначала старые')}</option><option value="new">{t('Сначала новые')}</option></select></label></div>{!sorted.length?<div className="empty"><h3>{t('Ничего не найдено')}</h3><p>{t('Попробуйте изменить запрос или сбросить фильтры.')}</p><button onClick={resetFilters}>{t('Сбросить фильтры')}</button></div>:<div className="cards">{sorted.map(b=><article key={b.id} className="card"><button className="card-image" onClick={()=>select(b.id)} aria-label={t('Подробнее: ')+(b.names?.[language]||b.name)}>{data.photos[b.id]?.length?<img src={data.photos[b.id][0]} alt=""/>:<div className="no-photo">{t('Фотографии пока нет')}</div>}<span className="card-year"><i style={{background:period(b.minYear,b.maxYear)!.color}}/>{b.yearLabels?.[language]||b.yearLabel}</span></button><div className="card-body"><span className="card-district">{b.districts?.[language]||b.district} / {b.styles?.[language]||b.style}</span><button className="card-title" onClick={()=>select(b.id)}>{b.names?.[language]||b.name}</button><p>{b.address}</p><button className="text-link" onClick={()=>goMap(b.id)}>{t('На карте')} <Icon name="arrow" size={15}/></button></div></article>)}</div>}</div>}</div>
    {selectedBuilding&&<Inspector key={selectedBuilding.id} building={selectedBuilding} photo={data.photos[selectedBuilding.id]} onClose={close} onMap={()=>goMap(selectedBuilding.id)} onFilter={filterBy}/>}
   </div>
   </>:<div className="city-empty"><h1>{city==='batumi'?'Батуми':'Кутаиси'}</h1><p>{t('Данные об архитектуре этого города пока не добавлены.')}</p><button onClick={()=>setCity('tbilisi')}>{t('Вернуться к карте Тбилиси')}</button></div>}
   <footer><span>{t("Данные: © участники OpenStreetMap")}</span></footer>
  </main>
 </div>
}
export default function App(){const [data,setData]=useState<Data|null>(null);const [language,setLanguageState]=useState<Language>(()=>{try{const saved=localStorage.getItem('atlas-language');return saved==='en'||saved==='ka'||saved==='uk'?saved:'ru'}catch{return 'ru'}});const setLanguage=(next:Language)=>{setLanguageState(next);try{localStorage.setItem('atlas-language',next)}catch{}};const t=(value:string)=>translate(value,language);return <I18nContext.Provider value={{language,t,setLanguage}}>{data?<AppContent data={data}/>:<Loader onReady={setData}/>}</I18nContext.Provider>}
