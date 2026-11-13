import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plannedActivityMessage } from '../src/utils/automaticActivityPush';
import type { Activite } from '../src/types';
const a: Activite = {id:'a',crecheId:'c1',date:'2027-02-27',groupe:'Bébés',titre:'Peinture'};
test('notifications describe plans, only for this nursery and valid non-historical activities',()=>{
 assert.equal(plannedActivityMessage(a,'c1','2027-02-26',false),'Activité prévue : Peinture — 2027-02-27.');
 assert.equal(plannedActivityMessage(a,'c2','2027-02-26',false),null);
 assert.equal(plannedActivityMessage(a,'c1','2027-02-28',false),null);
 assert.equal(plannedActivityMessage({...a,date:'2027-02-30'},'c1','2027-02-26',false),null);
 assert.equal(plannedActivityMessage({...a,titre:' '},'c1','2027-02-26',false),null);
});
