import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';
import React from 'react';

test('navigation, admissions copy, invoice translation and missing parent are clear in FR and AR', async () => {
  process.env.VITE_ARENA_DEMO='false';
  globalThis.__rawdatiSupabaseClient__={};
  const dom = new JSDOM('<!doctype html><div id="root"></div>', {url:'http://localhost:3000',pretendToBeVisual:true});
  for (const key of ['window','document','navigator','localStorage','sessionStorage','HTMLElement','Element','Node','Event','MouseEvent','MutationObserver','getComputedStyle','requestAnimationFrame','cancelAnimationFrame']) if (key in dom.window) Object.defineProperty(globalThis,key,{configurable:true,value:['getComputedStyle','requestAnimationFrame','cancelAnimationFrame'].includes(key)?dom.window[key].bind(dom.window):dom.window[key]});
  window.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}});window.scrollTo=()=>{};
  window.open=()=>null;
  const server=await createServer({server:{middlewareMode:true},appType:'custom'}); let root;
  try {
    const {createRoot}=await import('react-dom/client');
    await server.ssrLoadModule('/src/i18n.ts');
    const {LanguageProvider,useLanguage}=await server.ssrLoadModule('/src/contexts/LanguageContext.tsx');
    const {ToastProvider}=await server.ssrLoadModule('/src/contexts/ToastContext.tsx');
    const {ConfirmProvider}=await server.ssrLoadModule('/src/contexts/ConfirmDialogContext.tsx');
    const {DemoProviders}=await server.ssrLoadModule('/src/demo/DemoProviders.tsx');
    const {DbContext,useDb}=await server.ssrLoadModule('/src/contexts/DbContext.tsx');
    const {default:Sidebar}=await server.ssrLoadModule('/src/components/Sidebar.tsx');
    const {default:Admissions}=await server.ssrLoadModule('/src/components/Admissions.tsx');
    const {default:Communication}=await server.ssrLoadModule('/src/components/Communication.tsx');
    const {default:Facture}=await server.ssrLoadModule('/src/components/Facture.tsx');
    let setLanguage,nav;
    function Harness(){
      const db=useDb();setLanguage=useLanguage().setLanguage;
      const child=db.enfants.find(c=>c.id==='demo-child-2');
      const payment={id:'test-invoice',enfantId:child.id,montant:1000,statut:'En attente',typeFacture:'Mensuel',moisConcerne:'2025-03',periodeCle:'M:2025-03'};
      return React.createElement(DbContext.Provider,{value:{...db,inscriptionLinks:[{id:'link',active:true,token:'example-token'}],paiements:[payment]}},
        React.createElement(React.Fragment,null,
          React.createElement('div',{id:'sidebar'},React.createElement(Sidebar,{currentPage:'dashboard',onPageChange:page=>{nav=page},onClose(){}})),
          React.createElement('div',{id:'admissions'},React.createElement(Admissions)),
          React.createElement('div',{id:'communication'},React.createElement(Communication)),
          React.createElement('div',{id:'invoice'},React.createElement(Facture,{enfant:child,paiement:payment,onClose(){}}))));
    }
    root=createRoot(document.getElementById('root'));
    root.render(React.createElement(LanguageProvider,null,React.createElement(ToastProvider,null,React.createElement(ConfirmProvider,null,React.createElement(DemoProviders,null,React.createElement(Harness))))));
    const wait=()=>new Promise(r=>setTimeout(r,260));const click=e=>{assert.ok(e);e.dispatchEvent(new MouseEvent('click',{bubbles:true}));};
    const button=(selector,text)=>[...document.querySelectorAll(`${selector} button`)].find(b=>b.textContent.includes(text));
    await wait();
    click(document.querySelector('#sidebar-tab-admissions'));assert.equal(nav,'admissions');
    assert.match(document.querySelector('#communication').textContent,/Parent non renseigné/);
    assert.match(document.querySelector('#communication').textContent,/Numéro à vérifier/);
    assert.equal(document.querySelector('#communication button'),null);
    assert.ok(button('#admissions','Copier'), document.querySelector('#admissions').textContent);
    click(button('#admissions','Copier'));await wait();
    assert.match(document.querySelector('#admissions [role=alert]').textContent,/Copie impossible/);
    assert.equal(button('#admissions','Copié'),undefined);
    let copied='';Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>{copied=value}}});
    click(button('#admissions','Copier'));await wait();assert.match(copied,/example-token/);assert.ok(button('#admissions','Copié'));
    click(button('#invoice','Imprimer / PDF'));await wait();assert.match(document.querySelector('#invoice [role=alert]').textContent,/fenêtres contextuelles/);
    setLanguage('ar');await wait();
    assert.equal(document.documentElement.dir,'rtl');
    assert.match(document.querySelector('#sidebar-tab-admissions').getAttribute('aria-label'),/طلبات التسجيل/);
    assert.match(document.querySelector('#communication').textContent,/ولي غير مسجل/);
    assert.match(document.querySelector('#invoice').textContent,/مبلغ الفاتورة/);
    assert.doesNotMatch(document.querySelector('#invoice').textContent,/المبلغ المقبوض/);
    assert.match(document.querySelector('#invoice').textContent,/اختيار التصميم/);
  } finally {root?.unmount();await server.close();dom.window.close();delete globalThis.__rawdatiSupabaseClient__;}
});
