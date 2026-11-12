// The production asset filename is deliberately restricted to known generated bundles.
const assetPattern = /^(index|vendor-react|vendor-supabase|vendor-i18n|vendor-motion|vendor-icons|vendor-pdf|vendor-pdf-viewer|vendor-qr|vendor-charts|AdminCenter|ApplicationLogs|Community|Enfants|Presences|Paiements|Classes|Repas|Activites|Personnel|Achats|Admissions|AbonnementPaiement|Communication|CommunicationAdmin|Comptes|Dashboard|Parametres|Notifications|SignIn|Demarrage|Support|Rapports)-[A-Za-z0-9_-]{6,24}\.m?js$/;
export function safeCodeLocation(filename: string, line: number, origin: string): { source: string | null; line: number | null } {
  try {
    const url = new URL(filename, origin);
    const name = url.pathname.split('/').pop() || '';
    if (url.origin === origin && url.pathname === `/assets/${name}` && assetPattern.test(name)) {
      return { source:name, line:Number.isInteger(line) && line > 0 && line <= 1000000 ? line : null };
    }
  } catch { /* keep no source */ }
  return {source:null,line:null};
}
