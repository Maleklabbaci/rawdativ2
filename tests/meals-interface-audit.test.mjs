import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';
import React from 'react';

test('meal form explains validation and uncertain save, and offers seven days in Arabic',async()=>{
 process.env.VITE_ARENA_DEMO='false';globalThis.__rawdatiSupabaseClient__={};
 const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'http://localhost:3000',pretendToBeVisual:true});
 for(const key of ['window','document','navigator','localStorage','sessionStorage','HTMLElement','Element','Node','Event','MouseEvent','MutationObserver','getComputedStyle','requestAnimationFrame','cancelAnimationFrame'])if(key in dom.window)Object.defineProperty(globalThis,key,{configurable:true,value:['getComputedStyle','requestAnimationFrame','cancelAnimationFrame'].includes(key)?dom.window[key].bind(dom.window):dom.window[key]});
 window.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}});window.scrollTo=()=>{};Object.defineProperty(window,'innerWidth',{value:375,configurable:true});
 const server=await createServer({server:{middlewareMode:true},appType:'custom'});let root;
 try{
  const {createRoot}=await import('react-dom/client');await server.ssrLoadModule('/src/i18n.ts');const {LanguageProvider,useLanguage}=await server.ssrLoadModule('/src/contexts/LanguageContext.tsx');const {ToastProvider}=await server.ssrLoadModule('/src/contexts/ToastContext.tsx');const {ConfirmProvider}=await server.ssrLoadModule('/src/contexts/ConfirmDialogContext.tsx');const {DemoProviders}=await server.ssrLoadModule('/src/demo/DemoProviders.tsx');const {DbContext,useDb}=await server.ssrLoadModule('/src/contexts/DbContext.tsx');const {default:Repas}=await server.ssrLoadModule('/src/components/Repas.tsx');let setLanguage,calls=0;
  function Harness(){const db=useDb();setLanguage=useLanguage().setLanguage;return React.createElement(DbContext.Provider,{value:{...db,addRepas:async()=>{calls++;throw Error('lost response')}}},React.createElement(Repas));}
  root=createRoot(document.getElementById('root'));root.render(React.createElement(LanguageProvider,null,React.createElement(ToastProvider,null,React.createElement(ConfirmProvider,null,React.createElement(DemoProviders,null,React.createElement(Harness))))));
  const wait=()=>new Promise(r=>setTimeout(r,130));const button=txt=>[...document.querySelectorAll('button')].find(b=>b.textContent.includes(txt));const click=b=>{assert.ok(b);b.dispatchEvent(new MouseEvent('click',{bubbles:true}));};await wait();
  click(button('Ajouter un repas'));await wait();click(button('Enregistrer'));await wait();assert.match(document.querySelector('[role=alert]').textContent,/jour et le menu sont obligatoires/i);assert.equal(calls,0);
  const menu=document.querySelector('textarea[placeholder^="Ex: Purée"]');Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype,'value').set.call(menu,'Menu exemple');menu.dispatchEvent(new Event('input',{bubbles:true}));await wait();click(button('Enregistrer'));await wait();assert.equal(calls,1);assert.match(document.querySelector('[role=alert]').textContent,/Enregistrement non confirmé/);assert.equal(button('Enregistrer').disabled,true);
  setLanguage('ar');await wait();const days=[...document.querySelectorAll('select')].find(s=>[...s.options].some(o=>o.value==='Samedi'));assert.equal(days.options.length,7);assert.match(days.textContent,/كل جمعة/);assert.match(days.textContent,/كل سبت/);assert.match(document.body.textContent,/الغداء/);
 }finally{root?.unmount();await server.close();dom.window.close();delete globalThis.__rawdatiSupabaseClient__;}
});
