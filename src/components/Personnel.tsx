import { useState } from 'react';
import { 
  Plus, 
  Trash2, 
  X, 
  UserCheck, 
  Search, 
  Phone, 
  Mail, 
  Calendar, 
  Award, 
  Bookmark, 
  Activity, 
  MapPin,
  Heart,
  HelpCircle,
  Clock,
  GraduationCap,
  ShieldCheck,
  ShieldAlert,
  CalendarDays,
  Printer,
  MoonStar
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useConfirmDialog } from '../contexts/ConfirmDialogContext';
import { useDb } from '../contexts/DbContext';
import { useAuth } from '../contexts/AuthContext';
import { GardePeriode, Personnel as PersonnelType } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface RichPersonnel extends PersonnelType {
  telephone?: string;
  email?: string;
  dateEmbauche?: string;
  classeAssignee?: string;
  groupeSanguin?: string;
}

export default function Personnel() {
  const { t, language } = useLanguage();
  const isArabic = language === 'ar';
  const { confirm } = useConfirmDialog();

  const { personnel: allDbPersonnel, classes: allDbClasses, enfants: allDbEnfants, addPersonnel, updatePersonnel, deletePersonnel } = useDb();
  const { user, creche } = useAuth();
  const isDirecteur = user?.role === 'directeur';
  const dbPersonnel = isDirecteur ? allDbPersonnel.filter((p: any) => p.crecheId === user!.id) : allDbPersonnel;
  const classes = (isDirecteur ? allDbClasses.filter((c: any) => c.crecheId === user!.id) : allDbClasses) as any[];
  const classNames = classes.map(classe => String(classe.nom || '').trim()).filter(Boolean);
  const normaliseEmail = (email?: string) => (email || '').replace(/@rawdati(?:\.com|\.dz)$/i, '@rawdha.dz');

  const personnel: RichPersonnel[] = dbPersonnel.map((p) => ({
    ...p,
    // Ne pas inventer de téléphone, date d'embauche ou groupe sanguin pour remplir l'écran.
    telephone: p.telephone || '',
    email: normaliseEmail(p.email),
    dateEmbauche: p.dateEmbauche || '',
    classeAssignee: p.classeAssignee || 'Toutes les classes',
    groupeSanguin: p.groupeSanguin || '',
  }));

  const [showModal, setShowModal] = useState(false);
  const [selectedPersonnel, setSelectedPersonnel] = useState<any | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    nom: '',
    prenom: '',
    poste: 'Éducatrice Principale',
    statut: 'Actif' as 'Actif' | 'Inactif',
    telephone: '0555 90 23 45',
    email: '',
    dateEmbauche: new Date().toISOString().split('T')[0],
    classeAssignee: 'Toutes les classes',
    groupeSanguin: 'O+',
    assuranceActive: false, // ✅ assurance de l'employé(e)
    numeroAssurance: '', // ✅ numéro de police / référence CNAS
    // --- Dossier RH exigé lors des contrôles ---
    diplomesTexte: '', // diplômes séparés par des virgules (converti en liste à l'enregistrement)
    referencesDiplomes: '', // numéro / organisme délivreur
    certificatMedicalAptitude: false,
    casierJudiciaire: false,
    // Compte dans le ratio légal d'encadrement (éducatrices, aides, direction).
    roleEncadrement: true,
  });

  const handleAjouter = () => {
    if (!formData.nom || !formData.prenom || !formData.poste) return;
    
    // Auto populate email if blank
    const calculatedEmail = formData.email || `${formData.prenom.toLowerCase()}.${formData.nom.toLowerCase()}@rawdha.dz`;

    const { diplomesTexte, ...rest } = formData;
    addPersonnel({
      ...rest,
      // Le formulaire saisit les diplômes en texte libre séparé par des virgules ;
      // on stocke une vraie liste pour pouvoir les compter et les filtrer.
      diplomes: diplomesTexte
        .split(',')
        .map(diplome => diplome.trim())
        .filter(Boolean),
      email: calculatedEmail,
      crecheId: isDirecteur ? user!.id : undefined
    } as any);
    setShowModal(false);
    // Reset form
    setFormData({
      nom: '',
      prenom: '',
      poste: 'Éducatrice Principale',
      statut: 'Actif',
      telephone: '0555 90 23 45',
      email: '',
      dateEmbauche: new Date().toISOString().split('T')[0],
      classeAssignee: 'Toutes les classes',
      groupeSanguin: 'O+',
      assuranceActive: false,
      numeroAssurance: '',
      diplomesTexte: '',
      referencesDiplomes: '',
      certificatMedicalAptitude: false,
      casierJudiciaire: false,
      roleEncadrement: true,
    });
  };

  const filteredPersonnel = personnel.filter(p => {
    const term = searchTerm.toLowerCase();
    return (
      p.nom.toLowerCase().includes(term) ||
      p.prenom.toLowerCase().includes(term) ||
      p.poste.toLowerCase().includes(term)
    );
  });

  const activeCount = personnel.filter(p => p.statut === 'Actif').length;
  const inactiveCount = personnel.filter(p => p.statut !== 'Actif').length;

  // --- Ratio légal d'encadrement ------------------------------------------
  // Le décret impose un nombre minimum d'adultes présents par enfant. Les fiches
  // créées avant cette version ne portent pas encore `roleEncadrement` : on les
  // compte par défaut pour ne pas afficher un ratio artificiellement dégradé.
  const encadrantsActifs = personnel.filter(
    p => p.statut === 'Actif' && (p as { roleEncadrement?: boolean }).roleEncadrement !== false,
  ).length;
  const enfantsActifs = allDbEnfants.filter(e => e.statut === 'Actif').length;
  const enfantsParEncadrant = encadrantsActifs > 0
    ? Math.round((enfantsActifs / encadrantsActifs) * 10) / 10
    : null;
  // Seuil d'alerte indicatif : au-delà, la crèche doit vérifier son agrément.
  const SEUIL_RATIO = 8;
  const ratioDepasse = enfantsParEncadrant !== null && enfantsParEncadrant > SEUIL_RATIO;

  // --- Registre des gardes et permanences ---------------------------------
  // Les gardes de week-end et de jours fériés doivent être consignées dans un
  // registre nominatif. Chaque membre du personnel porte ses propres gardes ;
  // on agrège ici pour l'affichage mensuel et l'impression.
  const JOURS_FERIES_FIXES: Record<string, string> = {
    '01-01': 'Nouvel An',
    '01-12': 'Yennayer',
    '05-01': 'Fête du Travail',
    '07-05': "Fête de l'Indépendance",
    '11-01': 'Anniversaire de la Révolution',
  };
  const JOURS_LONGS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

  const [gardeMonth, setGardeMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [gardeDate, setGardeDate] = useState<string | null>(null);
  const [gardeForm, setGardeForm] = useState<{ personnelId: string; type: GardePeriode['type']; horaire: string; note: string }>({
    personnelId: '',
    type: 'Week-end',
    horaire: '08:00 - 17:00',
    note: '',
  });

  const gardesDuMois = personnel
    .flatMap(membre => (membre.gardes || []).map(garde => ({
      ...garde,
      personnelId: garde.personnelId || membre.id,
      nomComplet: `${membre.prenom} ${membre.nom}`.trim(),
      poste: membre.poste,
    })))
    .filter(garde => (garde.date || '').startsWith(gardeMonth))
    .sort((a, b) => a.date.localeCompare(b.date));

  /** Tous les jours du mois qui appellent une garde : week-ends, fériés fixes et jours déjà renseignés. */
  const joursDeGardeDuMois = (() => {
    const [annee, mois] = gardeMonth.split('-').map(Number);
    const dernierJour = new Date(annee, mois, 0).getDate();
    const jours: { date: string; jour: string; libelle: string; type: GardePeriode['type'] }[] = [];
    for (let jour = 1; jour <= dernierJour; jour += 1) {
      const date = new Date(annee, mois - 1, jour, 12);
      const iso = `${annee}-${String(mois).padStart(2, '0')}-${String(jour).padStart(2, '0')}`;
      const ferie = JOURS_FERIES_FIXES[iso.slice(5)];
      const weekend = date.getDay() === 5 || date.getDay() === 6; // vendredi et samedi
      const dejaRenseigne = gardesDuMois.some(garde => garde.date === iso);
      if (!weekend && !ferie && !dejaRenseigne) continue;
      const type: GardePeriode['type'] = ferie && !weekend ? 'Jour férié' : weekend ? 'Week-end' : 'Permanence';
      const libelle = ferie
        ? `${ferie}${weekend ? ' (week-end)' : ''}`
        : date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long' });
      jours.push({ date: iso, jour: JOURS_LONGS[date.getDay()], libelle, type });
    }
    return jours;
  })();

  const libelleMois = new Date(`${gardeMonth}-01T12:00:00`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  const changerMoisGarde = (offset: number) => {
    const [annee, mois] = gardeMonth.split('-').map(Number);
    const cible = new Date(annee, mois - 1 + offset, 1);
    setGardeMonth(`${cible.getFullYear()}-${String(cible.getMonth() + 1).padStart(2, '0')}`);
    setGardeDate(null);
  };

  const ajouterGarde = async (date: string) => {
    const membre = personnel.find(p => p.id === gardeForm.personnelId);
    if (!membre) return;
    const garde: GardePeriode = {
      id: `garde_${Date.now()}`,
      date,
      type: gardeForm.type,
      personnelId: membre.id,
      horaire: gardeForm.horaire.trim() || undefined,
      note: gardeForm.note.trim() || undefined,
    };
    setGardeDate(null);
    setGardeForm({ personnelId: '', type: 'Week-end', horaire: '08:00 - 17:00', note: '' });
    await updatePersonnel(membre.id, { gardes: [...(membre.gardes || []), garde] });
  };

  const retirerGarde = async (garde: { id: string; personnelId?: string }) => {
    const membre = personnel.find(p => p.id === garde.personnelId);
    if (!membre) return;
    await updatePersonnel(membre.id, { gardes: (membre.gardes || []).filter(item => item.id !== garde.id) });
  };

  /** Registre mensuel des gardes, imprimable pour le contrôle. */
  const imprimerRegistreGardes = () => {
    const lignes = gardesDuMois.map(garde => {
      const jour = new Date(`${garde.date}T12:00:00`);
      return `<tr>
        <td class="num">${jour.toLocaleDateString('fr-FR')}</td>
        <td>${JOURS_LONGS[jour.getDay()]}</td>
        <td>${garde.type}</td>
        <td><strong>${garde.nomComplet}</strong></td>
        <td>${garde.poste || '—'}</td>
        <td class="center">${garde.horaire || '—'}</td>
        <td class="small">${garde.note || ''}</td>
        <td class="sign"></td>
      </tr>`;
    }).join('');

    const agentsConcernes = new Set(gardesDuMois.map(garde => garde.personnelId)).size;

    const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8" />
<title>Registre des gardes — ${libelleMois}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; margin: 26px; color: #0f172a; }
  header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #4338ca; padding-bottom: 13px; margin-bottom: 18px; }
  h1 { font-size: 19px; margin: 0 0 4px; }
  .meta { font-size: 11px; color: #64748b; line-height: 1.6; }
  .badge { background: #eef2ff; color: #4338ca; font-size: 10px; font-weight: 800; padding: 4px 9px; border-radius: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
  table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
  th { background: #f1f5f9; text-align: left; padding: 8px 6px; border: 1px solid #cbd5e1; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.4px; color: #475569; }
  td { padding: 7px 6px; border: 1px solid #e2e8f0; vertical-align: middle; }
  tr:nth-child(even) td { background: #fafbfc; }
  td.num { font-weight: 800; color: #4338ca; white-space: nowrap; }
  td.center { text-align: center; }
  td.small { font-size: 9.5px; color: #475569; }
  td.sign { width: 92px; }
  footer { margin-top: 20px; padding-top: 11px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; display: flex; justify-content: space-between; }
  .visa { margin-top: 26px; display: flex; justify-content: flex-end; gap: 60px; font-size: 10px; color: #475569; }
  .visa div { border-top: 1px solid #94a3b8; padding-top: 5px; width: 190px; text-align: center; }
  @media print { body { margin: 8mm; } }
</style></head>
<body>
  <header>
    <div>
      <h1>Registre des gardes et permanences</h1>
      <div class="meta">
        <strong>${creche?.nom || 'Rawdha+'}</strong>${creche?.adresse ? ` — ${creche.adresse}` : ''}<br />
        Période : ${libelleMois} — ${gardesDuMois.length} garde(s) consignée(s), ${agentsConcernes} agent(s)
      </div>
    </div>
    <span class="badge">Registre légal</span>
  </header>
  <table>
    <thead><tr>
      <th>Date</th><th>Jour</th><th>Type</th><th>Agent</th><th>Poste</th><th>Horaire</th><th>Observations</th><th>Émargement</th>
    </tr></thead>
    <tbody>${lignes || '<tr><td colspan="8" style="text-align:center;color:#94a3b8">Aucune garde enregistrée pour cette période.</td></tr>'}</tbody>
  </table>
  <div class="visa">
    <div>Visa de la direction</div>
    <div>Visa de l'inspection (DAS)</div>
  </div>
  <footer>
    <span>Document généré par Rawdha+ — registre des week-ends, jours fériés et permanences.</span>
    <span>Imprimé le ${new Date().toLocaleDateString('fr-FR')}</span>
  </footer>
</body></html>`;

    const printWindow = window.open('', '_blank', 'height=900,width=1000');
    if (!printWindow) return;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => {
      setTimeout(() => { printWindow.focus(); printWindow.print(); }, 250);
    };
  };

  // Pièces RH manquantes, pour le suivi de conformité.
  const dossiersRhIncomplets = personnel.filter(p => {
    const fiche = p as { diplomes?: string[]; certificatMedicalAptitude?: boolean; casierJudiciaire?: boolean };
    return (fiche.diplomes || []).length === 0
      || !fiche.certificatMedicalAptitude
      || !fiche.casierJudiciaire;
  }).length;

  return (
    <div className="space-y-8 font-sans">
      {/* Analytics Summary blocks */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-4 hover:shadow-md transition">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest">
              {isArabic ? 'إجمالي الطاقم' : 'Équipe Educative'}
            </p>
            <p className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5">{personnel.length} {isArabic ? 'موظفين' : 'membres'}</p>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-4 hover:shadow-md transition">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Activity className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest">
              {isArabic ? 'النشطون اليوم' : 'Présents & Actifs'}
            </p>
            <p className="text-xl sm:text-2xl font-black text-emerald-600 mt-0.5">{activeCount} {isArabic ? 'نشط' : 'en poste'}</p>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-4 hover:shadow-md transition">
          <div className="w-12 h-12 rounded-xl bg-pink-50 text-pink-600 flex items-center justify-center shrink-0">
            <Heart className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest">
              {isArabic ? 'نسبة التأطير' : "Taux d'Encadrement"}
            </p>
            <p className={`text-xl sm:text-2xl font-black mt-0.5 ${
              ratioDepasse ? 'text-rose-600' : enfantsParEncadrant === null ? 'text-slate-400' : 'text-emerald-600'
            }`}>
              {enfantsParEncadrant === null
                ? (isArabic ? '— غير محسوب' : '— non calculable')
                : `${enfantsParEncadrant} ${isArabic ? 'طفل/مؤطر' : 'enfants/encadrant'}`}
            </p>
          </div>
        </div>
      </div>

      {/* Ratio légal d'encadrement et complétude des dossiers RH */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className={`rounded-2xl border p-4 sm:p-5 flex items-start gap-3 ${
          ratioDepasse ? 'border-rose-200 bg-rose-50/50' : 'border-slate-200 bg-white'
        }`}>
          {ratioDepasse
            ? <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            : <UserCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />}
          <div>
            <p className="text-xs font-black text-slate-800">
              {isArabic ? 'نسبة التأطير القانونية' : "Ratio d'encadrement"}
            </p>
            <p className="mt-1 text-[11px] font-semibold leading-5 text-slate-500">
              {enfantsActifs} {isArabic ? 'طفل نشط' : 'enfants actifs'} / {encadrantsActifs} {isArabic ? 'مؤطر' : 'encadrants'}
              {ratioDepasse && (isArabic
                ? ` — تجاوزت الحد الإرشادي (${SEUIL_RATIO}). تحققوا من شروط اعتمادكم.`
                : ` — au-delà du seuil indicatif de ${SEUIL_RATIO}. Vérifiez les conditions de votre agrément.`)}
            </p>
          </div>
        </div>

        <div className={`rounded-2xl border p-4 sm:p-5 flex items-start gap-3 ${
          dossiersRhIncomplets > 0 ? 'border-amber-200 bg-amber-50/50' : 'border-slate-200 bg-white'
        }`}>
          {dossiersRhIncomplets > 0
            ? <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            : <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />}
          <div>
            <p className="text-xs font-black text-slate-800">
              {isArabic ? 'ملفات الموظفين الإدارية' : 'Dossiers RH'}
            </p>
            <p className="mt-1 text-[11px] font-semibold leading-5 text-slate-500">
              {dossiersRhIncomplets > 0
                ? (isArabic
                    ? `${dossiersRhIncomplets} ملف ينقصه شهادة أو صحيفة سوابق.`
                    : `${dossiersRhIncomplets} fiche(s) sans diplôme, certificat d'aptitude ou casier judiciaire.`)
                : (isArabic
                    ? 'جميع الملفات مكتملة.'
                    : 'Tous les dossiers sont complets.')}
            </p>
          </div>
        </div>
      </div>

      {/* Header and Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <UserCheck className="w-6 h-6 sm:w-8 sm:h-8 text-indigo-600" />
            {t('staff')}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5 leading-tight">
            {isArabic 
              ? 'إدارة الفريق التربوي، المربيات، الممرضات، ومعلومات الاتصال والمناصب الخاصة بهم' 
              : 'Gerez les profils de vos éducatrices, puéricultrices, pédiatres et équipe de restauration.'}
          </p>
        </div>
        <button 
          className="flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-4 py-2.5 sm:px-6 sm:py-3.5 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/20 transition-all cursor-pointer w-full sm:w-auto" 
          onClick={() => setShowModal(true)}
        >
          <Plus size={16} className="stroke-[3]" />
          <span>{t('staff.add')}</span>
        </button>
      </div>

      {/* Search Input bar */}
      <div className="bg-white p-3 sm:p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder={isArabic ? 'ابحث عن مربية أو منصب...' : 'Rechercher un membre ou un poste...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition-all text-xs sm:text-sm font-medium text-slate-800"
          />
        </div>
      </div>

      {/* Personnel Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 animate-slide-up">
        {filteredPersonnel.length > 0 ? (
          filteredPersonnel.map((p) => {
            const initials = `${p.prenom[0]}${p.nom[0]}`;
            
            return (
              <div 
                key={p.id} 
                className={`bg-white rounded-2xl border border-slate-100 p-6 shadow-xs hover:shadow-lg hover:-translate-y-1 transition-all duration-200 flex flex-col justify-between cursor-pointer`}
                onClick={() => setSelectedPersonnel(p)}
              >
                <div>
                  {/* Card top details with avatar */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-500 to-violet-600 text-white font-extrabold text-base flex items-center justify-center shadow-md">
                        {initials}
                      </div>
                      <div>
                        <h3 className="text-base font-extrabold text-slate-900 leading-snug">{p.prenom} {p.nom}</h3>
                        <span className="inline-flex items-center gap-1.5 mt-1 text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider">
                          <Award className="w-3 h-3" />
                          {p.poste}
                        </span>
                      </div>
                    </div>

                    {/* Active/Inactive Badge with green pulse */}
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest leading-none ${
                      p.statut === 'Actif' 
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                        : 'bg-rose-50 text-rose-700 border border-rose-100'
                    }`}>
                      {p.statut === 'Actif' && <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />}
                      {p.statut}
                    </span>
                  </div>

                  {/* Core Information stats */}
                  <div className="mt-4 space-y-2 text-xs font-semibold text-slate-500">
                    <div className="flex items-center gap-2 p-1.5 hover:bg-slate-50 rounded-lg transition duration-150">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <a href={`tel:${p.telephone}`} className="text-slate-700 hover:text-indigo-600 font-bold">{p.telephone}</a>
                    </div>
                    <div className="flex items-center gap-2 p-1.5 hover:bg-slate-50 rounded-lg transition duration-150 truncate">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-slate-700 truncate">{p.email}</span>
                    </div>
                    <div className="flex items-center gap-2 p-1.5 hover:bg-slate-50 rounded-lg transition duration-150">
                      <Bookmark className="w-3.5 h-3.5 text-indigo-400" />
                      <span>{isArabic ? 'القسم المسؤول:' : 'Section'}: <strong className="text-slate-800">{p.classeAssignee}</strong></span>
                    </div>
                  </div>
                </div>

                {/* Footer specs / Embauche & Groupe Sanguin */}
                <div className="mt-5 pt-4 border-t border-slate-50 flex items-center justify-between text-[11px] font-bold text-slate-400">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>Inscrit: {p.dateEmbauche}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {p.assuranceActive && (
                      <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded font-black border border-emerald-100/30" title={p.numeroAssurance || ''}>
                        {isArabic ? 'مؤمَّن' : 'Assuré(e)'}
                      </span>
                    )}
                    {/* Indicateurs du dossier RH : lecture immédiate en cas de contrôle. */}
                    {((p as { diplomes?: string[] }).diplomes || []).length > 0 && (
                      <span
                        className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded font-black border border-indigo-100/30"
                        title={((p as { diplomes?: string[] }).diplomes || []).join(', ')}
                      >
                        {((p as { diplomes?: string[] }).diplomes || []).length} {isArabic ? 'شهادة' : 'dipl.'}
                      </span>
                    )}
                    {(p as { certificatMedicalAptitude?: boolean }).certificatMedicalAptitude ? (
                      <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded font-black border border-emerald-100/30" title={isArabic ? 'شهادة طبية للأهلية' : "Certificat médical d'aptitude"}>
                        {isArabic ? 'أهلية ✓' : 'Aptitude ✓'}
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded font-black border border-amber-100/30" title={isArabic ? 'شهادة الأهلية الطبية غير محفوظة' : "Certificat médical d'aptitude manquant"}>
                        {isArabic ? 'أهلية ✗' : 'Aptitude ✗'}
                      </span>
                    )}
                    {(p as { casierJudiciaire?: boolean }).casierJudiciaire ? (
                      <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded font-black border border-emerald-100/30" title={isArabic ? 'صحيفة السوابق محفوظة' : 'Casier judiciaire déposé'}>
                        {isArabic ? 'سوابق ✓' : 'Casier ✓'}
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded font-black border border-amber-100/30" title={isArabic ? 'صحيفة السوابق غير محفوظة' : 'Casier judiciaire manquant'}>
                        {isArabic ? 'سوابق ✗' : 'Casier ✗'}
                      </span>
                    )}
                    <span className="px-1.5 py-0.5 bg-rose-50 text-rose-600 rounded font-black border border-rose-100/30">
                      Group: {p.groupeSanguin}
                    </span>
                    <button 
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer z-10"
                      onClick={async (e) => {
                        e.stopPropagation();
                        const confirmed = await confirm({
                          title: isArabic ? 'تأكيد حذف الموظف' : 'Confirmer la suppression du personnel',
                          message: isArabic
                            ? 'سيتم حذف هذا الموظف نهائياً.'
                            : 'Ce membre du personnel sera supprimé définitivement.',
                          confirmLabel: isArabic ? 'حذف الموظف' : 'Supprimer le membre',
                          variant: 'danger',
                        });
                        if (confirmed) await deletePersonnel(p.id);
                      }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full p-12 bg-white rounded-2xl border border-slate-100 text-center text-slate-400">
            <HelpCircle className="w-10 h-10 mx-auto text-slate-300 stroke-[1.5] mb-2" />
            <p className="font-extrabold">{isArabic ? 'لا توجد نتائج مطابقة' : 'Aucun membre d\'équipe trouvé'}</p>
            <p className="text-xs text-slate-400 mt-0.5">{isArabic ? 'يرجى مراجعة معيار البحث الخاص بك.' : 'Faites une autre recherche ou ajoutez un nouveau membre.'}</p>
          </div>
        )}
      </div>

      {/* Adding Rich Staff Modal ("PLEINE DE FORMATION") */}
      <AnimatePresence>
        {showModal && (
          <div 
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-lg flex items-start sm:items-center justify-center z-[999] p-2 sm:p-4 overflow-y-auto cursor-pointer"
            onClick={() => setShowModal(false)}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-lg max-h-[calc(100dvh-1rem)] sm:max-h-[85vh] mt-2 sm:mt-16 flex flex-col overflow-hidden font-sans cursor-default"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 sm:p-6 bg-gradient-to-r from-indigo-600 to-violet-600 text-white flex justify-between items-center flex-shrink-0">
                <div>
                  <h3 className="text-xl font-black">{isArabic ? 'إضافة عضو جديد وتعيينه' : 'Nouveau Dossier Personnel'}</h3>
                  <p className="text-xs text-indigo-100 mt-0.5">{isArabic ? 'تعبئة معلومات الحساب، بطاقة الاتصال، المسؤولية والبيانات الصحية للموظف' : 'Fiche d\'embauche, coordonnées, poste et groupe sanguin'}</p>
                </div>
                <button 
                  onClick={() => setShowModal(false)}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
                
                {/* Last Name & First Name (Row 1) */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      {isArabic ? 'اللقب *' : 'Nom de famille *'}
                    </label>
                    <input 
                      type="text" 
                      placeholder="Ex: Benali"
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition text-sm font-semibold text-slate-800" 
                      value={formData.nom} 
                      onChange={e => setFormData({...formData, nom: e.target.value})} 
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      {isArabic ? 'الاسم الشخصي *' : 'Prénom *'}
                    </label>
                    <input 
                      type="text" 
                      placeholder="Ex: Nassima"
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition text-sm font-semibold text-slate-800" 
                      value={formData.prenom} 
                      onChange={e => setFormData({...formData, prenom: e.target.value})} 
                    />
                  </div>
                </div>

                {/* Job Title & Contact (Row 2) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      {isArabic ? 'الوظيفة / التخصص *' : 'Poste occupé *'}
                    </label>
                    <select
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition text-sm font-semibold text-slate-800"
                      value={formData.poste}
                      onChange={e => setFormData({...formData, poste: e.target.value})}
                    >
                      <option value="Éducatrice Principale">Éducatrice Principale</option>
                      <option value="Puéricultrice">Puéricultrice</option>
                      <option value="Pédiatre Référent">Pédiatre Référent</option>
                      <option value="Psychologue Infantile">Psychologue Infantile</option>
                      <option value="Cuisinière Chef">Cuisinière Chef</option>
                      <option value="Agent de sécurité">Agent de sécurité / Admin</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      {isArabic ? 'رقم الهاتف المباشر *' : 'Téléphone Direct *'}
                    </label>
                    <input 
                      type="tel" 
                      placeholder="Ex: 0555 12 34 56"
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition text-sm font-bold text-slate-800" 
                      value={formData.telephone} 
                      onChange={e => setFormData({...formData, telephone: e.target.value})} 
                    />
                  </div>
                </div>

                {/* Email Address */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    {isArabic ? 'البريد الإلكتروني' : 'Adresse Email Professionnelle (Optionnel)'}
                  </label>
                  <input 
                    type="email" 
                    placeholder="Ex: nassima.b@rawdha.dz"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition text-sm font-semibold text-slate-800" 
                    value={formData.email} 
                    onChange={e => setFormData({...formData, email: e.target.value})} 
                  />
                </div>

                {/* Section assigned & blood type */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      {isArabic ? 'القسم / الصف المسند إليها *' : 'Classe / Section affectée *'}
                    </label>
                    <select
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition text-sm font-semibold text-slate-800"
                      value={formData.classeAssignee}
                      onChange={e => setFormData({...formData, classeAssignee: e.target.value})}
                    >
                      {classNames.map(className => (
                        <option key={className} value={className}>{className}</option>
                      ))}
                      <option value="Toutes les classes">{isArabic ? 'كل الأقسام / متعدد' : 'Toutes les classes / Polyvalente'}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      {isArabic ? 'الفصيلة الدموية *' : 'Groupe Sanguin *'}
                    </label>
                    <select
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition text-sm font-bold text-slate-800"
                      value={formData.groupeSanguin}
                      onChange={e => setFormData({...formData, groupeSanguin: e.target.value})}
                    >
                      <option value="O+">O+</option>
                      <option value="A+">A+</option>
                      <option value="B+">B+</option>
                      <option value="AB+">AB+</option>
                      <option value="O-">O-</option>
                      <option value="A-">A-</option>
                    </select>
                  </div>
                </div>

                {/* Hire Date & Status */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      {isArabic ? 'تاريخ التعيين' : 'Date de prise de service'}
                    </label>
                    <input 
                      type="date"
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-bold text-slate-800"
                      value={formData.dateEmbauche}
                      onChange={e => setFormData({...formData, dateEmbauche: e.target.value})}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      {isArabic ? 'الوضعية اليوم *' : 'Statut de Disponibilité *'}
                    </label>
                    <select 
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition text-sm font-semibold text-slate-800" 
                      value={formData.statut} 
                      onChange={e => setFormData({...formData, statut: e.target.value as any})}
                    >
                      <option value="Actif">Actif (En poste)</option>
                      <option value="Inactif">Inactif / Congé</option>
                    </select>
                  </div>
                </div>

                {/* ✅ Assurance de l'employé(e) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-center gap-2.5 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <input
                      type="checkbox"
                      id="assuranceActive"
                      checked={formData.assuranceActive}
                      onChange={e => setFormData({...formData, assuranceActive: e.target.checked})}
                      className="w-4 h-4 accent-indigo-600 cursor-pointer"
                    />
                    <label htmlFor="assuranceActive" className="text-sm font-semibold text-slate-700 cursor-pointer select-none">
                      {isArabic ? 'مؤمَّن(ة) اجتماعياً' : 'Assuré(e) socialement'}
                    </label>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      {isArabic ? 'رقم التأمين (CNAS)' : 'N° Assurance (CNAS)'}
                    </label>
                    <input
                      type="text"
                      disabled={!formData.assuranceActive}
                      placeholder={isArabic ? 'مثال: 123456789012' : 'Ex: 123456789012'}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-semibold text-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                      value={formData.numeroAssurance}
                      onChange={e => setFormData({...formData, numeroAssurance: e.target.value})}
                    />
                  </div>
                </div>

                {/* Dossier RH : pièces exigées lors des contrôles. */}
                <div className="pt-4 mt-2 border-t border-slate-100 space-y-4">
                  <h4 className="text-xs font-black text-indigo-600 uppercase tracking-widest flex items-center gap-1.5">
                    <GraduationCap className="w-4 h-4" />
                    {isArabic ? 'الملف الإداري للموظف' : 'Dossier RH — diplômes et pièces'}
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                        {isArabic ? 'الشهادات والمؤهلات' : 'Diplômes et qualifications'}
                      </label>
                      <input
                        type="text"
                        placeholder={isArabic ? 'مثال: مربية معتمدة، شهادة إسعاف' : 'Ex. Éducatrice agréée, PSC1'}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-semibold text-slate-800"
                        value={formData.diplomesTexte}
                        onChange={e => setFormData({...formData, diplomesTexte: e.target.value})}
                      />
                      <p className="mt-1.5 text-[10px] text-slate-400">
                        {isArabic ? 'افصل بينها بفاصلة.' : 'Séparez plusieurs diplômes par une virgule.'}
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                        {isArabic ? 'مرجع الشهادات' : 'Références des diplômes'}
                      </label>
                      <input
                        type="text"
                        placeholder={isArabic ? 'الرقم / الجهة المانحة' : 'N° et organisme délivreur'}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-semibold text-slate-800"
                        value={formData.referencesDiplomes}
                        onChange={e => setFormData({...formData, referencesDiplomes: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3 cursor-pointer">
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 accent-indigo-600"
                        checked={formData.certificatMedicalAptitude}
                        onChange={e => setFormData({...formData, certificatMedicalAptitude: e.target.checked})}
                      />
                      <span className="text-[11px] font-semibold leading-5 text-slate-600">
                        {isArabic
                          ? 'شهادة طبية للأهلية المهنية محفوظة'
                          : "Certificat médical d'aptitude professionnelle déposé"}
                      </span>
                    </label>

                    <label className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3 cursor-pointer">
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 accent-indigo-600"
                        checked={formData.casierJudiciaire}
                        onChange={e => setFormData({...formData, casierJudiciaire: e.target.checked})}
                      />
                      <span className="text-[11px] font-semibold leading-5 text-slate-600">
                        {isArabic
                          ? 'صحيفة السوابق العدلية (البطاقة رقم 3) محفوظة'
                          : "Extrait de casier judiciaire (bulletin n°3) déposé"}
                      </span>
                    </label>
                  </div>

                  <label className="flex items-start gap-2.5 rounded-xl border border-indigo-100 bg-indigo-50/50 p-3 cursor-pointer">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 accent-indigo-600"
                      checked={formData.roleEncadrement}
                      onChange={e => setFormData({...formData, roleEncadrement: e.target.checked})}
                    />
                    <span className="text-[11px] font-semibold leading-5 text-slate-600">
                      {isArabic
                        ? 'يُحسب هذا الموظف في نسبة التأطير (مربية، مساعدة، إدارة).'
                        : "Ce membre compte dans le ratio d'encadrement (éducatrice, aide, direction)."}
                    </span>
                  </label>
                </div>

              </div>

              {/* Buttons */}
              <div className="p-6 pt-4 border-t border-slate-100 flex gap-3 flex-shrink-0 bg-slate-50/50">
                <button 
                  type="button"
                  className="flex-1 p-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer text-sm"
                  onClick={() => setShowModal(false)}
                >
                  {t('common.cancel')}
                </button>
                <button 
                  type="button"
                  className="flex-1 p-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-750 text-white font-bold rounded-xl transition cursor-pointer text-sm shadow-md"
                  onClick={handleAjouter}
                >
                  {t('common.save')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Personnel Profile Detail Modal */}
      <AnimatePresence>
        {selectedPersonnel && (
          <div 
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-lg flex items-start sm:items-center justify-center z-[999] p-2 sm:p-4 overflow-y-auto cursor-pointer"
            onClick={() => setSelectedPersonnel(null)}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-md max-h-[85vh] mt-16 flex flex-col overflow-hidden font-sans cursor-default"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Colorful gradient headers */}
              <div className="p-6 bg-gradient-to-r from-violet-600 to-indigo-600 text-white flex justify-between items-center flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 text-white font-black text-lg flex items-center justify-center shadow-inner">
                    {selectedPersonnel.prenom[0]}{selectedPersonnel.nom[0]}
                  </div>
                  <div>
                    <h3 className="text-xl font-black">{selectedPersonnel.prenom} {selectedPersonnel.nom}</h3>
                    <p className="text-xs text-indigo-100 mt-0.5">{selectedPersonnel.poste}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedPersonnel(null)}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
                {/* Contact Coordinates */}
                <div>
                  <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider block mb-2">{isArabic ? 'معلومات الاتصال المباشرة' : 'Coordonnées de l\'employé'}</span>
                  <div className="space-y-2 text-sm font-semibold">
                    <div className="flex items-center gap-2.5 p-3 bg-slate-50 border border-slate-100 rounded-xl">
                      <Phone className="w-4 h-4 text-slate-450" />
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">{isArabic ? 'الهاتف المحمول' : 'Téléphone direct'}</span>
                        <a href={`tel:${selectedPersonnel.telephone}`} className="text-indigo-600 font-extrabold">{selectedPersonnel.telephone}</a>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5 p-3 bg-slate-50 border border-slate-100 rounded-xl">
                      <Mail className="w-4 h-4 text-slate-450" />
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">{isArabic ? 'البريد الإلكتروني' : 'Messagerie'}</span>
                        <span className="text-slate-800 font-bold">{selectedPersonnel.email}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Assignment & Health specs */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                    <span className="text-[9px] font-bold text-slate-400 uppercase block tracking-wider mb-1">{isArabic ? 'القسم المسؤول' : 'Classe Affectée'}</span>
                    <span className="font-extrabold text-slate-800 text-xs">{selectedPersonnel.classeAssignee}</span>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                    <span className="text-[9px] font-bold text-slate-400 uppercase block tracking-wider mb-1">{isArabic ? 'الفصيلة الدموية' : 'Groupe Sanguin'}</span>
                    <span className="px-2 py-0.5 bg-rose-50 text-rose-600 rounded font-black border border-rose-100/30 text-xs inline-block">
                      Group {selectedPersonnel.groupeSanguin}
                    </span>
                  </div>
                </div>

                {/* Hire details */}
                <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl flex justify-between items-center text-xs">
                  <div>
                    <span className="text-[9px] font-bold text-slate-405 uppercase tracking-wider block mb-0.5">{isArabic ? 'تاريخ التوظيف' : 'Date d\'embauche'}</span>
                    <span className="font-extrabold text-slate-805">{selectedPersonnel.dateEmbauche}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-slate-405 uppercase tracking-wider block text-right mb-1">{isArabic ? 'حالة الحساب' : 'Disponibilité'}</span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest leading-none ${
                      selectedPersonnel.statut === 'Actif' 
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                        : 'bg-rose-50 text-rose-700 border border-rose-100'
                    }`}>
                      {selectedPersonnel.statut}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}

      {/* Registre des gardes et permanences : week-ends et jours fériés */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
              <MoonStar className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-black text-slate-800">
                {isArabic ? 'سجل الحراسة والمداومة' : 'Registre des gardes & permanences'}
              </p>
              <p className="mt-0.5 text-[11px] font-semibold text-slate-400">
                {gardesDuMois.length} {isArabic ? 'مداومة مسجلة في' : 'garde(s) enregistrée(s) en'} {libelleMois}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
              <button
                type="button"
                onClick={() => changerMoisGarde(-1)}
                className="grid h-6 w-6 place-items-center rounded-lg text-sm font-black text-slate-500 hover:bg-white hover:text-indigo-600"
                aria-label={isArabic ? 'الشهر السابق' : 'Mois précédent'}
              >
                ‹
              </button>
              <span className="px-1.5 text-[11px] font-black capitalize text-slate-700">{libelleMois}</span>
              <button
                type="button"
                onClick={() => changerMoisGarde(1)}
                className="grid h-6 w-6 place-items-center rounded-lg text-sm font-black text-slate-500 hover:bg-white hover:text-indigo-600"
                aria-label={isArabic ? 'الشهر التالي' : 'Mois suivant'}
              >
                ›
              </button>
            </div>
            <button
              type="button"
              onClick={imprimerRegistreGardes}
              className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-[11px] font-black text-indigo-700 transition hover:bg-indigo-100"
            >
              <Printer className="h-3.5 w-3.5" />
              {isArabic ? 'طباعة السجل' : 'Imprimer le registre'}
            </button>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {joursDeGardeDuMois.length === 0 ? (
            <p className="p-5 text-center text-xs font-semibold text-slate-400">
              {isArabic ? 'لا توجد أيام مداومة في هذه الفترة.' : 'Aucun jour de garde sur cette période.'}
            </p>
          ) : joursDeGardeDuMois.map(jour => {
            const affectations = gardesDuMois.filter(garde => garde.date === jour.date);
            const formulaireOuvert = gardeDate === jour.date;
            const badgeType = jour.type === 'Jour férié'
              ? 'bg-rose-50 text-rose-700 border-rose-100'
              : jour.type === 'Week-end'
                ? 'bg-amber-50 text-amber-700 border-amber-100'
                : 'bg-slate-50 text-slate-600 border-slate-200';
            return (
              <div key={jour.date} className="p-3 sm:px-5 sm:py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <CalendarDays className="h-4 w-4 shrink-0 text-slate-300" />
                  <span className="text-xs font-black capitalize text-slate-700">
                    {jour.jour} {new Date(`${jour.date}T12:00:00`).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                  </span>
                  <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${badgeType}`}>
                    {jour.libelle || jour.type}
                  </span>

                  {affectations.map(garde => (
                    <span
                      key={garde.id}
                      className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 py-1 pl-2.5 pr-1.5 text-[10px] font-black text-indigo-700"
                    >
                      {garde.nomComplet}
                      {garde.horaire ? <span className="font-bold text-indigo-400">{garde.horaire}</span> : null}
                      <button
                        type="button"
                        onClick={() => void retirerGarde(garde)}
                        className="grid h-4 w-4 place-items-center rounded-full text-indigo-400 hover:bg-indigo-100 hover:text-rose-600"
                        title={isArabic ? 'حذف' : 'Retirer cette garde'}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}

                  {!formulaireOuvert && (
                    <button
                      type="button"
                      onClick={() => {
                        setGardeDate(jour.date);
                        setGardeForm({
                          personnelId: personnel.find(p => p.statut === 'Actif')?.id || '',
                          type: jour.type,
                          horaire: '08:00 - 17:00',
                          note: '',
                        });
                      }}
                      className="inline-flex items-center gap-1 rounded-full border border-dashed border-slate-300 px-2.5 py-1 text-[10px] font-black text-slate-500 hover:border-indigo-300 hover:text-indigo-600"
                    >
                      <Plus className="h-3 w-3" />
                      {isArabic ? 'تعيين' : 'Affecter'}
                    </button>
                  )}
                </div>

                {formulaireOuvert && (
                  <div className="mt-3 grid grid-cols-1 gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3 sm:grid-cols-2 lg:grid-cols-5">
                    <select
                      value={gardeForm.personnelId}
                      onChange={e => setGardeForm({ ...gardeForm, personnelId: e.target.value })}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-400"
                    >
                      <option value="">{isArabic ? 'اختر الموظف' : "Choisir l'agent"}</option>
                      {personnel.filter(p => p.statut === 'Actif').map(membre => (
                        <option key={membre.id} value={membre.id}>
                          {membre.prenom} {membre.nom} — {membre.poste}
                        </option>
                      ))}
                    </select>
                    <select
                      value={gardeForm.type}
                      onChange={e => setGardeForm({ ...gardeForm, type: e.target.value as GardePeriode['type'] })}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-400"
                    >
                      <option value="Week-end">{isArabic ? 'عطلة نهاية الأسبوع' : 'Week-end'}</option>
                      <option value="Jour férié">{isArabic ? 'يوم عطلة' : 'Jour férié'}</option>
                      <option value="Permanence">{isArabic ? 'مداومة' : 'Permanence'}</option>
                    </select>
                    <input
                      value={gardeForm.horaire}
                      onChange={e => setGardeForm({ ...gardeForm, horaire: e.target.value })}
                      placeholder="08:00 - 17:00"
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-400"
                    />
                    <input
                      value={gardeForm.note}
                      onChange={e => setGardeForm({ ...gardeForm, note: e.target.value })}
                      placeholder={isArabic ? 'ملاحظة' : 'Observation'}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-400"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={!gardeForm.personnelId}
                        onClick={() => void ajouterGarde(jour.date)}
                        className="flex-1 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-black text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        {isArabic ? 'حفظ' : 'Enregistrer'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setGardeDate(null)}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-500 hover:bg-slate-50"
                      >
                        {isArabic ? 'إلغاء' : 'Annuler'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      </AnimatePresence>
    </div>
  );
}
