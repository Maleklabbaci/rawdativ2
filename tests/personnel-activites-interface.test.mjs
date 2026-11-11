import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';
import React from 'react';

test('staff and activities do not display or submit invented missing details',async()=>{
 process.env.VITE_ARENA_DEMO='false';globalThis.__rawdatiSupabaseClient__={};
 const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'http://localhost:3000',pretendToBeVisual:true});
 for(const key of ['window','document','navigator','localStorage','sessionStorage','HTMLElement','Element','Node','Event','MouseEvent','MutationObserver','getComputedStyle','requestAnimationFrame','cancelAnimationFrame'])if(key in dom.window)Object.defineProperty(globalThis,key,{configurable:true,value:['getComputedStyle','requestAnimationFrame','cancelAnimationFrame'].includes(key)?dom.window[key].bind(dom.window):dom.window[key]});
 window.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}});window.scrollTo=()=>{};
 const server=await createServer({server:{middlewareMode:true},appType:'custom'});let root;
 try {
  const {createRoot}=await import('react-dom/client');await server.ssrLoadModule('/src/i18n.ts');
  const {LanguageProvider}=await server.ssrLoadModule('/src/contexts/LanguageContext.tsx');const {ToastProvider}=await server.ssrLoadModule('/src/contexts/ToastContext.tsx');const {ConfirmProvider}=await server.ssrLoadModule('/src/contexts/ConfirmDialogContext.tsx');const {DemoProviders}=await server.ssrLoadModule('/src/demo/DemoProviders.tsx');const {DbContext,useDb}=await server.ssrLoadModule('/src/contexts/DbContext.tsx');
  const {default:Personnel}=await server.ssrLoadModule('/src/components/Personnel.tsx');const {default:Activites}=await server.ssrLoadModule('/src/components/Activites.tsx');let staff,activity;let failStaff=false,failActivity=false;
  function Harness(){const db=useDb();return React.createElement(DbContext.Provider,{value:{...db,personnel:db.personnel.map(p=>({...p,email:'sara@rawdati.com'})),addPersonnel:async p=>{staff=p;if(failStaff)throw Error('lost response');return 'new-staff'},addActivite:async a=>{activity=a;if(failActivity)throw Error('lost response');return 'new-activity'}}},React.createElement(React.Fragment,null,React.createElement('div',{id:'staff'},React.createElement(Personnel)),React.createElement('div',{id:'activities'},React.createElement(Activites))));}
  root=createRoot(document.getElementById('root'));root.render(React.createElement(LanguageProvider,null,React.createElement(ToastProvider,null,React.createElement(ConfirmProvider,null,React.createElement(DemoProviders,null,React.createElement(Harness))))));
  const wait=()=>new Promise(r=>setTimeout(r,130));const click=b=>{assert.ok(b);b.dispatchEvent(new MouseEvent('click',{bubbles:true}));};const button=(scope,txt)=>[...document.querySelectorAll(`${scope} button`)].find(b=>b.textContent.includes(txt));
  const input=(selector,value)=>{let e=document.querySelector(selector);assert.ok(e,selector);Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set.call(e,value);e.dispatchEvent(new Event('input',{bubbles:true}));};
  await wait();assert.match(document.querySelector('#staff').textContent,/sara@rawdati\.com/);assert.doesNotMatch(document.querySelector('#activities').textContent,/Mme\. Nassima|Pâte à modeler, Peinture|10:00 - 11:15/);assert.match(document.querySelector('#activities').textContent,/Non renseigné/);
  click(button('#staff','Ajouter un membre'));await wait();
  assert.equal(document.querySelector('#staff input[type=tel]').value,'');assert.equal(document.querySelector('#staff input[type=date]').value,'');
  const blood=[...document.querySelectorAll('#staff select')].find(s=>[...s.options].some(o=>o.value==='AB-'));assert.equal(blood.value,'');
  input('#staff input[placeholder="Ex: Benali"]','Test');input('#staff input[placeholder="Ex: Nassima"]','Nadia');await wait();click(button('#staff','Enregistrer'));await wait();
  assert.equal(staff.telephone,'');assert.equal(staff.email,'');assert.equal(staff.groupeSanguin,'');assert.equal(staff.classeAssignee,'');assert.equal(staff.dateEmbauche,'');
  click(button('#activities','Ajouter une activité'));await wait();input('#activities input[placeholder^="Ex: Pâte"]','Atelier fictif');await wait();click(button('#activities','Enregistrer'));await wait();
  assert.equal(activity.educateurRef,'');assert.equal(activity.lieu,'');assert.equal(activity.heureDebut,'');assert.equal(activity.materielRequis,'');
  failActivity=true;click(button('#activities','Ajouter une activité'));await wait();input('#activities input[placeholder^="Ex: Pâte"]','Nouvelle activité');await wait();click(button('#activities','Enregistrer'));await wait();
  assert.match(document.querySelector('#activities [role=alert]').textContent,/Enregistrement non confirmé/);assert.equal(button('#activities','Enregistrer').disabled,true);
  failStaff=true;click(button('#staff','Ajouter un membre'));await wait();input('#staff input[placeholder="Ex: Benali"]','Autre');input('#staff input[placeholder="Ex: Nassima"]','Nadia');await wait();click(button('#staff','Enregistrer'));await wait();
  assert.match(document.querySelector('#staff [role=alert]').textContent,/Enregistrement non confirmé/);assert.equal(button('#staff','Enregistrer').disabled,true);
 }finally{root?.unmount();await server.close();dom.window.close();delete globalThis.__rawdatiSupabaseClient__;}
});
