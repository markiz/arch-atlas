import test from 'node:test';
import assert from 'node:assert/strict';
import {period,normalize,filterBuildings} from '../src/domain.js';
const empty={query:'',from:'',to:'',architect:'',style:'',includeUnknown:false};
const data=[
 {id:'old',name:'Анчисхати',nameKa:'ანჩისხატი',nameEn:'Anchiskhati',address:'Шавтели',district:'Старый Тбилиси',style:'Базилика',architects:[],minYear:501,maxYear:600},
 {id:'uncertain',name:'Дом Ёжика',nameKa:'სახლი',nameEn:'House',address:'Тбилиси',district:'Центр',style:'Модерн',architects:['Заар','Озеров'],minYear:1895,maxYear:1905},
 {id:'unknown',name:'Дом без даты',nameKa:'',nameEn:'',address:'',district:'',style:'Модерн',architects:[],minYear:null,maxYear:null}
];
test('period boundaries and ranges',()=>{assert.equal(period(1799,1799).label,'До 1800');assert.equal(period(1800,1800).label,'1800–1849');assert.equal(period(1899,1899).label,'1850–1899');assert.equal(period(1900,1900).label,'1900–1919');assert.equal(period(1992,1992).label,'С 1992');assert.equal(period(1895,1905).label,'Несколько периодов');assert.equal(period(null,null).label,'Неизвестно')});
test('normalization and multilingual search',()=>{assert.equal(normalize(' ЁЖИК—дом  '),'ежик дом');assert.deepEqual(filterBuildings(data,{...empty,query:'ежика заар'}).map(x=>x.id),['uncertain']);assert.deepEqual(filterBuildings(data,{...empty,query:'ანჩისხატი'}).map(x=>x.id),['old'])});
test('date intersection, unknown and inverted interval',()=>{assert.deepEqual(filterBuildings(data,{...empty,from:'1900',to:'1920'}).map(x=>x.id),['uncertain']);assert.deepEqual(filterBuildings(data,{...empty,from:'1900',to:'1920',includeUnknown:true}).map(x=>x.id),['uncertain','unknown']);assert.deepEqual(filterBuildings(data,{...empty,from:'600',to:'500'}),[])});
test('architect, style and query combine',()=>{assert.deepEqual(filterBuildings(data,{...empty,architect:'Заар',style:'Модерн',query:'дом'}).map(x=>x.id),['uncertain']);assert.deepEqual(filterBuildings(data,{...empty,architect:'unknown'}).map(x=>x.id),['old','unknown'])});
