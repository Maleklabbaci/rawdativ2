import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';
import React from 'react';

test('demo flags and clears a suspect pair, preserves amounts and records period corrections', async () => {
  process.env.VITE_ARENA_DEMO='false'; globalThis.__rawdatiSupabaseClient__={};
  const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'http://localhost:3000',pretendToBeVisual:true});
  for(const key of ['window','document','navigator','localStorage','sessionStorage','HTMLElement','Element','Node','Event','MouseEvent','MutationObserver','getComputedStyle','requestAnimationFrame','cancelAnimationFrame']) if(key in dom.window) Object.defineProperty(globalThis,key,{configurable:true,value:['getComputedStyle','requestAnimationFrame','cancelAnimationFrame'].includes(key)?dom.window[key].bind(dom.window):dom.window[key]});
  window.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}});window.scrollTo=()=>{};
  const server=await createServer({server:{middlewareMode:true},appType:'custom'});let root;
  try {
    const {createRoot}=await import('react-dom/client');
    const {ToastProvider}=await server.ssrLoadModule('/src/contexts/ToastContext.tsx'); const {LanguageProvider}=await server.ssrLoadModule('/src/contexts/LanguageContext.tsx');
    const {ConfirmProvider}=await server.ssrLoadModule('/src/contexts/ConfirmDialogContext.tsx'); const {DemoProviders}=await server.ssrLoadModule('/src/demo/DemoProviders.tsx');
    const {DbContext,useDb}=await server.ssrLoadModule('/src/contexts/DbContext.tsx');
    const {default:Paiements}=await server.ssrLoadModule('/src/components/Paiements.tsx'); const {default:Communication}=await server.ssrLoadModule('/src/components/Communication.tsx');
    let db,lose=true;
    function Override(){
      const original=useDb();const [ready,setReady]=React.useState(true);db=original;
      const value={...original,financialDataReady:ready,refreshAll:async()=>setReady(true),invoiceReviewAction:async draft=>{const saved=await original.invoiceReviewAction(draft);if(lose){lose=false;setReady(false);throw Error('response lost')}return saved}};
      return React.createElement(DbContext.Provider,{value},React.createElement(React.Fragment,null,React.createElement(Paiements),React.createElement(Communication)));
    }
    root=createRoot(document.getElementById('root'));root.render(React.createElement(LanguageProvider,null,React.createElement(ToastProvider,null,React.createElement(ConfirmProvider,null,React.createElement(DemoProviders,null,React.createElement(Override))))));
    const wait=()=>new Promise(r=>setTimeout(r,120)),text=()=>document.body.textContent.replace(/\s+/g,' '),click=e=>{assert.ok(e);e.dispatchEvent(new MouseEvent('click',{bubbles:true}));};
    const setSelect=(el,v)=>{assert.ok(el);el.value=v;el.dispatchEvent(new Event('change',{bubbles:true}));};
    const setText=(el,v)=>{assert.ok(el);const proto=el.tagName==='TEXTAREA'?dom.window.HTMLTextAreaElement.prototype:dom.window.HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,v);el.dispatchEvent(new Event('input',{bubbles:true}));};
    const button=(scope,label)=>[...scope.querySelectorAll('button')].find(b=>b.textContent.includes(label));
    const panel=()=>[...document.querySelectorAll('details')].find(d=>d.querySelector('summary')?.textContent.includes('Corriger une période ou signaler'));
    await wait();let box=panel();click(box.querySelector('summary'));
    setSelect(box.querySelector('select'),'demo-old-invoice');await wait();
    setSelect([...box.querySelectorAll('select')].find(s=>[...s.options].some(o=>o.value==='flag_duplicate')),'flag_duplicate');await wait();
    setSelect([...box.querySelectorAll('select')].slice(1).find(s=>[...s.options].some(o=>o.value==='demo-payment-1')),'demo-payment-1');
    setText(box.querySelector('textarea'),'À comparer au registre papier');box.querySelector('input[type=checkbox]').click();await wait();
    click(button(box,'Enregistrer la décision'));await wait();assert.match(text(),/Chargement des enfants ou des factures non confirmé/);
    assert.equal(db.paiements.find(p=>p.id==='demo-old-invoice').doublonSuspect.targetInvoiceId,'demo-payment-1');
    click(button(document,'Recharger les données'));await wait();
    box=panel(); setSelect(box.querySelector('select'),'demo-old-invoice');await wait();
    assert.match(text(),/soupçon lié/i);assert.match(text(),/restent dans les totaux/i);assert.match(text(),/exclues des rappels/i);
    assert.match(box.textContent,/Revue manuelle avec le comptable/);
    assert.match(box.textContent,/le statut « Payé » ne constitue pas une preuve/);
    assert.match(box.textContent,/si le doublon est confirmé ou incertain, laissez les factures en attente/i);
    assert.match(box.textContent,/Aucun avis du comptable n’est enregistré ou envoyé ici/);
    const main=db.paiements.find(p=>p.id==='demo-payment-1');await assert.rejects(db.updatePaiement(main.id,{statut:'Payé'},main),/finance_duplicate_review_pending/);
    click(button(box,'Voir les corrections et signalements'));await wait();assert.match(box.textContent,/À comparer au registre papier/);
    setSelect([...box.querySelectorAll('select')].find(s=>[...s.options].some(o=>o.value==='clear_suspicion')),'clear_suspicion');await wait();
    setText(box.querySelector('textarea'),'Deux périodes différentes sur les justificatifs');box.querySelector('input[type=checkbox]').click();await wait();click(button(box,'Enregistrer la décision'));await wait();
    assert.equal(db.paiements.find(p=>p.id==='demo-old-invoice').doublonSuspect,undefined);assert.equal(db.paiements.find(p=>p.id==='demo-old-invoice').montant,11000);
    click(button(box,'Voir les corrections et signalements'));await wait();assert.match(box.textContent,/Soupçon écarté/);
    setSelect(box.querySelector('select'),'demo-payment-1');await wait();
    setSelect([...box.querySelectorAll('select')].find(s=>[...s.options].some(o=>o.value==='correct_period')),'correct_period');await wait();
    setSelect([...box.querySelectorAll('select')].find(s=>[...s.options].some(o=>o.value==='M')),'M');await wait();
    setText(box.querySelector('input[type=month]'),'2022-01');setText(box.querySelector('textarea'),'Date corrigée selon le dossier');box.querySelector('input[type=checkbox]').click();await wait();click(button(box,'Enregistrer la décision'));await wait();
    const corrected=db.paiements.find(p=>p.id==='demo-payment-1');assert.equal(corrected.periodeCle,'M:2022-01');assert.equal(corrected.montant,12000);assert.notEqual(corrected.moisConcerne,'2022-01');
    click(button(box,'Voir les corrections et signalements'));await wait();assert.match(box.textContent,/Date corrigée selon le dossier/);
  } finally {root?.unmount();await server.close();dom.window.close();delete globalThis.__rawdatiSupabaseClient__;}
});
