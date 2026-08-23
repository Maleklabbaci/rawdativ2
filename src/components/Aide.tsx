// Style Rawdha+ : guide regroupé, directement accessible depuis Paramètres et l’assistant flottant.
import { Baby, CalendarCheck, ClipboardList, CreditCard, HelpCircle, QrCode, Settings, Utensils } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export default function Aide({ onNavigate }: { onNavigate?: (page: 'demarrage' | 'support') => void }) {
  const { language } = useLanguage();
  const isFrench = language !== 'ar';
  const sections = [
    { href: '/enfants', icon: Baby, title: isFrench ? 'Enfants' : 'الأطفال', text: isFrench ? 'Ajoutez les enfants, leurs responsables et les documents nécessaires.' : 'أضيفوا الأطفال وأولياءهم والوثائق المطلوبة.' },
    { href: '/presences', icon: CalendarCheck, title: isFrench ? 'Présences' : 'الحضور', text: isFrench ? 'Ouvrez la journée, pointez les arrivées et validez le récapitulatif.' : 'افتحوا اليوم وسجلوا الحضور ثم اعتمدوا الملخص.' },
    { href: '/factures', icon: CreditCard, title: isFrench ? 'Factures' : 'الفواتير', text: isFrench ? 'Créez une facture, enregistrez le règlement et imprimez le reçu.' : 'أنشئوا الفاتورة وسجلوا الدفع واطبعوا الوصل.' },
    { href: '/repas', icon: Utensils, title: isFrench ? 'Repas et activités' : 'الوجبات والأنشطة', text: isFrench ? 'Ajoutez le menu et les activités de la journée pour garder un suivi clair.' : 'أضيفوا قائمة الطعام وأنشطة اليوم لمتابعة واضحة.' },
    { href: '/admissions', icon: QrCode, title: isFrench ? 'Admissions QR' : 'طلبات التسجيل عبر QR', text: isFrench ? 'Consultez les demandes reçues via votre QR et acceptez ou refusez un dossier.' : 'راجعوا الطلبات الواردة عبر رمز QR واقبلوا الملفات أو ارفضوها.' },
    { href: '/parametres', icon: Settings, title: isFrench ? 'Paramètres' : 'الإعدادات', text: isFrench ? 'Modifiez les coordonnées de la crèche, le logo et les préférences.' : 'عدّلوا معلومات الحضانة والشعار والتفضيلات.' },
    { href: '/demarrage', icon: ClipboardList, title: isFrench ? 'Démarrage' : 'البدء', text: isFrench ? 'Reprenez les informations essentielles de votre crèche et votre configuration initiale.' : 'راجعوا معلومات الحضانة الأساسية وإعداد البداية.' },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6" dir={isFrench ? 'ltr' : 'rtl'}>
      <div className="border-b border-slate-200 pb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{isFrench ? 'Guide' : 'الدليل'}</p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl"><HelpCircle className="h-7 w-7 text-indigo-600" />{isFrench ? 'Comment utiliser Rawdha+' : 'كيفية استخدام روضتي+'}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{isFrench ? 'Retrouvez ici les étapes principales, sans fenêtre supplémentaire.' : 'تجدون هنا المراحل الرئيسية دون نوافذ إضافية.'}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map(({ href, icon: Icon, title, text }) => <a key={title} href={href} onClick={event => { if (href === '/demarrage' && onNavigate) { event.preventDefault(); onNavigate('demarrage'); } }} className="group rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md"><Icon className="h-5 w-5 text-indigo-600" /><h2 className="mt-4 font-bold text-slate-900">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{text}</p><span className="mt-4 inline-flex text-xs font-bold text-indigo-600 group-hover:underline">{isFrench ? 'Ouvrir le module →' : 'فتح الوحدة ←'}</span></a>)}
      </div>
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-bold text-slate-900">{isFrench ? 'Besoin d’une réponse ?' : 'هل تحتاجون إلى جواب؟'}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{isFrench ? 'Utilisez la bulle Assistant Rawdha+ en bas de l’écran pour ouvrir ce guide, reprendre le démarrage ou écrire directement à l’équipe.' : 'استخدموا فقاعة مساعد روضة+ أسفل الشاشة لفتح الدليل أو مراجعة البداية أو مراسلة الفريق مباشرة.'}</p>{onNavigate && <button type="button" onClick={() => onNavigate('support')} className="mt-4 rounded-xl bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700 transition hover:bg-indigo-100">{isFrench ? 'Contacter le support' : 'مراسلة الدعم'}</button>}</section>
    </div>
  );
}
