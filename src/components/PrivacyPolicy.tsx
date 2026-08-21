import React from 'react';
import { ArrowLeft, Baby, ShieldCheck } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export default function PrivacyPolicy() {
  const { language, setLanguage } = useLanguage();
  const isAr = language === 'ar';

  return (
    <main className="min-h-[100dvh] bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 px-4 py-6 text-slate-900 sm:px-6 sm:py-10" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="mx-auto w-full max-w-4xl">
        <header className="mb-5 flex flex-col gap-4 text-white sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500"><Baby className="h-6 w-6" /></div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-200">RAWDHA+</p>
              <h1 className="text-xl font-black sm:text-2xl">{isAr ? 'الخصوصية وحماية البيانات' : 'Confidentialité et protection des données'}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button type="button" onClick={() => setLanguage('fr')} className={`rounded-xl px-3 py-2 text-xs font-black ${!isAr ? 'bg-white text-indigo-700' : 'bg-white/10 text-white'}`}>FR</button>
            <button type="button" onClick={() => setLanguage('ar')} className={`rounded-xl px-3 py-2 text-xs font-black ${isAr ? 'bg-white text-indigo-700' : 'bg-white/10 text-white'}`}>عربي</button>
          </div>
        </header>

        <article className="rounded-3xl bg-white p-5 shadow-2xl sm:p-10">
          <div className="mb-8 flex items-start gap-3 rounded-2xl border border-indigo-100 bg-indigo-50 p-4 text-sm leading-6 text-indigo-950">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" />
            <p>{isAr ? 'يوضح هذا النص بطريقة مبسطة كيف تعالج الروضة البيانات المرسلة عبر رابط التسجيل. يمكنكم الرجوع إلى بيانات الاتصال الموجودة في رسالة الدعوة لأي سؤال أو طلب.' : "Ce document explique simplement comment la crèche traite les données envoyées via le lien d’admission. Pour toute question ou demande, utilisez les coordonnées figurant dans le message d’invitation."}</p>
          </div>

          <div className="space-y-7 text-sm leading-7 text-slate-700">
            <Section title={isAr ? '1. المسؤول عن المعالجة' : '1. Responsable du traitement'}>
              {isAr ? 'الروضة التي أرسلت لكم رابط التسجيل هي المسؤولة عن معالجة الملف. يرجى استعمال بيانات الاتصال الموجودة في رسالة الدعوة لطلب أي توضيح أو ممارسة حق من حقوقكم.' : "La crèche qui vous a transmis le lien d’admission est responsable du traitement du dossier. Utilisez les coordonnées figurant dans le message d’invitation pour demander une information ou exercer un droit."}
            </Section>
            <Section title={isAr ? '2. البيانات المعالجة' : '2. Données collectées'}>
              {isAr ? 'قد يتضمن الملف هوية الطفل وولي الأمر، رقم الهاتف والبريد الإلكتروني، معلومات صحية أو غذائية ضرورية للاستقبال، والوثائق التي تختارون إرفاقها. لا ترسلوا إلا المعلومات الضرورية.' : "Le dossier peut contenir l’identité de l’enfant et du parent ou tuteur, le téléphone et l’e-mail, des informations de santé ou d’alimentation nécessaires à l’accueil, ainsi que les documents que vous choisissez de joindre. N’envoyez que les informations nécessaires."}
            </Section>
            <Section title={isAr ? '3. الأغراض' : '3. Finalités'}>
              {isAr ? 'تُستخدم البيانات لدراسة طلب التسجيل، والتواصل مع الأسرة، وتنظيم استقبال الطفل، والمساهمة في حماية صحته وسلامته. لا يتم قبول الطفل آلياً عبر هذا النموذج.' : "Les données servent à examiner la demande d’admission, contacter la famille, préparer l’accueil de l’enfant et contribuer à sa sécurité et à sa santé. L’enfant n’est pas inscrit automatiquement par ce formulaire."}
            </Section>
            <Section title={isAr ? '4. الوصول والحماية' : '4. Accès et sécurité'}>
              {isAr ? 'يقتصر الوصول التشغيلي على المستخدمين المصرح لهم في الروضة المعنية. تطبق Rawdha+ فصل البيانات بين دور الحضانة وتسجل العمليات التقنية المهمة.' : "L’accès opérationnel est limité aux utilisateurs autorisés de la crèche concernée. Rawdha+ applique une séparation des données entre crèches et journalise les opérations techniques importantes."}
            </Section>
            <Section title={isAr ? '5. المدة والحقوق' : '5. Conservation et droits'}>
              {isAr ? 'تحدد الروضة مدة الاحتفاظ المناسبة للطلب والوثائق، ثم تحذف أو تؤرشف البيانات وفقاً لسياستها. يمكنكم طلب الاطلاع أو التصحيح أو الحذف عندما يسمح بذلك القانون والتزامات الاحتفاظ، عبر التواصل مع إدارة الروضة.' : "La crèche définit la durée de conservation adaptée à la demande et aux documents, puis supprime ou archive les données selon sa politique. Vous pouvez demander l’accès, la rectification ou la suppression lorsque la loi et les obligations de conservation le permettent, en contactant la direction."}
            </Section>
            <Section title={isAr ? '6. بيانات الأطفال' : '6. Données concernant les enfants'}>
              {isAr ? 'لا ترسلوا بيانات الطفل إلا بصفتكم ولياً أو وصياً مخولاً. لا تستخدموا رابطاً عاماً لإرسال معلومات تخص طفلاً آخر دون إذن مناسب.' : "N’envoyez les données de l’enfant qu’en qualité de parent ou de tuteur habilité. N’utilisez pas un lien public pour envoyer les informations d’un autre enfant sans autorisation appropriée."}
            </Section>
          </div>

          <div className="mt-9 flex flex-col gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs leading-5 text-slate-500">{isAr ? 'آخر تحديث: 17 أغسطس 2026' : 'Dernière mise à jour : 17 août 2026'}</p>
            <button type="button" onClick={() => { window.location.href = '/admission'; }} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-black text-white transition hover:bg-indigo-700"><ArrowLeft className="h-4 w-4" />{isAr ? 'العودة إلى التسجيل' : "Retour à l’admission"}</button>
          </div>
        </article>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section><h2 className="mb-2 text-base font-black text-slate-900">{title}</h2><p>{children}</p></section>;
}
