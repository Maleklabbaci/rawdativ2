/**
 * Signal sonore discret et professionnel pour les notifications en direct (Web Audio API).
 * - 100 % local (aucun fichier MP3 externe à télécharger, fonctionne hors-ligne).
 * - Respecte la politique autoplay des navigateurs (déverrouillage passif au 1er geste).
 * - Désactivable à tout moment par l’utilisateur (préférence conservée dans localStorage).
 */

const SOUND_STORAGE_KEY = 'rawdha_notification_sound';
const CHIME_COOLDOWN_MS = 1200;

let sharedAudioContext: AudioContext | null = null;
let lastChimeTimestamp = 0;
let unlockAttached = false;

export function isNotificationSoundEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(SOUND_STORAGE_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setNotificationSoundEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SOUND_STORAGE_KEY, enabled ? 'on' : 'off');
    window.dispatchEvent(
      new CustomEvent('rawdha:notification-sound-pref', { detail: { enabled } }),
    );
  } catch {
    // Ignore storage quota / privacy mode errors
  }
}

function resolveAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
    try {
      sharedAudioContext = new AudioCtx();
    } catch {
      return null;
    }
  }
  return sharedAudioContext;
}

export function initNotificationAudioUnlock(): void {
  if (typeof window === 'undefined' || unlockAttached) return;
  unlockAttached = true;

  const unlock = () => {
    const ctx = resolveAudioContext();
    if (ctx && ctx.state === 'suspended') {
      void ctx.resume().catch(() => {});
    }
  };

  window.addEventListener('pointerdown', unlock, { passive: true, once: true });
  window.addEventListener('keydown', unlock, { passive: true, once: true });
}

export interface PlayChimeOptions {
  /** Joue le son même si le délai anti-rafale n’est pas écoulé (ex. bouton « Tester »). */
  force?: boolean;
  /** Variante légèrement plus vive pour une alerte prioritaire. */
  urgent?: boolean;
}

/**
 * Joue un double carillon harmonique doux (~0,36 s).
 * Retourne `true` si la sonnerie a été déclenchée, `false` si coupée ou en cooldown.
 */
export function playNotificationChime(options: PlayChimeOptions = {}): boolean {
  if (!options.force && !isNotificationSoundEnabled()) {
    return false;
  }

  const nowMs = Date.now();
  if (!options.force && nowMs - lastChimeTimestamp < CHIME_COOLDOWN_MS) {
    return false;
  }
  lastChimeTimestamp = nowMs;

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('rawdha:notification-chime', {
        detail: { timestamp: nowMs, urgent: Boolean(options.urgent) },
      }),
    );
  }

  const ctx = resolveAudioContext();
  if (!ctx) return true;

  const scheduleNotes = () => {
    try {
      const t0 = ctx.currentTime + 0.01;
      const notes = options.urgent
        ? [
            { freq: 587.33, start: 0, duration: 0.14, peak: 0.11 }, // D5
            { freq: 783.99, start: 0.09, duration: 0.15, peak: 0.12 }, // G5
            { freq: 1046.5, start: 0.19, duration: 0.24, peak: 0.13 }, // C6
          ]
        : [
            { freq: 587.33, start: 0, duration: 0.16, peak: 0.1 }, // D5
            { freq: 880.0, start: 0.11, duration: 0.24, peak: 0.12 }, // A5
          ];

      for (const note of notes) {
        const osc = ctx.createOscillator();
        const overtone = ctx.createOscillator();
        const gain = ctx.createGain();
        const overtoneGain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(note.freq, t0 + note.start);

        overtone.type = 'triangle';
        overtone.frequency.setValueAtTime(note.freq * 2, t0 + note.start);

        gain.gain.setValueAtTime(0.0001, t0 + note.start);
        gain.gain.exponentialRampToValueAtTime(note.peak, t0 + note.start + 0.018);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + note.start + note.duration);

        overtoneGain.gain.setValueAtTime(0.0001, t0 + note.start);
        overtoneGain.gain.exponentialRampToValueAtTime(note.peak * 0.22, t0 + note.start + 0.015);
        overtoneGain.gain.exponentialRampToValueAtTime(
          0.0001,
          t0 + note.start + note.duration * 0.75,
        );

        osc.connect(gain);
        overtone.connect(overtoneGain);
        gain.connect(ctx.destination);
        overtoneGain.connect(ctx.destination);

        osc.start(t0 + note.start);
        overtone.start(t0 + note.start);
        osc.stop(t0 + note.start + note.duration + 0.02);
        overtone.stop(t0 + note.start + note.duration + 0.02);
      }
    } catch {
      // Ignore Web Audio errors in headless / restricted environments
    }
  };

  if (ctx.state === 'suspended') {
    void ctx
      .resume()
      .then(scheduleNotes)
      .catch(() => {});
  } else {
    scheduleNotes();
  }

  return true;
}
