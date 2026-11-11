import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';
import React from 'react';

test('quick admission asks for confirmation and reports failure without claiming success', async()=>{
 process.env.VITE_ARENA_DEMO='false';globalThis.__rawdatiSupabaseClient__={};
 const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'http://localhost:3000',pretendToBeVisual:true});
 for(const key of ['window','document','navigator','localStorage','sessionStorage','HTMLElement','Element','Node','Event','MouseEvent','MutationObserver','getComputedStyle','requestAnimationFrame','cancelAnimationFrame']) if(key in dom.window)Object.defineProperty(globalThis,key,{configurable:true,value:['getComputedStyle','requestAnimationFrame','cancelAnimationFrame'].includes(key)?dom.window[key].bind(dom.window):dom.window[key]});
 window.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}});window.scrollTo=()=>{};
 const server=await createServer({server:{middlewareMode:true},appType:'custom'});let root;
 try{
  const {createRoot}=await import('react-dom/client');await server.ssrLoadModule('/src/i18n.ts');
  const {LanguageProvider}=await server.ssrLoadModule('/src/contexts/LanguageContext.tsx');const {ToastProvider}=await server.ssrLoadModule('/src/contexts/ToastContext.tsx');const {ConfirmProvider}=await server.ssrLoadModule('/src/contexts/ConfirmDialogContext.tsx');
  const {ToastContainer}=await server.ssrLoadModule('/src/components/ToastContainer.tsx');const {DemoProviders}=await server.ssrLoadModule('/src/demo/DemoProviders.tsx');const {DbContext,useDb}=await server.ssrLoadModule('/src/contexts/DbContext.tsx');const {default:Enfants}=await server.ssrLoadModule('/src/components/Enfants.tsx');let calls=0;
  function Harness(){const db=useDb();return React.createElement(DbContext.Provider,{value:{...db,decideAdmission:async()=>{calls++;throw Error('network')}}},React.createElement(React.Fragment,null,React.createElement(Enfants),React.createElement(ToastContainer)));}
  root=createRoot(document.getElementById('root'));root.render(React.createElement(LanguageProvider,null,React.createElement(ToastProvider,null,React.createElement(ConfirmProvider,null,React.createElement(DemoProviders,null,React.createElement(Harness))))));
  const wait=()=>new Promise(r=>setTimeout(r,150));const button=(text,scope=document)=>[...scope.querySelectorAll('button')].find(b=>b.textContent.includes(text));const click=b=>{assert.ok(b);b.dispatchEvent(new MouseEvent('click',{bubbles:true}))};
  await wait();click(button('Afficher mon QR'));await wait();click(button('Accepter et ajouter'));await wait();assert.equal(calls,0);
  let dialog=document.querySelector('[role=dialog]');assert.ok(dialog);click(button('Annuler',dialog));await wait();assert.equal(calls,0);
  click(button('Accepter et ajouter'));await wait();dialog=document.querySelector('[role=dialog]');click(button('Confirmer',dialog));await wait();assert.equal(calls,1);assert.match(document.body.textContent,/Impossible de traiter la demande/);assert.match(document.body.textContent,/Sami Exemple/);
 }finally{root?.unmount();await server.close();dom.window.close();delete globalThis.__rawdatiSupabaseClient__;}
});
