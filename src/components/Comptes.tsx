import React, { useState } from 'react';
import { useDb } from '../contexts/DbContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { 
  Users, UserPlus, Search, Trash2, CheckCircle, ShieldAlert, 
  User, Sparkles, AlertCircle, Mail, Lock, Baby, 
  RefreshCw, ToggleLeft, ToggleRight, Calendar, Building, Clock 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function Comptes() {
  const { comptes, enfants, addCompte, updateCompte, deleteCompte, refreshAll, loading } = useDb();
  const { language, isFrench } = useLanguage();
  const { user: currentUser } = useAuth();

  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  
  const getDefaultDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  };

  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [nomCreche, setNomCreche] = useState('');
  const [dateFinAbonnement, setDateFinAbonnement] = useState(getDefaultDate());
  const [abonnementActif, setAbonnementActif] = useState(true);
  const [isTrial, setIsTrial] = useState(false);
  
  const isAdmin = currentUser?.role === 'admin';

  if (!isAdmin) {
    return (
      <div className="p-12 text-center bg-white border border-slate-200 rounded-3xl shadow-sm text-slate-500 max-w-lg mx-auto mt-10">
        <ShieldAlert className="w-14 h-14 text-rose-500 mx-auto mb-4" />
        <h3 className="font-extrabold text-slate-900 text-xl">{isFrench ? 'Accès non autorisé' : 'غير مسموح بالدخول'}</h3>
      </div>
    );
  }

  const filteredComptes = comptes.filter(c => {
    const term = searchTerm.toLowerCase();
    if (c.role !== 'directeur' && c.role !== 'admin') return false;
    return (
      c.nom.toLowerCase().includes(term) ||
      c.prenom.toLowerCase().includes(term) ||
      c.email.toLowerCase().includes(term) ||
      (c.nomCreche && c.nomCreche.toLowerCase().includes(term))
    );
  });

  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-8 h-8 text-indigo-600" />
            <span>{isFrench ? 'Abonnés & Directeurs' : 'المشتركون ومدراء الروضات'}</span>
          </h1>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-150 text-slate-500 text-[11px] font-black tracking-wider uppercase bg-slate-100/30">
                <th className="px-6 py-4">{isFrench ? 'Utilisateur' : 'المستفيد'}</th>
                <th className="px-6 py-4">{isFrench ? 'Crèche' : 'اسم الروضة'}</th>
                <th className="px-6 py-4">{isFrench ? 'Enfants' : 'عدد الأطفال'}</th>
                <th className="px-6 py-4">{isFrench ? 'Dernière Activité' : 'آخر نشاط'}</th>
                <th className="px-6 py-4">{isFrench ? 'Date Expiration' : 'تاريخ النهاية'}</th>
                <th className="px-6 py-4 text-center">{isFrench ? 'Actions' : 'خيارات'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredComptes.map((c) => {
                const enfantsDeLaCreche = enfants.filter(e => e.crecheId === c.id);
                const nbEnfants = enfantsDeLaCreche.length;
                const lastActivityDate = nbEnfants > 0
                  ? enfantsDeLaCreche.sort((a, b) => new Date(b.dateInscription).getTime() - new Date(a.dateInscription).getTime())[0].dateInscription
                  : null;

                return (
                  <tr key={c.id} className="hover:bg-slate-50/50 transition">
                    <td className="px-6 py-4 whitespace-nowrap font-bold text-sm text-slate-900">{c.prenom} {c.nom}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-indigo-700">{c.nomCreche || '--'}</td>
                    
                    {/* العدد */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Baby className="w-4 h-4 text-rose-500" />
                        <span className="text-sm font-black text-slate-800">{nbEnfants}</span>
                      </div>
                    </td>

                    {/* النشاط */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                        <Clock className="w-3.5 h-3.5 text-indigo-500" />
                        {lastActivityDate ? new Date(lastActivityDate).toLocaleDateString() : (isFrench ? 'Jamais' : 'غير نشط')}
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-xs font-bold">{c.dateFinAbonnement || '--'}</td>
                    <td className="px-6 py-4 text-center">
                       <button onClick={() => deleteCompte(c.id)} className="text-rose-500 cursor-pointer"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
