import test from 'node:test';
import assert from 'node:assert/strict';
import {HIGH_RATING,MIN_HIGH_PHOTOS,rankPhotos} from '../src/photo-ranking.js';

const photo=(id,rating)=>({id,rating});

test('sorts by rating and keeps the original order for ties',()=>{
 const input=[photo('a',20),photo('b',40),photo('c',30),photo('d',40)];
 assert.deepEqual(rankPhotos(input).map(item=>item.id),['b','d','c','a']);
});

test('keeps every photo when there are fewer than three strong photos',()=>{
 const input=[photo('a',80),photo('b',70),photo('c',20)];
 assert.deepEqual(rankPhotos(input).map(item=>item.id),['a','b','c']);
});

test('hides ratings below 50 when three photos above 50 exist',()=>{
 const input=[photo('low',49),photo('a',51),photo('b',80),photo('c',70),photo('exact',50)];
 const out=rankPhotos(input).map(item=>item.id);
 assert.deepEqual(out,['b','c','a','exact']);
 assert.equal(out.includes('low'),false);
});

test('three exactly-50 photos do not trigger hiding',()=>{
 const input=[photo('a',50),photo('b',50),photo('c',50),photo('low',10)];
 assert.deepEqual(rankPhotos(input).map(item=>item.id),['a','b','c','low']);
});

test('missing ratings are treated as zero and do not crash',()=>{
 const input=[{id:'a'},{id:'b',rating:60}];
 assert.deepEqual(rankPhotos(input).map(item=>item.id),['b','a']);
});

test('empty galleries stay empty',()=>{
 assert.deepEqual(rankPhotos([]),[]);
 assert.equal(HIGH_RATING,50);
 assert.equal(MIN_HIGH_PHOTOS,3);
});
