import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useEstablishment } from '../context/EstablishmentContext'
import { CreditCard, Banknote, ArrowUpRight } from 'lucide-react'
import { useToast } from '../context/ToastContext'

const inputStyle = { width: '100%', padding: '11px 14px', borderRadius: '12px', border: '1.5px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text-primary)', fontSize: '14px' }
const labelStyle = { display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }

export function Payments() {
  const { nurseryId } = useEstablishment()
  const [formData, setFormData] = useState({ amount: '', method: 'Cash' })
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const { showToast } = useToast()

  const recent = [
    { name: 'Amira Benali', amount: '8 500 DA', method: 'Espèces', date: 'Aujourd\'hui', status: 'Payé' },
    { name: 'Yacine Boudjema', amount: '8 500 DA', method: 'Virement', date: 'Hier', status: 'Payé' },
    { name: 'Sarah Meziane', amount: '8 500 DA', method: 'CCP', date: '18 mai', status: 'En attente' },
    { name: 'Omar Khalil', amount: '8 500 DA', method: 'Espèces', date: '15 mai', status: 'Payé' },
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const amount = parseFloat(formData.amount)
    if (!nurseryId || !formData.amount || isNaN(amount) || amount <= 0) return
    setLoading(true)
    const { error } = await supabase.from('payments').insert([{ nursery_id: nurseryId, amount, method: formData.method, status: 'Paid' }])
    if (!error) {
      setSaved(true)
      setFormData({ amount: '', method: 'Cash' })
      showToast('Paiement enregistré avec succès', 'success')
      setTimeout(() => setSaved(false), 3000)
    } else {
      showToast("Impossible d'enregistrer le paiement", 'error')
    }
    setLoading(false)
  }

  return (
    <div style={{ padding: '28px', maxWidth: '1400px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Paiements</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: '4px 0 0' }}>Suivi et enregistrement des paiements</p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '24px' }}>
        {[
          { label: 'Ce mois', value: '255 000 DA', icon: Banknote, color: '#4F46E5' },
          { label: 'Encaissé', value: '221 000 DA', icon: CreditCard, color: '#10B981' },
          { label: 'En attente', value: '34 000 DA', icon: ArrowUpRight, color: '#F59E0B' },
        ].map((s, i) => {
          const Icon = s.icon
          return (
            <div key={i} style={{ background: 'var(--surface)', borderRadius: '18px', border: '1px solid var(--border)', padding: '20px', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: `${s.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                <Icon style={{ width: '18px', height: '18px', color: s.color }} />
              </div>
              <p style={{ fontFamily: 'Syne, sans-serif', fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 2px' }}>{s.value}</p>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>{s.label}</p>
            </div>
          )
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '20px' }}>
        {/* Recent payments */}
        <div style={{ background: 'var(--surface)', borderRadius: '20px', border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ fontFamily: 'Syne, sans-serif', fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Paiements récents</h3>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)' }}>
                {['Élève', 'Montant', 'Méthode', 'Date', 'Statut'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '12px 20px', fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recent.map((r, i) => (
                <tr key={i} style={{ borderTop: '1px solid var(--border)', transition: 'background 0.15s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                >
                  <td style={{ padding: '13px 20px', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{r.name}</td>
                  <td style={{ padding: '13px 20px', fontSize: '14px', color: '#4F46E5', fontWeight: 700 }}>{r.amount}</td>
                  <td style={{ padding: '13px 20px', fontSize: '13px', color: 'var(--text-secondary)' }}>{r.method}</td>
                  <td style={{ padding: '13px 20px', fontSize: '13px', color: 'var(--text-muted)' }}>{r.date}</td>
                  <td style={{ padding: '13px 20px' }}>
                    <span style={{ padding: '3px 9px', borderRadius: '999px', fontSize: '11px', fontWeight: 600, background: r.status === 'Payé' ? 'rgba(16,185,129,0.10)' : 'rgba(245,158,11,0.10)', color: r.status === 'Payé' ? '#10B981' : '#F59E0B' }}>{r.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Form */}
        <div style={{ background: 'var(--surface)', borderRadius: '20px', border: '1px solid var(--border)', padding: '22px', boxShadow: 'var(--shadow-sm)', height: 'fit-content' }}>
          <h3 style={{ fontFamily: 'Syne, sans-serif', fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 18px' }}>Nouveau paiement</h3>
          {saved && <div style={{ background: '#F0FDF4', color: '#16A34A', padding: '9px 12px', borderRadius: '10px', fontSize: '13px', border: '1px solid #DCFCE7', marginBottom: '14px' }}>Paiement enregistré !</div>}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div><label style={labelStyle}>Montant (DA)</label><input type="number" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} style={inputStyle} required placeholder="8 500" min="1" /></div>
            <div>
              <label style={labelStyle}>Méthode</label>
              <select value={formData.method} onChange={e => setFormData({...formData, method: e.target.value})} style={inputStyle}>
                <option value="Cash">Espèces</option>
                <option value="CCP">CCP / BaridiMob</option>
                <option value="Transfer">Virement</option>
              </select>
            </div>
            <button type="submit" disabled={loading} style={{ padding: '13px', background: 'linear-gradient(135deg, #4F46E5, #7C3AED)', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 700, fontSize: '14px', boxShadow: '0 4px 14px rgba(79,70,229,0.3)', cursor: 'pointer', marginTop: '4px', fontFamily: 'Syne, sans-serif' }}>
              {loading ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
