import { useState, useEffect } from 'react'
import { Plus, Search, Users } from 'lucide-react'
import { Modal } from '../components/Modal'
import { supabase } from '../lib/supabase'
import { useEstablishment } from '../context/EstablishmentContext'

interface Child {
  id: string; first_name: string; last_name: string
  group_name: string; parent_name: string; parent_phone: string; status: 'Active' | 'Inactive'
}

const inputStyle = { width: '100%', padding: '11px 14px', borderRadius: '12px', border: '1.5px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text-primary)', fontSize: '14px' }
const labelStyle = { display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }

export function Children() {
  const { establishment, nurseryId } = useEstablishment()
  const type = establishment?.type || 'Crèche'
  const [searchTerm, setSearchTerm] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [children, setChildren] = useState<Child[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({ first_name: '', last_name: '', group_name: 'Groupe A', parent_name: '', parent_phone: '' })

  const getLabels = (type: string) => {
    if (type === 'École de langue' || type === 'École de cours') return { title: 'Étudiants', addButton: 'Ajouter un étudiant', parentLabel: 'Contact / Parent', groupLabel: 'Niveau / Groupe', countLabel: 'étudiants inscrits' }
    if (type === 'École de formation') return { title: 'Apprenants', addButton: 'Ajouter un apprenant', parentLabel: 'Entreprise / Contact', groupLabel: 'Module / Groupe', countLabel: 'apprenants inscrits' }
    return { title: 'Enfants', addButton: 'Ajouter un enfant', parentLabel: 'Nom du parent', groupLabel: 'Groupe', countLabel: 'enfants inscrits' }
  }
  const labels = getLabels(type)

  const fetchChildren = async () => {
    if (!nurseryId) { setLoading(false); setError(null); return }
    setLoading(true)
    setError(null)
    const { data, error } = await supabase.from('children').select('*').eq('nursery_id', nurseryId).order('created_at', { ascending: false })
    if (!error) {
      setChildren(data || [])
    } else {
      setError("Impossible de charger la liste. Vérifiez la connexion et réessayez.")
    }
    setLoading(false)
  }

  useEffect(() => { fetchChildren() }, [nurseryId])

  const filteredChildren = children.filter(c => `${c.first_name} ${c.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nurseryId) return
    const { error: insertError } = await supabase.from('children').insert([{ ...formData, nursery_id: nurseryId, status: 'Active' }])
    if (!insertError) {
      setIsModalOpen(false); fetchChildren()
      setFormData({ first_name: '', last_name: '', group_name: 'Groupe A', parent_name: '', parent_phone: '' })
    } else {
      setError("Impossible d'enregistrer l'enfant. Veuillez réessayer.")
    }
  }

  return (
    <div style={{ padding: '28px', maxWidth: '1400px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{labels.title}</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: '4px 0 0' }}>{children.length} {labels.countLabel}</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
          color: 'white', border: 'none', borderRadius: '14px',
          padding: '11px 20px', fontWeight: 700, fontSize: '14px',
          boxShadow: '0 4px 14px rgba(79,70,229,0.35)', cursor: 'pointer',
          fontFamily: 'Syne, sans-serif',
        }}>
          <Plus style={{ width: '16px', height: '16px' }} /> {labels.addButton}
        </button>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', maxWidth: '360px', marginBottom: '20px' }}>
        <Search style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', width: '15px', height: '15px', color: 'var(--text-muted)' }} />
        <input type="text" placeholder="Rechercher..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ ...inputStyle, paddingLeft: '40px' }} />
      </div>

      {/* Table */}
      <div style={{ background: 'var(--surface)', borderRadius: '20px', border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
              {['Nom', labels.groupLabel, labels.parentLabel, 'Téléphone', 'Statut'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '14px 20px', fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: '48px', color: 'var(--text-secondary)' }}>Chargement...</td></tr>
            ) : error ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: '48px' }}>
                <p style={{ color: '#EF4444', fontSize: '14px', marginBottom: '12px' }}>{error}</p>
                <button onClick={fetchChildren} style={{ padding: '9px 18px', borderRadius: '12px', border: '1.5px solid var(--border)', background: 'transparent', color: '#4F46E5', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>Réessayer</button>
              </td></tr>
            ) : filteredChildren.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '60px 20px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '52px', height: '52px', borderRadius: '16px', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Users style={{ width: '24px', height: '24px', color: 'var(--text-muted)' }} />
                    </div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: 0 }}>Aucun résultat trouvé</p>
                  </div>
                </td>
              </tr>
            ) : filteredChildren.map((child, i) => (
              <tr key={child.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.15s' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
              >
                <td style={{ padding: '14px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '34px', height: '34px', borderRadius: '10px', flexShrink: 0,
                      background: `hsl(${(i * 47) % 360}, 65%, 92%)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '12px', fontWeight: 700, color: `hsl(${(i * 47) % 360}, 55%, 35%)`,
                    }}>
                      {child.first_name[0]}{child.last_name[0]}
                    </div>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{child.first_name} {child.last_name}</span>
                  </div>
                </td>
                <td style={{ padding: '14px 20px' }}>
                  <span style={{ padding: '4px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 600, background: 'rgba(79,70,229,0.10)', color: '#4F46E5' }}>{child.group_name}</span>
                </td>
                <td style={{ padding: '14px 20px', fontSize: '13px', color: 'var(--text-secondary)' }}>{child.parent_name}</td>
                <td style={{ padding: '14px 20px', fontSize: '13px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{child.parent_phone}</td>
                <td style={{ padding: '14px 20px' }}>
                  <span style={{ padding: '4px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 600, background: child.status === 'Active' ? 'rgba(16,185,129,0.10)' : 'rgba(107,114,128,0.10)', color: child.status === 'Active' ? '#10B981' : '#6B7280' }}>
                    {child.status === 'Active' ? 'Actif' : 'Inactif'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={labels.addButton}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div><label style={labelStyle}>Prénom</label><input type="text" value={formData.first_name} onChange={e => setFormData({...formData, first_name: e.target.value})} style={inputStyle} required /></div>
            <div><label style={labelStyle}>Nom</label><input type="text" value={formData.last_name} onChange={e => setFormData({...formData, last_name: e.target.value})} style={inputStyle} required /></div>
          </div>
          <div><label style={labelStyle}>{labels.groupLabel}</label><input type="text" value={formData.group_name} onChange={e => setFormData({...formData, group_name: e.target.value})} style={inputStyle} required /></div>
          <div><label style={labelStyle}>{labels.parentLabel}</label><input type="text" value={formData.parent_name} onChange={e => setFormData({...formData, parent_name: e.target.value})} style={inputStyle} required /></div>
          <div><label style={labelStyle}>Téléphone</label><input type="tel" value={formData.parent_phone} onChange={e => setFormData({...formData, parent_phone: e.target.value})} style={inputStyle} required /></div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
            <button type="button" onClick={() => setIsModalOpen(false)} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '14px' }}>Annuler</button>
            <button type="submit" style={{ flex: 1, padding: '12px', borderRadius: '12px', background: 'linear-gradient(135deg, #4F46E5, #7C3AED)', color: 'white', border: 'none', fontWeight: 700, fontSize: '14px', boxShadow: '0 4px 14px rgba(79,70,229,0.3)' }}>Ajouter</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
