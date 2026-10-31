export const periods = [
  { label:'До 1800', min:-Infinity, max:1799, color:'#8d765f' },
  { label:'1800–1849', min:1800, max:1849, color:'#bd8b6b' },
  { label:'1850–1899', min:1850, max:1899, color:'#c8a35e' },
  { label:'1900–1919', min:1900, max:1919, color:'#a5a759' },
  { label:'1920–1959', min:1920, max:1959, color:'#729a78' },
  { label:'1960–1991', min:1960, max:1991, color:'#6595a1' },
  { label:'С 1992', min:1992, max:Infinity, color:'#7184ad' },
  { label:'Неизвестно', min:null, max:null, color:'#999b91' },
];
export function period(min,max){if(min===null||max===null)return periods.at(-1);const a=periods.find(x=>x.min!==null&&min>=x.min&&min<=x.max),b=periods.find(x=>x.min!==null&&max>=x.min&&max<=x.max);return a===b?a:{label:'Несколько периодов',color:'#999b91'}}
export function normalize(s){return (s||'').normalize('NFC').toLocaleLowerCase('ru').replaceAll('ё','е').replace(/[.,:;«»"'’()\-–—/]/g,' ').replace(/\s+/g,' ').trim()}
export function filterBuildings(buildings,f){
 const terms=normalize(f.query).split(' ').filter(Boolean); const from=f.from===''?-Infinity:Number(f.from),to=f.to===''?Infinity:Number(f.to); const dateActive=f.from!==''||f.to!==''; if(Number.isNaN(from)||Number.isNaN(to)||from>to)return [];
 return buildings.filter(b=>{const hay=normalize([b.name,b.nameKa,b.nameEn,b.address,b.district,b.style,...b.architects].join(' '));return terms.every(t=>hay.includes(t)) && (!dateActive||(b.minYear!==null&&b.minYear<=to&&b.maxYear>=from)) && (!f.architect||(f.architect==='unknown'?b.architects.length===0:b.architects.includes(f.architect))) && (!f.style||f.style===b.style)})
}
