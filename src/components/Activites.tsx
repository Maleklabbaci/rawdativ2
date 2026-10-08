import { useState } from 'react';
import { 
  Plus, 
  Trash2, 
  X, 
  Sparkles, 
  Calendar, 
  Clock, 
  User, 
  BookOpen, 
  Search, 
  CheckSquare, 
  HelpCircle, 
  Target, 
  Wand2, 
  MapPin,
  Compass,
  Printer
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useConfirmDialog } from '../contexts/ConfirmDialogContext';
import { useDb } from '../contexts/DbContext';
import { useAuth } from '../contexts/AuthContext';
import { Activite, ActiviteDomaine } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface RichActivite extends Activite {
  competenceVisee?: string;
  heureDebut?: string;
  heureFin?: string;
  materielRequis?: string;
  lieu?: string;
  educateurRef?: string;
}

export default function Activites() {
  const { t, language } = useLanguage();
  const isArabic = language === 'ar';
  const { confirm } = useConfirmDialog();

  const { activites: allDbActivites, personnel: personnelData, addActivite, deleteActivite } = useDb();
  const { user, creche } = useAuth();
  const isDirecteur = user?.role === 'directeur';
  const dbActivites = isDirecteur ? allDbActivites.filter((a: any) => a.crecheId === user!.id) : allDbActivites;

  const activites: RichActivite[] = dbActivites.map((a: any, idx: number) => {
    const skills = ['Motricité Fine', 'Éveil Musical', 'Autonomie & Tri', 'Savoir-vivre & Coopération'];
    const places = ['Atelier Peinture', 'Salle d\'Éveil', 'Jardin de la crèche', 'Salle Polyvalente'];
    return {
      ...a,
      competenceVisee: a.competenceVisee || skills[idx % skills.length],
      heureDebut: a.heureDebut || '10:00',
      heureFin: a.heureFin || '11:15',
      materielRequis: a.materielRequis || (idx % 2 === 0 ? 'Pâte à modeler, Peinture, Tabliers' : 'Instruments en bois, CD de comptines'),
      lieu: a.lieu || places[idx % places.length],
      educateurRef: a.educateurRef || (personnelData[idx % personnelData.length] 
        ? `${personnelData[idx % personnelData.length].prenom} ${personnelData[idx % personnelData.length].nom}` 
        : 'Mme. Nassima'),
    };
  });

  const [showModal, setShowModal] = useState(false);
  const [selectedActivite, setSelectedActivite] = useState<any | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  // Planning hebdomadaire : vue « programme pédagogique » en plus de la liste.
  const [vuePlanning, setVuePlanning] = useState(false);
  const [semaineDebut, setSemaineDebut] = useState<string>(() => {
    const jour = new Date();
    jour.setDate(jour.getDate() - jour.getDay()); // dimanche de la semaine en cours
    return jour.toISOString().split('T')[0];
  });

  const [formData, setFormData] = useState({
    titre: '',
    date: new Date().toISOString().split('T')[0],
    groupe: 'Bébés' as 'Bébés' | 'Moyens' | 'Grands',
    domaine: 'Éveil sensoriel' as ActiviteDomaine,
    competenceVisee: 'Motricité Fine',
    heureDebut: '10:00',
    heureFin: '11:00',
    materielRequis: 'Feuilles, Gommettes colorées, Colle',
    lieu: 'Salle d\'Éveil',
    educateurRef: personnelData[0] ? `${personnelData[0].prenom} ${personnelData[0].nom}` : 'Mme. Nassima'
  });

  const handleAjouter = () => {
    if (!formData.titre || !formData.date) return;
    addActivite({ ...formData, crecheId: isDirecteur ? user!.id : undefined } as any);
    setShowModal(false);
    // Reset form
    setFormData({
      titre: '',
      date: new Date().toISOString().split('T')[0],
      groupe: 'Bébés',
      domaine: 'Éveil sensoriel',
      competenceVisee: 'Motricité Fine',
      heureDebut: '10:00',
      heureFin: '11:00',
      materielRequis: 'Feuilles, Gommettes colorées, Colle',
      lieu: 'Salle d\'Éveil',
      educateurRef: personnelData[0] ? `${personnelData[0].prenom} ${personnelData[0].nom}` : 'Mme. Nassima'
    });
  };

  const filteredActivites = activites.filter(a => {
    const term = searchTerm.toLowerCase();
    return (
      a.titre.toLowerCase().includes(term) ||
      a.competenceVisee?.toLowerCase().includes(term) ||
      a.groupe.toLowerCase().includes(term)
    );
  });

  // --- Planning hebdomadaire des activités d'éveil -------------------------
  // La semaine algérienne démarre le dimanche ; le planning imprimable reprend
  // ce découpage pour être affiché dans les salles et présenté aux contrôles.
  const JOURS_PLANNING = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

  const jourSemaine = (offset: number) => {
    const jour = new Date(`${semaineDebut}T12:00:00`);
    jour.setDate(jour.getDate() + offset);
    return jour.toISOString().split('T')[0];
  };

  const planningSemaine = JOURS_PLANNING.map((jour, offset) => {
    const date = jourSemaine(offset);
    return {
      jour,
      date,
      activites: activites
        .filter(a => a.date === date)
        .sort((a, b) => (a.heureDebut || '').localeCompare(b.heureDebut || '')),
    };
  });

  const activitesPlanifiees = planningSemaine.reduce((total, jour) => total + jour.activites.length, 0);
  const domainesCouverts = new Set(
    planningSemaine.flatMap(jour => jour.activites.map(a => a.domaine).filter(Boolean)),
  ).size;

  const deplacerSemaine = (offset: number) => {
    const jour = new Date(`${semaineDebut}T12:00:00`);
    jour.setDate(jour.getDate() + offset * 7);
    setSemaineDebut(jour.toISOString().split('T')[0]);
  };

  const libelleSemaine = `${new Date(`${semaineDebut}T12:00:00`).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })} → ${new Date(`${jourSemaine(6)}T12:00:00`).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}`;

  /** Planning hebdomadaire imprimable : programme d'éveil et de stimulation. */
  const imprimerPlanningSemaine = () => {
    const lignes = planningSemaine.map(({ jour, date, activites: ateliers }) => `
      <tr>
        <td class="jour">${jour}<span class="date">${new Date(`${date}T12:00:00`).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}</span></td>
        <td>
          ${ateliers.length > 0
            ? ateliers.map(a => `<div class="atelier">
                <span class="heure">${a.heureDebut || '—'}${a.heureFin ? ` - ${a.heureFin}` : ''}</span>
                <strong>${a.titre}</strong>
                <span class="meta">${[a.domaine, a.competenceVisee, a.groupe, a.lieu, a.educateurRef].filter(Boolean).join(' · ')}</span>
              </div>`).join('')
            : '<span class="vide">Aucun atelier programmé</span>'}
        </td>
      </tr>`).join('');

    const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8" />
<title>Planning des activités — semaine du ${libelleSemaine}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; margin: 26px; color: #0f172a; }
  header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #7c3aed; padding-bottom: 13px; margin-bottom: 18px; }
  h1 { font-size: 19px; margin: 0 0 4px; }
  .meta { font-size: 11px; color: #64748b; line-height: 1.6; }
  .badge { background: #f3e8ff; color: #6d28d9; font-size: 10px; font-weight: 800; padding: 4px 9px; border-radius: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th { background: #f8fafc; text-align: left; padding: 9px 8px; border: 1px solid #cbd5e1; font-size: 10px; text-transform: uppercase; letter-spacing: 0.4px; color: #475569; }
  td { padding: 9px 8px; border: 1px solid #e2e8f0; vertical-align: top; }
  td.jour { width: 130px; font-weight: 800; color: #6d28d9; }
  td.jour .date { display: block; font-size: 10px; font-weight: 600; color: #94a3b8; margin-top: 2px; }
  .atelier { margin-bottom: 7px; }
  .atelier:last-child { margin-bottom: 0; }
  .heure { display: inline-block; min-width: 84px; font-weight: 800; color: #c2410c; }
  .meta { display: block; font-size: 9.5px; color: #64748b; margin-top: 2px; }
  .vide { color: #cbd5e1; font-style: italic; }
  footer { margin-top: 18px; padding-top: 11px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; display: flex; justify-content: space-between; }
  .visa { margin-top: 26px; display: flex; justify-content: flex-end; gap: 60px; font-size: 10px; color: #475569; }
  .visa div { border-top: 1px solid #94a3b8; padding-top: 5px; width: 190px; text-align: center; }
  @media print { body { margin: 8mm; } }
</style></head>
<body>
  <header>
    <div>
      <h1>Planning hebdomadaire des activités d'éveil</h1>
      <div class="meta">
        <strong>${creche?.nom || 'Rawdha+'}</strong>${creche?.adresse ? ` — ${creche.adresse}` : ''}<br />
        Semaine du ${libelleSemaine} — ${activitesPlanifiees} atelier(s), ${domainesCouverts} domaine(s) d'éveil
      </div>
    </div>
    <span class="badge">Programme pédagogique</span>
  </header>
  <table>
    <thead><tr><th>Jour</th><th>Ateliers programmés (heure · intitulé · domaine · groupe · lieu · encadrant)</th></tr></thead>
    <tbody>${lignes}</tbody>
  </table>
  <div class="visa">
    <div>Visa de la direction</div>
    <div>Visa de l'inspection</div>
  </div>
  <footer>
    <span>Document généré par Rawdha+ — programme d'éveil et de stimulation psychomotrice affiché dans les salles.</span>
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

  const getGroupBadgeStyles = (grp: string) => {
    switch (grp) {
      case 'Bébés':
        return 'bg-pink-50 text-pink-700 border-pink-100';
      case 'Moyens':
        return 'bg-amber-50 text-amber-700 border-amber-100';
      default:
        return 'bg-sky-50 text-sky-700 border-sky-100';
    }
  };

  return (
    <div className="space-y-4 sm:space-y-8 font-sans">
      {/* Upper overview counts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6">
        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-4 hover:shadow-md transition">
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest">
              {isArabic ? 'الأنشطة المخططة' : 'Activités au Programme'}
            </p>
            <p className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5">{activites.length} {isArabic ? 'حصة نشاط' : 'ateliers'}</p>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-4 hover:shadow-md transition">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <Compass className="w-6 h-6 animate-spin" />
          </div>
          <div>
            <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest">
              {isArabic ? 'مجالات المهارات المكتسبة' : 'Piliers d\'Apprentissage'}
            </p>
            <p className="text-xl sm:text-2xl font-black text-indigo-600 mt-0.5">{isArabic ? '4 ركائز ذكاء' : '4 Piliers Cognitifs'}</p>
          </div>
        </div>
      </div>

      {/* Header title & add action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Sparkles className="w-6 h-6 sm:w-8 sm:h-8 text-indigo-600" />
            {t('activities')}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5 leading-tight">
            {isArabic 
              ? 'إنشاء ومتابعة الأنشطة البيداغوجية، الألعاب التفاعلية والأهداف الحسية والحركية للأطفال' 
              : 'Planifiez les activités d\'éveil sensoriel, d\'éducation physique, d\'arts plastiques et de comptines.'}
          </p>
        </div>
        <button 
          className="flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-4 py-2.5 sm:px-6 sm:py-3.5 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/20 transition-all cursor-pointer w-full sm:w-auto" 
          onClick={() => setShowModal(true)}
        >
          <Plus size={16} className="stroke-[3]" />
          <span>{t('activities.add')}</span>
        </button>
      </div>

      {/* Search Input bar */}
      <div className="bg-white p-3 sm:p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder={isArabic ? 'ابحث عن نشاط أو مهارة مستهدفة...' : 'Rechercher un atelier ou une compétence d\'éveil...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition-all text-xs sm:text-sm font-medium text-slate-800"
          />
        </div>
      </div>

      {/* Bascule fiches d'atelier / planning de la semaine */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setVuePlanning(false)}
          className={`rounded-xl px-3.5 py-2 text-[11px] font-bold transition ${
            !vuePlanning ? 'bg-indigo-600 text-white shadow-xs' : 'bg-white text-slate-500 border border-slate-200 hover:text-slate-800'
          }`}
        >
          {isArabic ? 'الأعمال والورشات' : "Fiches d'atelier"}
        </button>
        <button
          type="button"
          onClick={() => setVuePlanning(true)}
          className={`rounded-xl px-3.5 py-2 text-[11px] font-bold transition ${
            vuePlanning ? 'bg-indigo-600 text-white shadow-xs' : 'bg-white text-slate-500 border border-slate-200 hover:text-slate-800'
          }`}
        >
          {isArabic ? 'برنامج الأسبوع' : 'Planning de la semaine'}
        </button>
        <button
          type="button"
          onClick={imprimerPlanningSemaine}
          className="ml-auto inline-flex items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3.5 py-2 text-[11px] font-black text-violet-700 transition hover:bg-violet-100"
        >
          <Printer className="h-3.5 w-3.5" />
          {isArabic ? 'طباعة البرنامج' : 'Imprimer le planning'}
        </button>
      </div>

      {/* Planning hebdomadaire des activités d'éveil */}
      {vuePlanning && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
          <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/70 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-slate-500">
                {isArabic ? 'برنامج الأسبوع — أنشطة التنبيه والترويض الحركي' : "Planning hebdomadaire des activités d'éveil"}
              </p>
              <p className="mt-1 text-[11px] font-semibold text-slate-400">
                {activitesPlanifiees} {isArabic ? 'ورشة مبرمجة' : 'atelier(s) programmé(s)'} · {domainesCouverts}{' '}
                {isArabic ? 'مجال مكتسب' : "domaine(s) d'éveil couvert(s)"}
              </p>
            </div>
            <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1">
              <button
                type="button"
                onClick={() => deplacerSemaine(-1)}
                className="grid h-6 w-6 place-items-center rounded-lg text-sm font-black text-slate-500 hover:bg-slate-50 hover:text-indigo-600"
                aria-label={isArabic ? 'الأسبوع السابق' : 'Semaine précédente'}
              >
                ‹
              </button>
              <span className="px-1.5 text-[11px] font-black text-slate-700">{libelleSemaine}</span>
              <button
                type="button"
                onClick={() => deplacerSemaine(1)}
                className="grid h-6 w-6 place-items-center rounded-lg text-sm font-black text-slate-500 hover:bg-slate-50 hover:text-indigo-600"
                aria-label={isArabic ? 'الأسبوع التالي' : 'Semaine suivante'}
              >
                ›
              </button>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {planningSemaine.map(({ jour, date, activites: ateliers }) => (
              <div key={date} className="flex flex-col gap-2 p-3 sm:flex-row sm:gap-4 sm:px-5 sm:py-4">
                <div className="flex shrink-0 items-center gap-2 sm:w-40 sm:flex-col sm:items-start">
                  <span className="text-xs font-black capitalize text-indigo-700">{jour}</span>
                  <span className="text-[10px] font-bold text-slate-400">
                    {new Date(`${date}T12:00:00`).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                  </span>
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  {ateliers.length === 0 ? (
                    <span className="text-[11px] italic text-slate-300">
                      {isArabic ? 'لا توجد ورشة مبرمجة' : 'Aucun atelier programmé'}
                    </span>
                  ) : ateliers.map(atelier => (
                    <button
                      type="button"
                      key={atelier.id}
                      onClick={() => setSelectedActivite(atelier)}
                      className="block w-full rounded-xl border border-slate-100 bg-slate-50/60 p-2.5 text-left transition hover:border-indigo-200 hover:bg-indigo-50/50"
                    >
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-md bg-white px-1.5 py-0.5 text-[10px] font-black text-orange-600 border border-orange-100">
                          <Clock className="h-3 w-3" />
                          {atelier.heureDebut || '—'}{atelier.heureFin ? ` - ${atelier.heureFin}` : ''}
                        </span>
                        <span className="text-xs font-black text-slate-800">{atelier.titre}</span>
                        {atelier.domaine && (
                          <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-violet-700">
                            {atelier.domaine}
                          </span>
                        )}
                        <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${getGroupBadgeStyles(atelier.groupe)}`}>
                          {atelier.groupe}
                        </span>
                      </span>
                      <span className="mt-1 block text-[10px] font-semibold text-slate-400">
                        {[atelier.competenceVisee, atelier.lieu, atelier.educateurRef].filter(Boolean).join(' · ')}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Activities Grid */}
      <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-slide-up ${vuePlanning ? 'hidden' : ''}`}>
        {filteredActivites.length > 0 ? (
          filteredActivites.map((a) => {
            const grpStyle = getGroupBadgeStyles(a.groupe);
            
          return (
            <div 
              key={a.id} 
              className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs hover:shadow-lg hover:-translate-y-1 transition-all duration-200 flex flex-col justify-between cursor-pointer"
              onClick={() => setSelectedActivite(a)}
            >
              <div>
                {/* Card top banner */}
                <div className="flex items-center justify-between mb-4">
                  <span className={`px-2.5 py-1 text-xs font-bold rounded-lg border ${grpStyle}`}>
                    {a.groupe}
                  </span>
                  <span className="text-[11px] text-slate-400 font-bold flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                    {a.date}
                  </span>
                </div>

                {/* Activity Title */}
                <h3 className="text-lg font-extrabold text-slate-900 tracking-tight leading-snug">{a.titre}</h3>
                {a.domaine && (
                  <span className="mt-2 inline-block rounded-full bg-violet-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-violet-700">
                    {a.domaine}
                  </span>
                )}

                {/* Target Skill Row */}
                <div className="mt-4 flex items-center gap-2 p-2 bg-slate-50 border border-slate-100 rounded-xl">
                  <Target className="w-4 h-4 text-rose-500" />
                  <div className="text-xs">
                    <p className="text-slate-400 font-bold leading-none">{isArabic ? 'المهارة البيداغوجية' : 'Axe d\'Épanouissement'}</p>
                    <p className="text-slate-800 font-black mt-1">{a.competenceVisee}</p>
                  </div>
                </div>

                {/* Scheduled slots and Physical Place */}
                <div className="mt-4 space-y-2 text-xs font-semibold text-slate-500">
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>{a.heureDebut} - {a.heureFin}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>{isArabic ? 'المكان: ' : 'Lieu : '}<strong className="text-slate-700">{a.lieu}</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-emerald-500" />
                    <span>{isArabic ? 'المشرف: ' : 'Éducateur : '}<strong className="text-slate-700">{a.educateurRef}</strong></span>
                  </div>
                </div>

                {/* Material Supplies requirements */}
                {a.materielRequis && (
                  <div className="mt-5 pt-3 border-t border-slate-50">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1.5">{isArabic ? 'المستلزمات المطلوبة' : 'Matériel à préparer'}</p>
                    <p className="text-xs text-indigo-700 bg-indigo-50/50 rounded-lg p-2 font-medium leading-relaxed border border-indigo-100/30">
                      {a.materielRequis}
                    </p>
                  </div>
                )}

              </div>

              {/* Quick actions row */}
              <div className="mt-6 pt-4 border-t border-slate-50 flex justify-end">
                <button 
                  className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition cursor-pointer z-10"
                  onClick={async (e) => {
                    e.stopPropagation();
                    const confirmed = await confirm({
                      title: isArabic ? 'تأكيد حذف النشاط' : 'Confirmer la suppression de l’activité',
                      message: isArabic
                        ? 'سيتم حذف هذا النشاط المبرمج نهائياً.'
                        : 'Cette activité planifiée sera supprimée définitivement.',
                      confirmLabel: isArabic ? 'حذف النشاط' : 'Supprimer l’activité',
                      variant: 'danger',
                    });
                    if (confirmed) await deleteActivite(a.id);
                  }}
                >
                  <Trash2 size={15} />
                  <span>{isArabic ? 'حذف' : 'Supprimer'}</span>
                </button>
              </div>
            </div>
          );
          })
        ) : (
          <div className="col-span-full p-12 bg-white rounded-2xl border border-slate-100 text-center text-slate-400">
            <HelpCircle className="w-10 h-10 mx-auto text-slate-300 stroke-[1.5] mb-2" />
            <p className="font-extrabold">{isArabic ? 'لا توجد تطابقات للبحث' : 'Aucune activité planifiée'}</p>
            <p className="text-xs text-slate-400 mt-0.5">{isArabic ? 'أضف نشاطا ترفيهيا جديدا للبدء.' : 'Établissez un nouvel atelier éducatif dès aujourd\'hui.'}</p>
          </div>
        )}
      </div>

      {/* Adding Rich Activities Modal ("PLEINE DE FORMATION") */}
      <AnimatePresence>
        {showModal && (
          <div 
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-lg flex items-center justify-center z-[999] p-4 cursor-pointer"
            onClick={() => setShowModal(false)}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-lg max-h-[calc(100dvh-1rem)] sm:max-h-[85vh] mt-2 sm:mt-16 flex flex-col overflow-hidden font-sans cursor-default"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 bg-gradient-to-r from-indigo-600 to-violet-600 text-white flex justify-between items-center flex-shrink-0">
                <div>
                  <h3 className="text-xl font-black">{isArabic ? 'تخطيط نشاط ترفيهي وبيداغوجي جديد' : 'Planification d\'Atelier Éducatif'}</h3>
                  <p className="text-xs text-indigo-100 mt-0.5">{isArabic ? 'تحديد الأهداف، المربيات، المعدات، الموقع والفترات الزمنية للورشات' : 'Fiche d\'animation, équipement, aires de jeu & heures'}</p>
                </div>
                <button 
                  onClick={() => setShowModal(false)}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
                {/* Title */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    {isArabic ? 'عنوان النشاط التربوي *' : 'Intitulé de l\'Atelier *'}
                  </label>
                  <input 
                    type="text" 
                    placeholder="Ex: Pâte à modeler & Formes 3D"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition text-sm font-semibold text-slate-800" 
                    value={formData.titre} 
                    onChange={e => setFormData({...formData, titre: e.target.value})} 
                  />
                </div>

                {/* Domaine d'éveil travaillé */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    {isArabic ? 'مجال التنبيه والترويض' : "Domaine d'éveil"}
                  </label>
                  <select
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-semibold text-slate-800"
                    value={formData.domaine}
                    onChange={e => setFormData({...formData, domaine: e.target.value as ActiviteDomaine})}
                  >
                    {(['Éveil sensoriel', 'Psychomotricité', 'Langage & comptines', 'Motricité fine', 'Arts plastiques', 'Vie pratique & autonomie', 'Jeux libres'] as ActiviteDomaine[]).map(domaine => (
                      <option key={domaine} value={domaine}>{domaine}</option>
                    ))}
                  </select>
                </div>

                {/* Competence & Target Group (Row 2) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      {isArabic ? 'المهارة المستهدفة بالتطوير' : 'Axe de Développement Principal'}
                    </label>
                    <select
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-semibold text-slate-800"
                      value={formData.competenceVisee}
                      onChange={e => setFormData({...formData, competenceVisee: e.target.value})}
                    >
                      <option value="Motricité Fine">Motricité Fine & Coordination</option>
                      <option value="Éveil Musical">Éveil Musical & Sensoriel</option>
                      <option value="Sortie & Jardin">Éco-citoyenneté & Extérieur</option>
                      <option value="Graphisme et Couleurs">Graphisme, Dessin et Peinture</option>
                      <option value="Coopération">Jeu Social & Collaboration</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      {isArabic ? 'الفئة العمرية المستهدفة *' : 'Groupe Cible *'}
                    </label>
                    <select 
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition text-sm font-semibold text-slate-800" 
                      value={formData.groupe} 
                      onChange={e => setFormData({...formData, groupe: e.target.value as any})}
                    >
                      <option value="Bébés">Bébés (0-2 ans)</option>
                      <option value="Moyens">Moyens (2-4 ans)</option>
                      <option value="Grands">Grands (4-6 ans)</option>
                    </select>
                  </div>
                </div>

                {/* Times and Calendar Date (Row 3) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      {isArabic ? 'التاريخ الفعلي *' : 'Date de Tenue *'}
                    </label>
                    <input 
                      type="date"
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-bold text-slate-800"
                      value={formData.date}
                      onChange={e => setFormData({...formData, date: e.target.value})}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      {isArabic ? 'البداية' : 'Heure de Début'}
                    </label>
                    <input 
                      type="text" 
                      placeholder="10:00"
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-semibold text-slate-800" 
                      value={formData.heureDebut} 
                      onChange={e => setFormData({...formData, heureDebut: e.target.value})} 
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      {isArabic ? 'النهاية' : 'Heure de Fin'}
                    </label>
                    <input 
                      type="text" 
                      placeholder="11:00"
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-semibold text-slate-800" 
                      value={formData.heureFin} 
                      onChange={e => setFormData({...formData, heureFin: e.target.value})} 
                    />
                  </div>
                </div>

                {/* Assigned Educator & Physical Place */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      {isArabic ? 'المربي المشرف المنشط *' : 'Animateur Référent *'}
                    </label>
                    <select
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-semibold text-slate-800"
                      value={formData.educateurRef}
                      onChange={e => setFormData({...formData, educateurRef: e.target.value})}
                    >
                      {personnelData.map(p => (
                        <option key={p.id} value={`${p.prenom} ${p.nom}`}>
                          {p.prenom} {p.nom} ({p.poste})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      {isArabic ? 'مكان النشاط وصالة التدريب *' : 'Espace choisi *'}
                    </label>
                    <input 
                      type="text" 
                      placeholder="Ex: Salle d'Éveil, Salle Peinture"
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-bold text-slate-800" 
                      value={formData.lieu} 
                      onChange={e => setFormData({...formData, lieu: e.target.value})} 
                    />
                  </div>
                </div>

                {/* Material Requirements Checklist */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    {isArabic ? 'قائمة المستلزمات والمواد المطلوبة' : 'Matériel requis à préparer'}
                  </label>
                  <input 
                    type="text" 
                    placeholder="Ex: Papier canson, Feutres magiques, tablier salissant..."
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-semibold text-slate-800" 
                    value={formData.materielRequis} 
                    onChange={e => setFormData({...formData, materielRequis: e.target.value})} 
                  />
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

      {/* Activity Details Info View Modal */}
      <AnimatePresence>
        {selectedActivite && (
          <div 
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-lg flex items-center justify-center z-[999] p-4 cursor-pointer"
            onClick={() => setSelectedActivite(null)}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-lg max-h-[calc(100dvh-1rem)] sm:max-h-[85vh] mt-2 sm:mt-16 flex flex-col overflow-hidden font-sans cursor-default"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 sm:p-6 bg-gradient-to-r from-teal-600 to-emerald-600 text-white flex justify-between items-center flex-shrink-0">
                <div>
                  <h3 className="text-xl font-black">{selectedActivite.titre}</h3>
                  <p className="text-xs text-teal-100 mt-0.5">{isArabic ? 'تفاصيل النشاط ووسائله البيداغوجية' : 'Fiche d\'animation d\'Atelier Éducatif'}</p>
                </div>
                <button 
                  onClick={() => setSelectedActivite(null)}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">{isArabic ? 'الفئة المستهدفة' : 'Groupe Enfant'}</span>
                    <span className="text-xs font-black text-slate-800">{selectedActivite.groupe}</span>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">{isArabic ? 'الموقع' : 'Lieu / Espace'}</span>
                    <span className="text-xs font-black text-slate-855">{selectedActivite.lieu}</span>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">{isArabic ? 'الوقت' : 'Plage Horaire'}</span>
                    <span className="text-xs font-black text-slate-800">{selectedActivite.heureDebut} - {selectedActivite.heureFin}</span>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">{isArabic ? 'التاريخ الفني' : 'Date de réalisation'}</span>
                    <span className="text-xs font-black text-slate-800">{selectedActivite.date}</span>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1.5">{isArabic ? 'محور الكفاءة المستهدف' : 'Compétence & Développement Visé'}</span>
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                    <Target className="w-5 h-5 text-rose-500 stroke-[2.5]" />
                    <span>{selectedActivite.competenceVisee}</span>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1.5">{isArabic ? 'المشرف المسؤول' : 'Éducateur Leader'}</span>
                  <span className="text-sm font-black text-indigo-600">{selectedActivite.educateurRef}</span>
                </div>

                {selectedActivite.materielRequis && (
                  <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl">
                    <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 block mb-1">{isArabic ? 'المستلزمات المطلوبة' : 'Matériel à préparer'}</span>
                    <p className="text-xs font-bold text-indigo-900 leading-relaxed">{selectedActivite.materielRequis}</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
