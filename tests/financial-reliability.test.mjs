import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';
import React from 'react';

// A fake PostgREST client exercises the real provider and UI. It does not replace
// integration tests against Supabase RLS or concurrent database sessions.
test('financial reads and uncertain writes are not presented as confirmed', async () => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost:3000', pretendToBeVisual: true });
  for (const key of ['window','document','navigator','localStorage','sessionStorage','HTMLElement','Element','Node','Event','MouseEvent','MutationObserver','getComputedStyle','requestAnimationFrame','cancelAnimationFrame']) {
    if (key in dom.window) Object.defineProperty(globalThis, key, { configurable: true, value: ['getComputedStyle','requestAnimationFrame','cancelAnimationFrame'].includes(key) ? dom.window[key].bind(dom.window) : dom.window[key] });
  }
  window.matchMedia = () => ({ matches: false, addEventListener(){}, removeEventListener(){}, addListener(){}, removeListener(){} });
  window.scrollTo = () => {};
  const rows = {
    enfants: [{ id:'child-1', data:{ nom:'Test', prenom:'Lina', crecheId:'director', parents:[] } }],
    paiements: [{ id:'payment-1', data:{ enfantId:'child-1', montant:1000, statut:'En attente', moisConcerne:'Janvier' } }],
  };
  let failRead = false, failChild = false, lostWrite = false, lostReview = false, lostAction = false, failReviewHistory = false, legacyBlock = false, duplicateBlocked = false, failPreflight = false, neverPreflight = false, inserts = 0;
  const reviews = {}; const actions = {};
  let resolveInsert, resolveCheck;
  const client = {
    from(table) {
      return {
        select() {
          const result = () => (table === 'paiements' && failRead) || (table === 'enfants' && failChild)
            ? {data:null,error:{message:'unavailable'}} : {data:rows[table] || [],error:null};
          return { then: (yes, no) => Promise.resolve(result()).then(yes,no), order() { return {range: async (start,end) => { const r=result(); return {...r, data:r.data?.slice(start,end+1) || null, count:r.data?.length ?? null}; }}; }, eq(_field,id) { return { maybeSingle: async () => ({data: (rows[table] || []).find(r=>r.id===id) || null,error:null}) }; } };
        },
        async insert(row) {
          if (table==='paiements') throw new Error('unsafe direct write');
          inserts++;
          if (resolveInsert) await new Promise(resolve => { const notify=resolveInsert; resolveInsert=resolve; notify(); });
          (rows[table] ||= []).push(row);
          if (lostWrite) { lostWrite = false; throw new Error('response lost'); }
          return {error:null};
        },
        update({data}) { return {eq: async (_f,id) => { const item=(rows[table] || []).find(r=>r.id===id); if (!item) return {count:0,error:null}; item.data=data; return {count:1,error:null}; }}; },
        delete() { return {eq: async (_f,id) => { const list=rows[table] || []; const i=list.findIndex(r=>r.id===id); if(i<0)return {count:0,error:null}; list.splice(i,1); return {count:1,error:null}; }}; },
      };
    },
    async rpc(name, args) {
      if (duplicateBlocked && ['rawdha_write_invoice','rawdha_review_invoice_period','rawdha_invoice_review_action','rawdha_check_invoice_reminder'].includes(name)) return {data:null,error:{message:'finance_duplicate_review_pending'}};
      if (name==='rawdha_check_invoice_reminder') {
        if (neverPreflight) return new Promise(()=>{});
        if (resolveCheck) await new Promise(resolve=>{const notify=resolveCheck;resolveCheck=resolve;notify();});
        if (failPreflight) return {data:null,error:{message:'offline'}};
        return {data:true,error:null};
      }
      if (name==='rawdha_list_invoice_review_events') return {data:actions[args.p_invoice_id] || [],error:null};
      if (name==='rawdha_invoice_review_action') {
        const item=rows.paiements.find(row=>row.id===args.p_invoice_id); const expected={...args.p_expected};delete expected.id;
        if (!item || JSON.stringify(item.data)!==JSON.stringify(expected)) return {data:null,error:{message:'finance_changed'}};
        const before={...item.data}; item.data={...item.data,periodeCle:args.p_period_key};
        (actions[item.id] ||= []).push({requestId:args.p_request_id,invoiceId:item.id,action:args.p_action,periodKey:args.p_period_key,targetInvoiceId:null,reason:args.p_reason,beforeData:before,afterData:{...item.data},targetBefore:null,createdBy:'admin',createdAt:'2026-11-08T00:00:00Z'});
        if(lostAction){lostAction=false;throw Error('response lost');} return {data:{...item.data,id:item.id},error:null};
      }
      if (name==='rawdha_get_invoice_period_review') return failReviewHistory ? {data:null,error:{message:'unavailable'}} : {data:reviews[args.p_invoice_id] || null,error:null};
      if (name==='rawdha_review_invoice_period') {
        const item=rows.paiements.find(row=>row.id===args.p_invoice_id);
        const expected={...args.p_expected}; delete expected.id;
        if (!item || JSON.stringify(item.data)!==JSON.stringify(expected)) return {data:null,error:{message:'finance_changed'}};
        reviews[item.id]={invoiceId:item.id,enfantId:item.data.enfantId,periodKey:args.p_period_key,reason:args.p_reason,originalData:{...item.data},reviewedBy:'admin',reviewedAt:'2026-11-08T00:00:00Z'};
        item.data={...item.data,periodeCle:args.p_period_key};
        if (lostReview) {lostReview=false; throw new Error('response lost');}
        return {data:{...item.data,id:item.id},error:null};
      }
      assert.equal(name,'rawdha_write_invoice');
      const {p_action,p_id,p_patch,p_expected}=args;
      if (p_action==='create') {
        if (legacyBlock) return {data:null,error:{message:'finance_legacy_review_required'}};
        inserts++;
        if (resolveInsert) await new Promise(resolve => { const notify=resolveInsert; resolveInsert=resolve; notify(); });
        rows.paiements.push({id:p_id,data:p_patch});
        if (lostWrite) { lostWrite=false; throw new Error('response lost'); }
        return {data:{...p_patch,id:p_id},error:null};
      }
      const item=rows.paiements.find(row=>row.id===p_id);
      const expected={...p_expected}; delete expected.id;
      if (!item || JSON.stringify(item.data)!==JSON.stringify(expected)) return {data:null,error:{message:'finance_changed'}};
      for (const [key,value] of Object.entries(p_patch)) { if (value===null) delete item.data[key]; else item.data[key]=value; }
      return {data:{...item.data,id:p_id},error:null};
    },
    auth: { refreshSession: async () => ({ error:null }) },
    channel: () => ({ on(){return this;}, subscribe(){return this;} }),
    removeChannel: async () => {},
  };
  globalThis.__rawdatiSupabaseClient__ = client;
  const server = await createServer({ server: { middlewareMode:true }, appType:'custom' });
  let root;
  try {
    const {createRoot} = await import('react-dom/client');
    const {getCollectionDataStrict} = await server.ssrLoadModule('/src/supabase.ts');
    rows.large = Array.from({length: 1001}, (_, i) => ({id:String(i).padStart(4,'0'),data:{n:i}}));
    assert.equal((await getCollectionDataStrict('large')).length, 1001);
    failRead=true; await assert.rejects(getCollectionDataStrict('paiements')); failRead=false;
    const {AuthContext} = await server.ssrLoadModule('/src/contexts/AuthContext.tsx');
    const {DbProvider, useDb} = await server.ssrLoadModule('/src/contexts/DbContext.tsx');
    const {ToastProvider} = await server.ssrLoadModule('/src/contexts/ToastContext.tsx');
    const {LanguageProvider} = await server.ssrLoadModule('/src/contexts/LanguageContext.tsx');
    const {ConfirmProvider} = await server.ssrLoadModule('/src/contexts/ConfirmDialogContext.tsx');
    const {default:Paiements} = await server.ssrLoadModule('/src/components/Paiements.tsx');
    const {default:Facture} = await server.ssrLoadModule('/src/components/Facture.tsx');
    let db;
    function Capture() { db = useDb(); return React.createElement(Paiements); }
    const auth = {user:{id:'admin',role:'admin'},creche:{nom:'Crèche'},loading:false};
    root = createRoot(document.getElementById('root'));
    const render = child => root.render(React.createElement(LanguageProvider,null,React.createElement(ToastProvider,null,React.createElement(ConfirmProvider,null,React.createElement(AuthContext.Provider,{value:auth},React.createElement(DbProvider,null,child))))));
    const wait = () => new Promise(r=>setTimeout(r,100));
    const text = () => document.body.textContent.replace(/\s+/g,' ');
    const draft = {enfantId:'child-1',montant:2000,statut:'En attente',typeFacture:'Mensuel',moisConcerne:'2026-02',periodeCle:'M:2026-02'};
    failRead=true; render(React.createElement(Capture)); await wait();
    assert.equal(db.financialDataReady,false); assert.match(text(),/Chargement des enfants ou des factures non confirmé/);
    failRead=false; await db.refreshAll(); await wait(); assert.equal(db.financialDataReady,true); assert.match(text(),/génération automatique et la suppression sont suspendues/); assert.equal(inserts,0);
    let notifyStart; const started = new Promise(resolve=>notifyStart=resolve); resolveInsert=notifyStart;
    const pending = db.addPaiement(draft); await started; assert.equal(db.paiements.length,1); await db.refreshAll(); await wait(); assert.equal(db.financialDataReady,false); resolveInsert(); resolveInsert = null; await pending; await wait(); assert.equal(db.paiements.length,2); await db.refreshAll(); await wait(); assert.equal(db.financialDataReady,true);
    lostWrite=true; await assert.rejects(db.addPaiement({...draft,moisConcerne:'2026-03',periodeCle:'M:2026-03'})); await wait();
    assert.equal(db.financialDataReady,false); assert.equal(db.paiements.length,2); assert.equal(rows.paiements.length,3);
    await db.refreshAll(); await wait(); assert.equal(db.financialDataReady,true); assert.equal(db.paiements.length,3);
    failChild=true; await db.refreshAll(); await wait(); assert.equal(db.financialDataReady,false); assert.match(text(),/Chargement des enfants ou des factures non confirmé/);
    failChild=false; await db.refreshAll(); await wait();
    const checkInvoice = () => db.checkInvoiceReminder(db.paiements.find(p=>p.id==='payment-1'),db.enfants.find(c=>c.id==='child-1'));
    await checkInvoice();
    duplicateBlocked=true;await assert.rejects(checkInvoice());await wait();assert.equal(db.financialDataReady,false);
    duplicateBlocked=false;await db.refreshAll();await wait();
    failPreflight=true;await assert.rejects(checkInvoice());await wait();assert.equal(db.financialDataReady,false);
    failPreflight=false;await db.refreshAll();await wait();
    neverPreflight=true;await assert.rejects(checkInvoice(),/Délai dépassé/);await wait();assert.equal(db.financialDataReady,false);
    neverPreflight=false;await db.refreshAll();await wait();
    let notifyCheck; const preflightStarted=new Promise(resolve=>notifyCheck=resolve);resolveCheck=notifyCheck;
    const pendingCheck=checkInvoice();await preflightStarted;await db.refreshAll();await wait();resolveCheck();resolveCheck=null;
    await assert.rejects(pendingCheck);await wait();assert.equal(db.financialDataReady,false);
    await db.refreshAll();await wait();assert.equal(db.financialDataReady,true);
    const click = element => { assert.ok(element); element.dispatchEvent(new MouseEvent('click', {bubbles:true})); };
    const findButton = label => [...document.querySelectorAll('button')].find(button => button.textContent.includes(label));
    click(findButton('Créer une facture')); await wait();
    const childSelect = [...document.querySelectorAll('select')].find(select => [...select.options].some(option => option.value === 'child-1'));
    childSelect.value='child-1'; childSelect.dispatchEvent(new Event('change',{bubbles:true}));
    const amount = document.querySelector('input[type=number]');
    Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set.call(amount,'2300'); amount.dispatchEvent(new Event('input',{bubbles:true})); await wait();
    let signal; const uiStarted = new Promise(resolve=>signal=resolve); resolveInsert=signal;
    const saveButton = [...document.querySelectorAll('button')].find(button => button.textContent.includes('common.save') || button.textContent.trim() === 'Enregistrer');
    click(saveButton); click(saveButton); await uiStarted; await wait();
    assert.match(text(),/Création de Facture/); assert.equal(saveButton.disabled,true); assert.equal(inserts,3);
    resolveInsert(); resolveInsert=null; await wait();
    assert.equal(db.paiements.length,4);
    // A committed review whose response is lost must not appear confirmed until reloaded.
    const reviewSelect = [...document.querySelectorAll('select')].find(select => [...select.options].some(option=>option.value==='payment-1'));
    reviewSelect.value='payment-1'; reviewSelect.dispatchEvent(new Event('change',{bubbles:true})); await wait();
    const typeSelect=[...document.querySelectorAll('select')].find(select=>[...select.options].some(option=>option.value==='M'));
    typeSelect.value='M'; typeSelect.dispatchEvent(new Event('change',{bubbles:true})); await wait();
    const period=document.querySelector('input[type=month]'); Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set.call(period,'2025-01'); period.dispatchEvent(new Event('input',{bubbles:true}));
    const reason=document.querySelector('textarea'); Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype,'value').set.call(reason,'Registre papier'); reason.dispatchEvent(new Event('input',{bubbles:true}));
    document.querySelectorAll('input[type=checkbox]').forEach(box=>box.click()); await wait(); lostReview=true; click(findButton('Confirmer la période')); await wait();
    assert.equal(db.financialDataReady,false); assert.equal(rows.paiements[0].data.periodeCle,'M:2025-01'); assert.equal(db.paiements[0].periodeCle,undefined);
    await db.refreshAll(); await wait(); assert.equal(db.paiements[0].periodeCle,'M:2025-01'); assert.equal(db.paiements[0].moisConcerne,'Janvier');
    const reviewAgain = [...document.querySelectorAll('select')].find(select => [...select.options].some(option=>option.value==='payment-1'));
    reviewAgain.value='payment-1';reviewAgain.dispatchEvent(new Event('change',{bubbles:true}));await wait(); failReviewHistory=true; click(findButton('Voir la trace de revue'));await wait();assert.match(text(),/Historique indisponible/); failReviewHistory=false; click(findButton('Voir la trace de revue'));await wait();assert.match(text(),/Registre papier/);
    const beforeCorrection=db.paiements.find(p=>p.id==='payment-1'); lostAction=true;
    await assert.rejects(db.invoiceReviewAction({requestId:'request-1',action:'correct_period',expected:beforeCorrection,periodKey:'M:2025-02',reason:'Registre'})); await wait();
    assert.equal(db.financialDataReady,false); assert.equal(db.paiements.find(p=>p.id==='payment-1').periodeCle,'M:2025-01'); assert.equal(rows.paiements[0].data.periodeCle,'M:2025-02');
    await db.refreshAll(); await wait(); assert.equal(db.paiements.find(p=>p.id==='payment-1').periodeCle,'M:2025-02');
    assert.equal((await db.listInvoiceReviewEvents('payment-1'))[0].reason,'Registre');
    // A server-side hold may have been set by another session since our last read.
    for (const attempt of [
      () => db.addPaiement(draft),
      () => db.updatePaiement('payment-1',{notes:'tentative'},db.paiements.find(p=>p.id==='payment-1')),
      () => db.reviewInvoicePeriod(db.paiements.find(p=>p.id==='payment-1'),'M:2025-04','preuve'),
      () => db.invoiceReviewAction({requestId:'blocked',action:'correct_period',expected:db.paiements.find(p=>p.id==='payment-1'),periodKey:'M:2025-04',reason:'preuve'}),
    ]) {
      duplicateBlocked=true; await assert.rejects(attempt(), err => err?.message === 'finance_duplicate_review_pending'); await wait();
      assert.equal(db.financialDataReady,false); assert.match(text(),/Chargement des enfants ou des factures non confirmé/);
      duplicateBlocked=false; await db.refreshAll(); await wait(); assert.equal(db.financialDataReady,true);
    }
    legacyBlock=true; click(findButton('Créer une facture')); await wait();
    const childAgain = [...document.querySelectorAll('select')].find(select => [...select.options].some(option => option.value === 'child-1'));
    childAgain.value='child-1'; childAgain.dispatchEvent(new Event('change',{bubbles:true}));
    const amountAgain=document.querySelector('input[type=number]'); Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set.call(amountAgain,'2300'); amountAgain.dispatchEvent(new Event('input',{bubbles:true})); await wait();
    click([...document.querySelectorAll('button')].find(button => button.textContent.includes('common.save') || button.textContent.trim() === 'Enregistrer')); await wait();
    assert.match(text(),/anciennes factures de cet enfant doivent être rapprochées/i); assert.match(text(),/Création de Facture/); assert.equal(db.financialDataReady,true); legacyBlock=false;
    click([...document.querySelectorAll('button')].find(button => button.textContent.includes('common.cancel') || button.textContent.trim() === 'Annuler')); await wait();
    click(document.querySelector('button[aria-label="Modifier la facture"]')); await wait();
    const stored = db.paiements.find(p=>p.id==='payment-1');
    rows.paiements[0].data.montant=9999;
    click([...document.querySelectorAll('button')].find(button => button.textContent.includes('Enregistrer les modifications'))); await wait();
    assert.equal(rows.paiements[0].data.montant,9999);
    assert.equal(db.financialDataReady,false); assert.equal(db.paiements.find(p=>p.id==='payment-1').statut,'En attente');
    render(React.createElement(Facture,{paiement:stored,enfant:{id:'child-1',prenom:'Lina',nom:'Test',parents:[]},onClose(){}})); await wait();
    assert.match(text(),/pas un justificatif de paiement/i); assert.match(text(),/Non précisé/); assert.doesNotMatch(text(),/Montant reçu/);
  } finally {
    root?.unmount(); await server.close(); dom.window.close(); delete globalThis.__rawdatiSupabaseClient__;
  }
});
