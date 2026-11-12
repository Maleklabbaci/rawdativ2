/** Experimental local extraction; not an identity or authenticity check. */
export type ReadName = { first: string; last: string };
export function normalizeName(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f\u064b-\u065f\u0670\u0640]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').toUpperCase().replace(/[^A-Z\u0621-\u063a\u0641-\u064a]/g, '');
}
function consonants(value: string): string {
  const mapping: Record<string, string> = { ا:'a',ب:'b',ت:'t',ث:'th',ج:'j',ح:'h',خ:'kh',د:'d',ذ:'d',ر:'r',ز:'z',س:'s',ش:'ch',ص:'s',ض:'d',ط:'t',ظ:'d',ع:'a',غ:'gh',ف:'f',ق:'k',ك:'k',ل:'l',م:'m',ن:'n',ه:'h',و:'w',ي:'y',ة:'a',ء:'' };
  return [...normalizeName(value).toLowerCase()].map(c => mapping[c] ?? c).join('').replace(/ou/g, 'w').replace(/ch/g, 'sh').replace(/ph/g, 'f').replace(/qu/g, 'k').replace(/q/g, 'k').replace(/[aeiouywh]/g, '').replace(/(.)\1+/g, '$1');
}
export function compareNames(read: ReadName, account: ReadName): 'exact' | 'possible' | 'different' | 'unreadable' {
  const rf=normalizeName(read.first), rl=normalizeName(read.last), af=normalizeName(account.first), al=normalizeName(account.last);
  if (!rf || !rl || !af || !al) return 'unreadable';
  if (rf===af && rl===al) return 'exact';
  const crossScript = /[\u0600-\u06ff]/.test(rf+rl) !== /[\u0600-\u06ff]/.test(af+al);
  const rfSound=consonants(read.first), rlSound=consonants(read.last);
  if (crossScript && rfSound.length>=2 && rlSound.length>=2 && rfSound===consonants(account.first) && rlSound===consonants(account.last)) return 'possible';
  return 'different';
}
export function extractNames(text: string, language: 'ara'|'fra'): ReadName {
  const lines=text.split(/\r?\n/).map(line=>line.replace(/[\u200e\u200f\u202a-\u202e]/g,'').trim()).filter(Boolean);
  if (language==='ara') {
    const get=(label:string) => {const line=lines.find(item=>item.includes(label)); if(!line) return ''; const [before,after='']=line.split(label);return (after.replace(/^[\s:؛.،-]+/,'').trim() || before.trim()).replace(/[^\u0621-\u063a\u0641-\u064a\s]/g,' ').replace(/\s+/g,' ').trim()};
    return {last:get('اللقب'),first:get('الاسم')};
  }
  const get=(regex:RegExp) => {const line=lines.find(item=>regex.test(item)); return line?line.replace(regex,'').replace(/^\s*[:;\-–]\s*/,'').replace(/[^A-Za-zÀ-ÿ -]/g,'').trim():''};
  return {last:get(/^NOM\b/i),first:get(/^PR[ÉE]NOM\b/i)};
}
