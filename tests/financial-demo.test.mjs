import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';
import React from 'react';

test('isolated demo creates and edits a canonical invoice and blocks overlaps', async () => {
  process.env.VITE_ARENA_DEMO='false';
  globalThis.__rawdatiSupabaseClient__ = {}; // DemoProviders never makes network requests.
  const dom = new JSDOM('<!doctype html><div id="root"></div>',{url:'http://localhost:3000',pretendToBeVisual:true});
  for(const key of ['window','document','navigator','localStorage','sessionStorage','HTMLElement','Element','Node','Event','MouseEvent','MutationObserver','getComputedStyle','requestAnimationFrame','cancelAnimationFrame']) if(key in dom.window) Object.defineProperty(globalThis,key,{configurable:true,value:['getComputedStyle','requestAnimationFrame','cancelAnimationFrame'].includes(key)?dom.window[key].bind(dom.window):dom.window[key]});
  window.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}});
  window.scrollTo=()=>{};
  const server=await createServer({server:{middlewareMode:true},appType:'custom'});
  let root;
  try {
    const {createRoot}=await import('react-dom/client');
    const {ToastProvider}=await server.ssrLoadModule('/src/contexts/ToastContext.tsx');
    const {LanguageProvider}=await server.ssrLoadModule('/src/contexts/LanguageContext.tsx');
    const {ConfirmProvider}=await server.ssrLoadModule('/src/contexts/ConfirmDialogContext.tsx');
    const {DemoProviders}=await server.ssrLoadModule('/src/demo/DemoProviders.tsx');
    const {useDb}=await server.ssrLoadModule('/src/contexts/DbContext.tsx');
    const {default:Paiements}=await server.ssrLoadModule('/src/components/Paiements.tsx');
    let db; function Capture(){db=useDb();return React.createElement(Paiements)}
    root=createRoot(document.getElementById('root'));
    root.render(React.createElement(LanguageProvider,null,React.createElement(ToastProvider,null,React.createElement(ConfirmProvider,null,React.createElement(DemoProviders,null,React.createElement(Capture))))));
    const wait=()=>new Promise(resolve=>setTimeout(resolve,120)); const body=()=>document.body.textContent.replace(/\s+/g,' ');
    const button=t=>[...document.querySelectorAll('button')].find(b=>b.textContent.includes(t));
    const click=b=>{assert.ok(b);b.dispatchEvent(new MouseEvent('click',{bubbles:true}))};
    const open=async()=>{click(button('Créer une facture'));await wait(); const select=[...document.querySelectorAll('select')].find(s=>[...s.options].some(o=>o.value==='demo-child-2')); select.value='demo-child-2';select.dispatchEvent(new Event('change',{bubbles:true}));await wait();};
    const save=()=>click([...document.querySelectorAll('button')].find(b=>b.textContent.includes('common.save')||b.textContent.trim()==='Enregistrer'));
    await wait();
    await assert.rejects(db.checkInvoiceReminder(db.paiements.find(p=>p.id==='demo-payment-1'),db.enfants.find(c=>c.id==='demo-child-1')),/finance_changed/);
    await open(); save(); await wait();
    const invoice=db.paiements.find(item=>item.enfantId==='demo-child-2'); assert.ok(invoice); assert.match(invoice.periodeCle,/^M:\d{4}-\d{2}$/); assert.equal(invoice.montant,12000);
    const before={...invoice}; await db.updatePaiement(invoice.id,{statut:'Payé',moyenPaiement:'Espèces'},before); await wait();
    await assert.rejects(db.updatePaiement(invoice.id,{montant:1},before),/finance_changed/);
    await open(); save(); await wait(); assert.match(body(),/facture existe déjà pour cette période/i);
    await assert.rejects(db.deletePaiement(invoice.id),/finance_deletion_paused/);
    click([...document.querySelectorAll('button')].find(b=>b.textContent.includes('common.cancel') || b.textContent.trim()==='Annuler')); await wait();
    document.querySelector('details summary').click();
    const reviewSelect=[...document.querySelectorAll('select')].find(s=>[...s.options].some(o=>o.value==='demo-old-invoice'));
    reviewSelect.value='demo-old-invoice';reviewSelect.dispatchEvent(new Event('change',{bubbles:true}));await wait();
    const type=[...document.querySelectorAll('select')].find(s=>[...s.options].some(o=>o.value==='M'));
    type.value='M';type.dispatchEvent(new Event('change',{bubbles:true}));await wait();
    const month=document.querySelector('input[type=month]');Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set.call(month,db.paiements.find(p=>p.id==='demo-payment-1').periodeCle.slice(2));month.dispatchEvent(new Event('input',{bubbles:true}));
    const reason=document.querySelector('textarea');Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype,'value').set.call(reason,'Exemple vérifié');reason.dispatchEvent(new Event('input',{bubbles:true}));
    document.querySelectorAll('input[type=checkbox]').forEach(box=>box.click());await wait();click(button('Confirmer la période'));await wait();
    assert.match(body(),/facture existe déjà pour cette période/i); assert.equal(db.paiements.find(p=>p.id==='demo-old-invoice').periodeCle,undefined);
    Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set.call(month,'2024-02');month.dispatchEvent(new Event('input',{bubbles:true}));await wait();click(button('Confirmer la période'));await wait();
    assert.match(body(),/Période rapprochée/); assert.equal(db.paiements.find(p=>p.id==='demo-old-invoice').periodeCle,'M:2024-02');
    assert.equal(db.paiements.find(p=>p.id==='demo-old-invoice').moisConcerne,'février 2024 (exemple)');
    click(button('Voir la trace de revue'));await wait();assert.match(body(),/Exemple vérifié/);
    const reminder=db.paiements.find(p=>p.id==='demo-payment-1');const child=db.enfants.find(c=>c.id==='demo-child-1');
    await db.checkInvoiceReminder(reminder,child);await assert.rejects(db.checkInvoiceReminder(reminder,child,'0555000000'),/finance_changed/);
  } finally { root?.unmount(); await server.close(); dom.window.close(); delete globalThis.__rawdatiSupabaseClient__; }
});
