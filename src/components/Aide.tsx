import { Baby, CalendarCheck, CreditCard, HelpCircle, Settings, Utensils } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export default function Aide() {
  const { language } = useLanguage();
  const isFrench = language !== 'ar';
  const sections = [
    { icon: Baby, title: isFrench ? 'Enfants' : 'الأطفال', text: isFrench ? 'Ajoutez les enfants, leurs responsables et les documents nécessaires.' : 'أضيفوا الأطفال وأولياءهم والوثائق المطلوبة.' },
    { icon: CalendarCheck, title: isFrench ? 'Présences' : 'الحضور', text: isFrench ? 'Ouvrez la journée, pointez les arrivées et validez le récapitulatif.' : 'افتحوا اليوم وسجلوا الحضور ثم اعتمدوا الملخص.' },
    { icon: CreditCard, title: isFrench ? 'Factures' : 'الفواتير', text: isFrench ? 'Créez une facture, enregistrez le règlement et imprimez le reçu.' : 'أنشئوا الفاتورة وسجلوا الدفع واطبعوا الوصل.' },
    { icon: Utensils, title: isFrench ? 'Repas et activités' : 'الوجبات والأنشطة', text: isFrench ? 'Ajoutez le menu et les activités de la journée pour garder un suivi clair.' : 'أضيفوا قائمة الطعام وأنشطة اليوم لمتابعة واضحة.' },
    { icon: Settings, title: isFrench ? 'Paramètres' : 'الإعدادات', text: isFrench ? 'Modifiez les coordonnées de la crèche, le logo et les préférences.' : 'عدّلوا معلومات الحضانة والشعار والتفضيلات.' },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6" dir={isFrench ? 'ltr' : 'rtl'}>
      <div className="border-b border-slate-200 pb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{isFrench ? 'Guide' : 'الدليل'}</p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl"><HelpCircle className="h-7 w-7 text-indigo-600" />{isFrench ? 'Comment utiliser Rawdha+' : 'كيفية استخدام روضتي+'}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{isFrench ? 'Retrouvez ici les étapes principales, sans fenêtre supplémentaire.' : 'تجدون هنا المراحل الرئيسية دون نوافذ إضافية.'}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map(({ icon: Icon, title, text }) => <section key={title} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"><Icon className="h-5 w-5 text-indigo-600" /><h2 className="mt-4 font-bold text-slate-900">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{text}</p></section>)}
      </div>
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-bold text-slate-900">{isFrench ? 'Besoin d’une réponse ?' : 'هل تحتاجون إلى جواب؟'}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{isFrench ? 'Ouvrez la page Support dans le menu pour écrire à l’équipe, signaler un problème ou envoyer une suggestion.' : 'افتحوا صفحة الدعم من القائمة لمراسلة الفريق أو الإبلاغ عن مشكلة أو إرسال اقتراح.'}</p></section>
    </div>
  );
}
