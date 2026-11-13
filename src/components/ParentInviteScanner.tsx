import { useEffect, useRef, useState } from 'react';
import { parseParentInviteLink } from '../utils/parentInviteLink';

/** Decode on-device only. A QR does not grant access: the director must approve. */
export default function ParentInviteScanner({ isAr, onClose, onFound }: { isAr: boolean; onClose: () => void; onFound: (path: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const callbacks = useRef({ onClose, onFound });
  callbacks.current = { onClose, onFound };
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    let stream: MediaStream | null = null;
    let timer: number | undefined;
    const stop = () => { active = false; if (timer !== undefined) window.clearTimeout(timer); stream?.getTracks().forEach(track => track.stop()); };
    const hide = () => { if (document.hidden) { stop(); callbacks.current.onClose(); } };
    document.addEventListener('visibilitychange', hide);
    const start = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('camera unavailable');
        const camera = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
        if (!active) { camera.getTracks().forEach(track => track.stop()); return; }
        stream = camera;
        const { default: jsQR } = await import('jsqr');
        if (!active) { stop(); return; }
        const element = video.current;
        if (!element) { stop(); return; }
        element.srcObject = camera;
        await element.play();
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) throw new Error('canvas unavailable');
        const scan = () => {
          if (!active) return;
          if (element.readyState >= 2 && element.videoWidth && element.videoHeight) {
            const ratio = Math.min(1, 720 / element.videoWidth);
            canvas.width = Math.max(1, Math.round(element.videoWidth * ratio));
            canvas.height = Math.max(1, Math.round(element.videoHeight * ratio));
            ctx.drawImage(element, 0, 0, canvas.width, canvas.height);
            const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const result = jsQR(pixels.data, pixels.width, pixels.height, { inversionAttempts: 'attemptBoth' });
            if (result) {
              const path = parseParentInviteLink(result.data, window.location.origin);
              if (path) { stop(); callbacks.current.onFound(path); return; }
              setError(isAr ? 'رمز غير صالح لهذا الموقع. استخدمي الرمز الشخصي من الروضة.' : 'Ce QR ne correspond pas à une invitation personnelle de ce site.');
            }
          }
          timer = window.setTimeout(scan, 200);
        };
        scan();
      } catch {
        if (active) setError(isAr ? 'تعذر فتح الكاميرا. اسمحي باستخدام الكاميرا أو استعملي الرابط الشخصي.' : 'Impossible d’ouvrir la caméra. Autorisez-la ou utilisez le lien personnel.');
        stream?.getTracks().forEach(track => track.stop());
      }
    };
    void start();
    return () => { document.removeEventListener('visibilitychange', hide); stop(); };
  }, [isAr]);
  return <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3"><p className="text-xs text-slate-600">{isAr ? 'وجهي الكاميرا نحو رمز الولي الشخصي الذي تعرضه المديرة.' : 'Pointez la caméra vers le QR personnel affiché par la directrice.'}</p><video ref={video} muted playsInline autoPlay aria-label={isAr ? 'معاينة الكاميرا' : 'Aperçu de la caméra'} className="mt-2 aspect-video w-full rounded-xl bg-slate-900 object-cover"/>{error && <p role="alert" className="mt-2 text-xs text-rose-700">{error}</p>}<button type="button" onClick={onClose} className="mt-3 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700">{isAr ? 'إغلاق الكاميرا' : 'Fermer la caméra'}</button></div>;
}
