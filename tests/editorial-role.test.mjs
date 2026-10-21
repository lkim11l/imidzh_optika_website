import test from 'node:test';
import assert from 'node:assert/strict';
import {editorialData} from '../dist/assets/data/editorial.js';

test('Natalia stays co-owner for defaults and previously saved owner labels',()=>{
 assert.equal(editorialData().nataliaRole,'Совладелец · 25 лет опыта');
 assert.equal(editorialData({nataliaRole:'Владелец · 25 лет опыта'}).nataliaRole,'Совладелец · 25 лет опыта');
 assert.equal(editorialData({nataliaRole:'Совладелец'}).nataliaRole,'Совладелец');
 assert.equal(editorialData({eduardRole:'Владелец'}).eduardRole,'Владелец');
});
