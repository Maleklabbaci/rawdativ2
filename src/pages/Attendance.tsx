import { useState } from 'react'
import { Check, X } from 'lucide-react'
import { useEstablishment } from '../context/EstablishmentContext'

export function Attendance() {
  const { establishment } = useEstablishment()
  const type = establishment?.type || 'Crèche'
  const getTitle = (t: string) => t === 'Crèche' ? 'Présence des Enfants' : 'Suivi des Présences'

  const today = new Date().toLocaleDateString('fr-DZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const mockStudents = ['Amira Benali', 'Yacine Boudjema', 'Sarah Meziane', 'Omar Khalil', 'Lina Hamdi', 'Rami Ouali', 'Nadia Bensalem', 'Karim Hadj']
  const [attendance, setAttendance] = useState<Record<string, boolean | null>>(Object.fromEntries(mockStudents.map(s => [s, null])))

  const toggle = (name: string, val: boolean) => setAttendance(prev => ({ ...prev, [name]: prev[name] === val ? null : val }))

  const present = Object.values(attendance).filter(v => v === true).length
  const absent = Object.values(attendance).filter(v => v === false).length

  return (
    <div style={{ padding: '28px', maxWidth: '900px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{getTitle(type)}</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: '4px 0 0', textTransform: 'capitalize' }}>{today}</p>
      </div>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '24px' }}>
        {[
          { label: 'Total', value: mockStudents.length, color: '#4F46E5', bg: 'rgba(79,70,229,0.08)' },
          { label: 'Présents', value: present, color: '#10B981', bg: 'rgba(16,185,129,0.08)' },
          { label: 'Absents', value: absent, color: '#F59E0B', bg: 'rgba(245,158,11,0.08)' },
        ].map((s, i) => (
          <div key={i} style={{ background: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--border)', padding: '18px', textAlign: 'center' }}>
            <div style={{ fontSize: '28px', fontWeight: 800, color: s.color, fontFamily: 'Syne, sans-serif' }}>{s.value}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600, marginTop: '2px' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Attendance list */}
      <div style={{ background: 'var(--surface)', borderRadius: '20px', border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
        {mockStudents.map((name, i) => (
          <div key={name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: i < mockStudents.length - 1 ? '1px solid var(--border)' : 'none', transition: 'background 0.15s' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: `hsl(${i * 37 + 200}, 60%, 92%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: `hsl(${i * 37 + 200}, 50%, 35%)` }}>
                {name.split(' ').map(n => n[0]).join('')}
              </div>
              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{name}</span>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => toggle(name, true)} style={{ width: '38px', height: '38px', borderRadius: '10px', border: '1.5px solid', borderColor: attendance[name] === true ? '#10B981' : 'var(--border)', background: attendance[name] === true ? 'rgba(16,185,129,0.12)' : 'transparent', color: attendance[name] === true ? '#10B981' : 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
                <Check style={{ width: '16px', height: '16px' }} />
              </button>
              <button onClick={() => toggle(name, false)} style={{ width: '38px', height: '38px', borderRadius: '10px', border: '1.5px solid', borderColor: attendance[name] === false ? '#F59E0B' : 'var(--border)', background: attendance[name] === false ? 'rgba(245,158,11,0.12)' : 'transparent', color: attendance[name] === false ? '#F59E0B' : 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
                <X style={{ width: '16px', height: '16px' }} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <button style={{ marginTop: '20px', width: '100%', padding: '14px', background: 'linear-gradient(135deg, #4F46E5, #7C3AED)', color: 'white', border: 'none', borderRadius: '14px', fontWeight: 700, fontSize: '15px', boxShadow: '0 4px 14px rgba(79,70,229,0.35)', cursor: 'pointer', fontFamily: 'Syne, sans-serif' }}>
        Enregistrer la présence
      </button>
    </div>
  )
}
