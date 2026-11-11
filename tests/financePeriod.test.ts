import { test } from 'node:test';
import assert from 'node:assert/strict';
import { invoicePeriod, suspectedInvoiceIds, reminderBlockReason, reminderContext } from '../src/utils/financePeriod';
import { buildCommandCenterAlerts } from '../src/utils/commandCenterRules';

test('reviewed period is shown without changing the original historical label', () => {
  const invoice = { moisConcerne: 'ancien texte', periodeCle: 'M:2025-02' };
  assert.equal(invoicePeriod(invoice), '2025-02');
  assert.equal(invoice.moisConcerne, 'ancien texte');
  assert.equal(invoicePeriod({ moisConcerne: 'période inconnue' }), 'période inconnue');
  assert.equal(invoicePeriod({ moisConcerne: 'année précédente', periodeCle:'A:2024' }), '2024');
});


test('both sides of a suspected pair are held without cancelling the invoices', () => {
  const records = [
    {id:'a', enfantId:'child', montant:100, statut:'Payé' as const, moisConcerne:'2024', doublonSuspect:{targetInvoiceId:'b',eventId:'request'}},
    {id:'b', enfantId:'child', montant:100, statut:'En attente' as const, moisConcerne:'2024'},
    {id:'c', enfantId:'child', montant:100, statut:'Payé' as const, moisConcerne:'2025'},
  ];
  assert.deepEqual([...suspectedInvoiceIds(records)].sort(),['a','b']);
  assert.equal(records[0].montant,100);
  const alerts=buildCommandCenterAlerts({enfants:[],presences:[],personnel:[],classes:[],paiements:records,now:new Date('2026-01-01'),maxAlerts:10});
  assert.ok(alerts.some(alert=>alert.id==='payments-suspected-duplicates'));
  assert.ok(!alerts.some(alert=>alert.id==='payments-overdue'));
});


test('reminders require an explicit valid period, positive amount and known status', () => {
  const base = {id:'p',enfantId:'c',montant:100,statut:'En attente' as const,moisConcerne:'ancien'};
  const held = reminderContext([]);
  assert.equal(reminderBlockReason(base,held),'period');
  for (const periodeCle of ['M:0000-01','M:2025-00','M:2025-13','A:0000','M:2025-1','junk'])
    assert.equal(reminderBlockReason({...base,periodeCle},held),'period');
  for (const periodeCle of ['M:2025-01','A:2025']) assert.equal(reminderBlockReason({...base,periodeCle},held),null);
  for (const montant of [0,-10,NaN,Infinity, '100' as unknown as number])
    assert.equal(reminderBlockReason({...base,periodeCle:'M:2025-01',montant},held),'details');
  assert.equal(reminderBlockReason({...base,periodeCle:'M:2025-01',statut:'Inconnu' as typeof base.statut},held),'details');
  assert.equal(reminderBlockReason({...base,statut:'Payé'},held),'paid');
  assert.equal(reminderBlockReason({...base,periodeCle:'M:2025-01'},{...held,suspectedIds:new Set(['p'])}),'duplicate');
  const alerts=buildCommandCenterAlerts({enfants:[],presences:[],personnel:[],classes:[],paiements:[{...base,statut:'Retard'}],now:new Date(),maxAlerts:10});
  assert.ok(alerts.some(alert=>alert.id==='payments-reminder-review'));
  assert.ok(!alerts.some(alert=>alert.id==='payments-overdue'));
});


test('an unknown sibling period holds reminders for the whole child, including a paid legacy sibling', () => {
  const base = {id:'p',enfantId:'c',montant:100,statut:'Retard' as const,moisConcerne:'2025-01',periodeCle:'M:2025-01'};
  const legacy = {id:'old',enfantId:'c',montant:100,statut:'Payé' as const,moisConcerne:'papier'};
  const other = {...base,id:'other',enfantId:'other-child'};
  const index=reminderContext([base,legacy,other]);
  assert.equal(reminderBlockReason(base,index),'sibling-period');
  assert.equal(reminderBlockReason(other,index),null);
  assert.equal(reminderBlockReason(legacy,index),'paid');
  const invalid=reminderContext([base,{...legacy,periodeCle:'M:2025-13'}]);
  assert.equal(reminderBlockReason(base,invalid),'sibling-period');
  const reviewed=reminderContext([base,{...legacy,periodeCle:'M:2024-01'}]);
  assert.equal(reminderBlockReason(base,reviewed),null);
  const alerts=buildCommandCenterAlerts({enfants:[],presences:[],personnel:[],classes:[],paiements:[base,legacy],now:new Date(),maxAlerts:10});
  assert.ok(alerts.some(alert=>alert.id==='payments-reminder-review'));
  assert.ok(!alerts.some(alert=>alert.id==='payments-overdue'));
});
