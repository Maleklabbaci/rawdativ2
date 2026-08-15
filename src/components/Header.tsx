import { useEstablishment } from '../context/EstablishmentContext'
import { useAuth } from '../context/AuthContext'
import { Bell, Search } from 'lucide-react'

export function Header() {
  const { establishment } = useEstablishment()
  const { user } = useAuth()

  const initials = user?.email?.[0]?.toUpperCase() || 'A'

  return (
    <div style={{
      background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
      padding: '14px 28px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '16px',
      position: 'sticky',
      top: 0,
      zIndex: 10,
    }}>
      {/* Search bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        background: 'var(--surface-2)',
        borderRadius: '999px',
        padding: '8px 16px',
        flex: 1, maxWidth: '360px',
        border: '1px solid var(--border)',
      }}>
        <Search style={{ width: '15px', height: '15px', color: 'var(--text-muted)', flexShrink: 0 }} />
        <input
          type="text"
          placeholder="Rechercher..."
          style={{
            border: 'none', background: 'transparent',
            color: 'var(--text-primary)', fontSize: '13px',
            outline: 'none', width: '100%',
          }}
        />
      </div>

      {/* Right side */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Establishment info */}
        <div style={{ textAlign: 'right', display: 'none' }} className="sm:block" >
          <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', margin: 0, fontFamily: 'Syne, sans-serif' }}>
            {establishment?.name || 'Mon Établissement'}
          </p>
          <p style={{ fontSize: '11px', color: '#4F46E5', margin: 0 }}>
            {establishment?.type || 'Établissement'} · {establishment?.plan || 'Trial'}
          </p>
        </div>

        {/* Notification */}
        <button style={{
          width: '38px', height: '38px',
          borderRadius: '12px',
          border: '1px solid var(--border)',
          background: 'var(--surface)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-secondary)',
          position: 'relative',
        }}>
          <Bell style={{ width: '16px', height: '16px' }} />
          <div style={{
            position: 'absolute', top: '8px', right: '8px',
            width: '7px', height: '7px',
            background: '#EF4444',
            borderRadius: '50%',
            border: '1.5px solid var(--surface)',
          }} />
        </button>

        {/* Avatar */}
        <div style={{
          width: '38px', height: '38px',
          background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
          borderRadius: '12px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white', fontWeight: 700, fontSize: '14px',
          fontFamily: 'Syne, sans-serif',
          boxShadow: '0 2px 10px rgba(79,70,229,0.3)',
          cursor: 'pointer',
          flexShrink: 0,
        }}>
          {initials}
        </div>
      </div>
    </div>
  )
}
