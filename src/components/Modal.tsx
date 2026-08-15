import { X } from 'lucide-react'
import { ReactNode } from 'react'

interface ModalProps { isOpen: boolean; onClose: () => void; title: string; children: ReactNode }

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  if (!isOpen) return null
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)', padding: '16px', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: 'var(--surface)', borderRadius: '22px', width: '100%', maxWidth: '480px', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)', animation: 'modalPop 0.25s cubic-bezier(0.34,1.56,0.64,1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ fontFamily: 'Syne, sans-serif', fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{title}</h3>
          <button onClick={onClose} style={{ width: '32px', height: '32px', borderRadius: '10px', border: 'none', background: 'var(--surface-2)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X style={{ width: '16px', height: '16px' }} />
          </button>
        </div>
        <div style={{ padding: '22px 24px' }}>{children}</div>
      </div>
    </div>
  )
}
