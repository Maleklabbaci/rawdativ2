// Warn on browser reload/close without persisting children's or families' data.
type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
function isControl(target: EventTarget | null): target is Control {
  return target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement;
}
function valueOf(control: Control): string {
  if (control instanceof HTMLInputElement && (control.type === 'checkbox' || control.type === 'radio')) return String(control.checked);
  if (control instanceof HTMLInputElement && control.type === 'file') return Array.from(control.files || []).map(file => `${file.name}:${file.size}`).join('|');
  return control.value;
}
function defaultValueOf(control: Control): string {
  if (control instanceof HTMLInputElement && (control.type === 'checkbox' || control.type === 'radio')) return String(control.defaultChecked);
  if (control instanceof HTMLInputElement && control.type === 'file') return '';
  if (control instanceof HTMLSelectElement) return Array.from(control.options).find(option => option.defaultSelected)?.value || control.options[0]?.value || '';
  return control.defaultValue;
}
export function installUnsavedFormGuard(doc: Document, win: Window): () => void {
  const baseline = new WeakMap<Control, string>();
  const changed = new Set<Control>();
  const eligible = (control: Control) => Boolean(control.form && !control.disabled && !control.form.matches('[role="search"], [data-unsaved-ignore]') && !(control instanceof HTMLInputElement && ['password', 'hidden', 'search'].includes(control.type)));
  const capture = (event: Event) => { const control = event.target; if (isControl(control) && eligible(control) && !baseline.has(control)) baseline.set(control, valueOf(control)); };
  const mark = (event: Event) => {
    const control = event.target;
    if (!isControl(control) || !eligible(control)) return;
    if (!baseline.has(control)) baseline.set(control, defaultValueOf(control));
    if (valueOf(control) !== baseline.get(control)) changed.add(control); else changed.delete(control);
  };
  const reset = (event: Event) => {
    if (!(event.target instanceof HTMLFormElement)) return;
    for (const control of changed) if (control.form === event.target) { changed.delete(control); baseline.delete(control); }
  };
  const beforeUnload = (event: BeforeUnloadEvent) => {
    for (const control of changed) {
      if (!control.isConnected || !eligible(control) || valueOf(control) === baseline.get(control)) { changed.delete(control); continue; }
      event.preventDefault();
      event.returnValue = '';
      return;
    }
  };
  doc.addEventListener('focusin', capture, true);
  doc.addEventListener('input', mark, true);
  doc.addEventListener('change', mark, true);
  doc.addEventListener('reset', reset, true);
  win.addEventListener('beforeunload', beforeUnload);
  return () => { doc.removeEventListener('focusin', capture, true); doc.removeEventListener('input', mark, true); doc.removeEventListener('change', mark, true); doc.removeEventListener('reset', reset, true); win.removeEventListener('beforeunload', beforeUnload); };
}
