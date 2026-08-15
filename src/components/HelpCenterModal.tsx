import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowRight,
  BarChart3,
  Bell,
  BookOpen,
  CalendarCheck,
  CheckCircle2,
  CreditCard,
  HelpCircle,
  LayoutDashboard,
  MessageCircleQuestion,
  School,
  Settings,
  Users,
  Utensils,
  UserCheck,
  X,
} from 'lucide-react';

interface HelpCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPage: string;
  language: 'fr' | 'ar';
}

const pageIcons: Record<string, any> = {
  dashboard: LayoutDashboard,
  enfants: Users,
  classes: School,
  presences: CalendarCheck,
  paiements: CreditCard,
  rapports: BarChart3,
  personnel: UserCheck,
  activites: Bell,
  repas: Utensils,
  parametres: Settings,
  comptes: Users,
  notifications: Bell,
};

export default function HelpCenterModal({ isOpen, onClose, currentPage, language }: HelpCenterModalProps) {
  const isArabic = language === 'ar';
  const Icon = pageIcons[currentPage] || HelpCircle;

  const pages: Record<string, { fr: [string, string, string]; ar: [string, string, string] }> = {
    dashboard: {
      fr: ['Tableau de bord', 'Votre vue d’ensemble', 'Retrouvez rapidement les chiffres essentiels de votre crèche : enfants inscrits, présences, paiements et activité récente.'],
      ar: ['لوحة التحكم', 'نظرة شاملة', 'اطّلع بسرعة على أهم أرقام روضتك: الأطفال المسجلون، الحضور، المدفوعات والنشاطات الأخيرة.'],
    },
    enfants: {
      fr: ['Enfants', 'Les dossiers des enfants', 'Créez un dossier complet pour chaque enfant, ajoutez les informations des parents, les allergies, les documents et les notes importantes.'],
      ar: ['الأطفال', 'ملفات الأطفال', 'أنشئ ملفاً كاملاً لكل طفل، وأضف معلومات الأولياء والحساسيات والوثائق والملاحظات المهمة.'],
    },
    classes: {
      fr: ['Classes', 'Organiser les groupes', 'Créez vos groupes d’âge, indiquez leur capacité et affectez les enfants et les éducatrices pour garder une organisation claire.'],
      ar: ['الأقسام', 'تنظيم المجموعات', 'أنشئ مجموعات الأعمار، حدّد الطاقة الاستيعابية، واربط الأطفال والمربيات بتنظيم واضح.'],
    },
    presences: {
      fr: ['Présences', 'Suivre la journée', 'Pointez les arrivées et les départs, consultez les absences et gardez une trace fiable de la présence des enfants.'],
      ar: ['الحضور', 'متابعة اليوم', 'سجّل الدخول والخروج، وتابع الغيابات واحتفظ بسجل موثوق لحضور الأطفال.'],
    },
    paiements: {
      fr: ['Paiements', 'Gérer les règlements', 'Suivez les factures, les échéances, les paiements en attente et la situation financière de chaque famille.'],
      ar: ['المدفوعات', 'تسيير التسديدات', 'تابع الفواتير والمواعيد والمدفوعات المعلقة والوضعية المالية لكل عائلة.'],
    },
    rapports: {
      fr: ['Rapports', 'Comprendre votre activité', 'Analysez les présences, les inscriptions et les paiements grâce à des indicateurs simples pour mieux décider.'],
      ar: ['التقارير', 'فهم نشاطك', 'حلّل الحضور والتسجيلات والمدفوعات عبر مؤشرات بسيطة تساعدك على اتخاذ القرار.'],
    },
    personnel: {
      fr: ['Personnel', 'Votre équipe', 'Ajoutez les membres de votre équipe, leurs fonctions, leur statut et les informations utiles à la gestion quotidienne.'],
      ar: ['الموظفون', 'فريقك', 'أضف أعضاء فريقك ووظائفهم وحالتهم والمعلومات المفيدة لتسيير العمل اليومي.'],
    },
    activites: {
      fr: ['Activités', 'Animer la crèche', 'Préparez les activités réalisées avec les enfants et gardez un historique simple à consulter.'],
      ar: ['النشاطات', 'تنشيط الحضانة', 'حضّر النشاطات المنجزة مع الأطفال واحتفظ بسجل سهل الرجوع إليه.'],
    },
    repas: {
      fr: ['Repas', 'Organiser les menus', 'Planifiez les repas et partagez une information claire avec l’équipe et les familles.'],
      ar: ['الوجبات', 'تنظيم القوائم', 'خطط للوجبات وشارك المعلومات بوضوح مع الفريق والعائلات.'],
    },
    parametres: {
      fr: ['Paramètres', 'Personnaliser Rawdha+', 'Modifiez les informations de votre crèche, les tarifs, le logo, les coordonnées et les préférences de la plateforme.'],
      ar: ['الإعدادات', 'تخصيص روضتي', 'عدّل معلومات الحضانة والرسوم والشعار وبيانات الاتصال وتفضيلات المنصة.'],
    },
    comptes: {
      fr: ['Directeurs de crèches', 'Gérer les accès', 'Examinez les demandes d’accès, acceptez ou refusez les nouveaux directeurs et gérez les comptes de la plateforme.'],
      ar: ['مدراء الحضانات', 'تسيير الدخول', 'راجع طلبات الدخول، واقبل أو ارفض المدراء الجدد، وسَيّر حسابات المنصة.'],
    },
    notifications: {
      fr: ['Notifications', 'Rester informé', 'Retrouvez les annonces et les informations importantes envoyées par l’administration.'],
      ar: ['الإشعارات', 'ابقَ على اطلاع', 'اطّلع على الإعلانات والمعلومات المهمة التي ترسلها الإدارة.'],
    },
  };

  const [title, section, description] = pages[currentPage]?.[isArabic ? 'ar' : 'fr'] || (isArabic
    ? ['Rawdha+', 'Votre plateforme de gestion', 'Rawdha+ vous aide à organiser votre crèche, suivre les enfants et simplifier votre quotidien.']
    : ['Rawdha+', 'Votre plateforme de gestion', 'Rawdha+ vous aide à organiser votre crèche, suivre les enfants et simplifier votre quotidien.']);

  const generalSteps = isArabic
    ? [
        ['1', 'أضف معلومات الحضانة', 'ابدأ من الإعدادات وأدخل معلومات الحضانة الأساسية.'],
        ['2', 'أنشئ بياناتك', 'أضف الأطفال والموظفين والأقسام والوجبات والنشاطات.'],
        ['3', 'تابع يومك', 'استعمل لوحة التحكم لتسيير الحضور والمدفوعات والتقارير.'],
      ]
    : [
        ['1', 'Configurez votre crèche', 'Commencez par les paramètres et renseignez les informations essentielles.'],
        ['2', 'Créez vos données', 'Ajoutez les enfants, le personnel, les classes, les repas et les activités.'],
        ['3', 'Pilotez votre journée', 'Utilisez le tableau de bord pour suivre présences, paiements et rapports.'],
      ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-md"
          dir={isArabic ? 'rtl' : 'ltr'}
          role="dialog"
          aria-modal="true"
          aria-labelledby="help-center-title"
        >
          <motion.div
            initial={{ opacity: 0, y: 22, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 22, scale: 0.97 }}
            className="relative max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[2rem] bg-white shadow-2xl"
          >
            <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-indigo-800 px-6 py-7 text-white sm:px-8">
              <button type="button" onClick={onClose} aria-label={isArabic ? 'إغلاق' : 'Fermer'} className="absolute top-4 ltr:right-4 rtl:left-4 rounded-xl p-2 text-white/70 transition hover:bg-white/10 hover:text-white cursor-pointer">
                <X className="h-5 w-5" />
              </button>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-indigo-200">
                  <BookOpen className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-200">{isArabic ? 'دليل Rawdha+' : 'Guide Rawdha+'}</p>
                  <h2 id="help-center-title" className="mt-1 text-2xl font-black">{isArabic ? 'كيف تعمل المنصة؟' : 'Comment fonctionne la plateforme ?'}</h2>
                </div>
              </div>
            </div>

            <div className="space-y-7 p-5 sm:p-8">
              <section className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-5">
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/20">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-wider text-indigo-600">{section}</p>
                    <h3 className="mt-1 text-xl font-black text-slate-900">{title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">{description}</p>
                  </div>
                </div>
              </section>

              <section>
                <div className="mb-4 flex items-center gap-2">
                  <MessageCircleQuestion className="h-5 w-5 text-indigo-600" />
                  <h3 className="text-lg font-black text-slate-900">{isArabic ? 'طريقة البدء' : 'Pour bien démarrer'}</h3>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  {generalSteps.map(([number, stepTitle, stepText]) => (
                    <div key={number} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-sm font-black text-indigo-600 shadow-sm">{number}</span>
                        <h4 className="text-sm font-black text-slate-900">{stepTitle}</h4>
                      </div>
                      <p className="mt-3 text-xs leading-relaxed text-slate-500">{stepText}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="grid gap-3 sm:grid-cols-2">
                <div className="flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                  <div>
                    <h4 className="text-sm font-black text-emerald-900">{isArabic ? 'نصيحة' : 'Astuce'}</h4>
                    <p className="mt-1 text-xs leading-relaxed text-emerald-800/80">{isArabic ? 'يمكنك تغيير اللغة من أعلى الشاشة في أي وقت.' : 'Vous pouvez changer la langue en haut de l’écran à tout moment.'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-2xl border border-violet-100 bg-violet-50 p-4">
                  <ArrowRight className="mt-0.5 h-5 w-5 shrink-0 text-violet-600 rtl:rotate-180" />
                  <div>
                    <h4 className="text-sm font-black text-violet-900">{isArabic ? 'الدعم الفني' : 'Support technique'}</h4>
                    <p className="mt-1 text-xs leading-relaxed text-violet-800/80">{isArabic ? 'اضغط على فقاعة الدعم للتواصل معنا مباشرة.' : 'Ouvrez la bulle de support pour nous écrire directement.'}</p>
                  </div>
                </div>
              </section>

              <button type="button" onClick={onClose} className="w-full rounded-xl bg-indigo-600 py-3.5 text-sm font-black text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-700 cursor-pointer">
                {isArabic ? 'فهمت، لنبدأ' : 'J’ai compris, commencer'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
