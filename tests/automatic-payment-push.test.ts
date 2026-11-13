import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Paiement } from '../src/types';
import { paymentChangeMessage } from '../src/utils/automaticPaymentPush';
const invoice: Paiement = { id: 'x', enfantId: 'a', statut: 'En attente', montant: 1000, moisConcerne: '2026-11' };
test('payment push follows confirmed meaningful state changes, not edits or unrelated invoices', () => {
 assert.match(paymentChangeMessage(null, invoice, false) || '', /facture/);
 assert.match(paymentChangeMessage(invoice, {...invoice, statut:'Payé'}, false) || '', /Paiement enregistré/);
 assert.equal(paymentChangeMessage(invoice, {...invoice, montant: 2000}, false), null);
 assert.equal(paymentChangeMessage(invoice, {...invoice, enfantId:'b', statut:'Payé'}, false), null);
 assert.equal(paymentChangeMessage(invoice, {...invoice, statut:'Annulé'}, false), null);
 assert.doesNotMatch(paymentChangeMessage(invoice, {...invoice, statut:'Payé'}, false) || '', /1000|2026/);
});
