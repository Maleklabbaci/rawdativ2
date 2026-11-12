import { compareNames, extractNames, type ReadName } from './identityOcr';

export type LocalIdentityAssistance = {kind:'exact'|'possible'|'different'|'unreadable'; name:ReadName};

/** Runs on the reviewer's device only. Results are advisory and never submitted to the server. */
export async function readIdentityLocally(blob: Blob, account: ReadName, signal: AbortSignal): Promise<LocalIdentityAssistance> {
  if (!['image/jpeg','image/png'].includes(blob.type) || !blob.size || blob.size>2097152) throw new Error('invalid_image');
  if (signal.aborted) throw new DOMException('Cancelled','AbortError');
  let bitmap:ImageBitmap|undefined;let canvas:HTMLCanvasElement|undefined;
  try {
    bitmap=await createImageBitmap(blob);
    if(signal.aborted)throw new DOMException('Cancelled','AbortError');
    if(!bitmap.width || !bitmap.height || bitmap.width*bitmap.height>30_000_000)throw new Error('invalid_image');
    const scale=Math.min(2,Math.sqrt(8_000_000/(bitmap.width*bitmap.height)));
    canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
    const ctx=canvas.getContext('2d');if(!ctx)throw new Error('canvas_unavailable');ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
    const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);
    for(let i=0;i<pixels.data.length;i+=4){const grey=.299*pixels.data[i]+.587*pixels.data[i+1]+.114*pixels.data[i+2];pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=grey;}ctx.putImageData(pixels,0,0);
    const {createWorker}=await import('tesseract.js');
    // All models and worker code must come from this app's own origin.
    const base=new URL(`${import.meta.env.BASE_URL}identity-ocr/`,window.location.origin);
    if(base.origin!==window.location.origin)throw new Error('invalid_ocr_origin');
    const recognize=async(language:'fra'|'ara')=>{
      if(signal.aborted)throw new DOMException('Cancelled','AbortError');
      let onAbort:()=>void=()=>{};
      const aborted=new Promise<never>((_,reject)=>{onAbort=()=>reject(new DOMException('Cancelled','AbortError'));signal.addEventListener('abort',onAbort,{once:true})});
      const initialization=createWorker(language,1,{workerPath:new URL('worker.min.js',base).href,corePath:base.href,langPath:base.href,gzip:false,cacheMethod:'none'});
      let worker:Awaited<typeof initialization>|undefined;
      try {
        worker=await Promise.race([initialization,aborted]);
        if(signal.aborted)throw new DOMException('Cancelled','AbortError');
        const result=await Promise.race([worker.recognize(canvas!),aborted]);
        return {name:extractNames(result.data.text,language),confidence:result.data.confidence};
      } finally {
        signal.removeEventListener('abort',onAbort);
        if(worker) await worker.terminate();
        else void initialization.then(w=>w.terminate()).catch(()=>{});
      }
    };
    let read=await recognize('fra');
    if(!read.name.first||!read.name.last||read.confidence<50){const arabic=await recognize('ara');if(arabic.name.first&&arabic.name.last&&arabic.confidence>=50)read=arabic;}
    return {kind:read.confidence<50?'unreadable':compareNames(read.name,account),name:read.name};
  } finally {bitmap?.close();if(canvas){canvas.width=0;canvas.height=0;}}
}
