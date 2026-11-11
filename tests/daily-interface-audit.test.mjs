import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';
import React from 'react';

test('class form and attendance work without invented values and guard blank dates in FR/AR', async()=>{
 process.env.VITE_ARENA_DEMO='false';globalThis.__rawdatiSupabaseClient__={};
 const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'http://localhost:3000',pretendToBeVisual:true});
 for(const key of ['window','document','navigator','localStorage','sessionStorage','HTMLElement','Element','Node','Event','MouseEvent','MutationObserver','getComputedStyle','requestAnimationFrame','cancelAnimationFrame'])if(key in dom.window)Object.defineProperty(globalThis,key,{configurable:true,value:['getComputedStyle','requestAnimationFrame','cancelAnimationFrame'].includes(key)?dom.window[key].bind(dom.window):dom.window[key]});
 window.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}});window.scrollTo=()=>{};Object.defineProperty(window,'innerWidth',{value:375,configurable:true});
 const server=await createServer({server:{middlewareMode:true},appType:'custom'});let root;
 try{
  const {createRoot}=await import('react-dom/client');await server.ssrLoadModule('/src/i18n.ts');
  const {LanguageProvider,useLanguage}=await server.ssrLoadModule('/src/contexts/LanguageContext.tsx');const {ToastProvider}=await server.ssrLoadModule('/src/contexts/ToastContext.tsx');const {ConfirmProvider}=await server.ssrLoadModule('/src/contexts/ConfirmDialogContext.tsx');const {DemoProviders}=await server.ssrLoadModule('/src/demo/DemoProviders.tsx');const {DbContext,useDb}=await server.ssrLoadModule('/src/contexts/DbContext.tsx');
  const {default:Classes}=await server.ssrLoadModule('/src/components/Classes.tsx');const {default:Presences}=await server.ssrLoadModule('/src/components/Presences.tsx');let setLanguage,resolveSave,calls=0,draft,fail=false;
  function Harness(){const db=useDb();setLanguage=useLanguage().setLanguage;return React.createElement(DbContext.Provider,{value:{...db,addClasse:async value=>{calls++;draft=value;if(fail) throw new Error('network');return new Promise(resolve=>{resolveSave=resolve})}}},React.createElement(React.Fragment,null,React.createElement('div',{id:'classes'},React.createElement(Classes)),React.createElement('div',{id:'presence'},React.createElement(Presences))));}
  root=createRoot(document.getElementById('root'));root.render(React.createElement(LanguageProvider,null,React.createElement(ToastProvider,null,React.createElement(ConfirmProvider,null,React.createElement(DemoProviders,null,React.createElement(Harness))))));
  const wait=()=>new Promise(r=>setTimeout(r,150));const click=e=>{assert.ok(e);e.dispatchEvent(new MouseEvent('click',{bubbles:true}));};const button=(scope,txt)=>[...document.querySelectorAll(`${scope} button`)].find(b=>b.textContent.trim()===txt);
  const setInput=(el,value)=>{assert.ok(el);Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));};
  await wait();const classes=document.querySelector('#classes');assert.doesNotMatch(classes.textContent,/Salle B-102|Salle C-201/);assert.match(classes.textContent,/Salle non renseignée/);assert.match(classes.textContent,/Éducateur non renseigné/);
  click([...classes.querySelectorAll('h3')].find(e=>e.textContent.includes('Les Poussins')));await wait();click(button('#classes','Modifier'));await wait();
  assert.equal(classes.querySelector('input[placeholder="Ex: Bébés"]').value,'Les Poussins');click(button('#classes','Annuler'));await wait();click(button('#classes','Ajouter Classe'));await wait();
  const name=classes.querySelector('input[placeholder="Ex: Bébés"]');const capacity=classes.querySelector('input[type=number]');assert.equal(name.value,'');assert.equal(capacity.value,'');setInput(name,'Nouvelle classe');setInput(capacity,'8');await wait();
  const save=button('#classes','Ajouter');click(save);click(save);await wait();assert.equal(calls,1);assert.equal(draft.salleNom,'');assert.equal(draft.educateurChef,'');assert.equal(draft.capacite,8);click(button('#classes','Annuler'));await wait();assert.ok(classes.querySelector('input[placeholder="Ex: Bébés"]'));resolveSave('new');await wait();
  fail=true;click(button('#classes','Ajouter Classe'));await wait();setInput(classes.querySelector('input[placeholder=\"Ex: Bébés\"]'),'Classe test');setInput(classes.querySelector('input[type=number]'),'8');await wait();click(button('#classes','Ajouter'));await wait();assert.equal(calls,2);assert.match(classes.querySelector('[role=alert]').textContent,/non confirmé/);assert.equal(button('#classes','Ajouter').disabled,true);click(button('#classes','Annuler'));await wait();
  const presence=document.querySelector('#presence');const date=presence.querySelector('input[aria-label="Date de présence"]');setInput(date,'');await wait();assert.match(presence.textContent,/Choisissez une date/);assert.equal(button('#presence','Valider la journée').disabled,true);
  setInput(date,'2026-05-04');await wait();click([...presence.querySelectorAll('button')].find(b=>b.textContent.includes('Les Poussins')));await wait();const present=button('#presence','Présent');assert.ok(present);assert.equal(present.disabled,false);click(present);await wait();
  setLanguage('ar');await wait();assert.equal(document.documentElement.dir,'rtl');assert.match(presence.textContent,/لم يأكل/);assert.match(presence.textContent,/مضطرب/);
 }finally{root?.unmount();await server.close();dom.window.close();delete globalThis.__rawdatiSupabaseClient__;}
});
