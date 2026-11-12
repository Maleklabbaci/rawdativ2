import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';
import React from 'react';

test('failed background refresh blocks interaction without losing a draft', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost', pretendToBeVisual: true });
  for (const k of ['window','document','navigator','HTMLElement','Element','Node','Event','MutationObserver']) Object.defineProperty(globalThis,k,{configurable:true,value:dom.window[k]});
  const server = await createServer({ server:{ middlewareMode:true, hmr:false }, appType:'custom' });
  let root;
  try {
    const {createRoot} = await import('react-dom/client');
    const {default:Guard} = await server.ssrLoadModule('/src/components/DataLoadGuard.tsx');
    const render = (loading,failed) => root.render(React.createElement(Guard,{loading,failed,fallback:React.createElement('p',{role:'alert'},'Retry')},React.createElement('input',{defaultValue:'', 'aria-label':'Draft'})));
    const wait=()=>new Promise(r=>setTimeout(r,40));
    root=createRoot(document.getElementById('root'));
    render(true,false); await wait(); assert.equal(document.querySelector('input'),null);
    render(false,false); await wait(); const input=document.querySelector('input'); input.value='Important draft';
    render(false,true); await wait(); assert.ok(input.closest('[hidden]')); assert.equal(input.value,'Important draft'); assert.ok(document.querySelector('[role=alert]'));
    render(false,false); await wait(); assert.equal(document.querySelector('input'),input); assert.equal(input.value,'Important draft'); assert.equal(input.closest('[hidden]'),null);
  } finally { root?.unmount(); await server.close(); dom.window.close(); }
});
