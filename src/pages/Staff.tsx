import { useEstablishment } from '../context/EstablishmentContext'
import { Plus, Phone, Mail } from 'lucide-react'

export function Staff() {
  const { establishment } = useEstablishment()
  const type = establishment?.type || 'Crèche'
  const getTitle = (t: string) => t === 'Crèche' ? 'Personnel' : 'Formateurs & Enseignants'

  const mockStaff = [
    { name: 'Fatima Zahra Boukhalfa', role: 'Directrice pédagogique', phone: '0550 123 456', email: 'f.boukhalfa@rawdha.dz', status: 'Active' },
    { name: 'Karim Hadj Mansour', role: 'Éducateur', phone: '0660 789 012', email: 'k.mansour@rawdha.dz', status: 'Active' },
    { name: 'Nadia Bensalem', role: 'Assistante', phone: '0770 345 678', email: 'n.bensalem@rawdha.dz', status: 'Active' },
    { name: 'Rami Ouali', role: 'Animateur', phone: '0550 901 234', email: 'r.ouali@rawdha.dz', status: 'Inactive' },
  ]

  return (
    <div style={{ padding: '28px', maxWidth: '1400px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{getTitle(type)}</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: '4px 0 0' }}>{mockStaff.length} membres</p>
        </div>
        <button style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'linear-gradient(135deg, #4F46E5, #7C3AED)', color: 'white', border: 'none', borderRadius: '14px', padding: '11px 20px', fontWeight: 700, fontSize: '14px', boxShadow: '0 4px 14px rgba(79,70,229,0.35)', cursor: 'pointer', fontFamily: 'Syne, sans-serif' }}>
          <Plus style={{ width: '16px', height: '16px' }} /> Ajouter un membre
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
        {mockStaff.map((member, i) => (
          <div key={i} style={{ background: 'var(--surface)', borderRadius: '20px', border: '1px solid var(--border)', padding: '22px', boxShadow: 'var(--shadow-sm)', transition: 'all 0.25s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)'; (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-md)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-sm)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ width: '46px', height: '46px', borderRadius: '14px', background: `hsl(${i * 60 + 240}, 60%, 92%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 700, color: `hsl(${i * 60 + 240}, 50%, 35%)`, flexShrink: 0 }}>
                {member.name.split(' ').map(n => n[0]).slice(0,2).join('')}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{member.name}</p>
                <p style={{ fontSize: '12px', color: '#4F46E5', margin: '2px 0 0', fontWeight: 500 }}>{member.role}</p>
              </div>
              <span style={{ padding: '3px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 600, background: member.status === 'Active' ? 'rgba(16,185,129,0.10)' : 'rgba(107,114,128,0.10)', color: member.status === 'Active' ? '#10B981' : '#6B7280', flexShrink: 0 }}>
                {member.status === 'Active' ? 'Actif' : 'Inactif'}
              </span>
            </div>
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Phone style={{ width: '13px', height: '13px', color: 'var(--text-muted)', flexShrink: 0 }} />
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{member.phone}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Mail style={{ width: '13px', height: '13px', color: 'var(--text-muted)', flexShrink: 0 }} />
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.email}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
