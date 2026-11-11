import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';
import React from 'react';

test('onboarding does not overwrite an existing configuration, and help does not claim invoices are receipts', async () => {
 const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'http://localhost:3000',pretendToBeVisual:true});
 for(const key of ['window','document','navigator','localStorage','sessionStorage','HTMLElement','Element','Node','Event','MouseEvent','MutationObserver','getComputedStyle','requestAnimationFrame','cancelAnimationFrame'])if(key in dom.window)Object.defineProperty(globalThis,key,{configurable:true,value:['getComputedStyle','requestAnimationFrame','cancelAnimationFrame'].includes(key)?dom.window[key].bind(dom.window):dom.window[key]});
 window.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}});
 let inserts=0,upserts=0,updates=0,done=0,stored={logoUrl:'existing-logo',tuitionFeeRate:'9000'};
 globalThis.__rawdatiSupabaseClient__={from:()=>({insert:async()=>{inserts++;return {error:{message:'duplicate'}}},upsert:async()=>{upserts++;stored={logoUrl:''};return {error:null}}})};
 const server=await createServer({server:{middlewareMode:true},appType:'custom'});let root;
 try {
  const {createRoot}=await import('react-dom/client');await server.ssrLoadModule('/src/i18n.ts');const {LanguageProvider,useLanguage}=await server.ssrLoadModule('/src/contexts/LanguageContext.tsx');const {AuthContext}=await server.ssrLoadModule('/src/contexts/AuthContext.tsx');const {DbContext}=await server.ssrLoadModule('/src/contexts/DbContext.tsx');const {default:Demarrage}=await server.ssrLoadModule('/src/components/Demarrage.tsx');const {default:Aide}=await server.ssrLoadModule('/src/components/Aide.tsx');let setLanguage;
  function Harness(){setLanguage=useLanguage().setLanguage;return React.createElement(AuthContext.Provider,{value:{user:{id:'d',nom:'Nom',prenom:'Prénom',nomCreche:'Crèche'},refreshCreche:async()=>{}}},React.createElement(DbContext.Provider,{value:{updateCompte:async()=>{updates++}}},React.createElement(React.Fragment,null,React.createElement(Demarrage,{onDone:()=>done++}),React.createElement(Aide))));}
  root=createRoot(document.getElementById('root'));root.render(React.createElement(LanguageProvider,null,React.createElement(Harness)));const wait=()=>new Promise(r=>setTimeout(r,150));const click=e=>{assert.ok(e);e.dispatchEvent(new MouseEvent('click',{bubbles:true}));};const set=(e,v)=>{Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set.call(e,v);e.dispatchEvent(new Event('input',{bubbles:true}));};const button=txt=>[...document.querySelectorAll('button')].find(b=>b.textContent.includes(txt));await wait();
  assert.match(document.body.textContent,/n’est pas un reçu d’encaissement/);const inputs=[...document.querySelectorAll('input')];assert.equal(inputs[3].value,'');click(button('Enregistrer la configuration'));await wait();assert.equal(inserts,0);assert.match(document.body.textContent,/champs obligatoires/);
  set(inputs[3],'5000');set(inputs[4],'0555000000');set(inputs[5],'Blida');await wait();let save=button('Enregistrer la configuration');click(save);click(save);await wait();assert.equal(inserts,1);assert.equal(upserts,0);assert.deepEqual(stored,{logoUrl:'existing-logo',tuitionFeeRate:'9000'});assert.equal(updates,0);assert.equal(done,0);assert.equal(save.disabled,true);assert.match(document.body.textContent,/configuration déjà existante/);
  setLanguage('ar');await wait();assert.match(document.body.textContent,/ليس وصلاً لإثبات الدفع/);
 }finally{root?.unmount();await server.close();dom.window.close();delete globalThis.__rawdatiSupabaseClient__;}
});
