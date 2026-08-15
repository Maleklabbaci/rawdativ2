import { useState } from 'react'
import { LayoutDashboard, Users, UserCheck, Calendar, CreditCard, BarChart3, LogOut, Moon, Sun, Menu, X, GraduationCap } from 'lucide-react'
import { useLanguage } from '../context/LanguageContext'
import { useEstablishment } from '../context/EstablishmentContext'

interface SidebarProps {
  currentPage: string
  setCurrentPage: (page: any) => void
  darkMode: boolean
  toggleDarkMode: () => void
  onLogout: () => void
}

export function Sidebar({ currentPage, setCurrentPage, darkMode, toggleDarkMode, onLogout }: SidebarProps) {
  useLanguage()
  const { establishment } = useEstablishment()
  const [isOpen, setIsOpen] = useState(false)

  const type = establishment?.type || 'Crèche'

  const getMenuLabels = (type: string) => {
    if (type === 'École de langue' || type === 'École de cours') {
      return { students: 'Étudiants', staff: 'Formateurs', attendance: 'Présence' }
    } else if (type === 'École de formation') {
      return { students: 'Apprenants', staff: 'Formateurs', attendance: 'Présence' }
    } else {
      return { students: 'Enfants', staff: 'Personnel', attendance: 'Présence' }
    }
  }

  const menuLabels = getMenuLabels(type)

  const menuItems = [
    { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
    { id: 'children', label: menuLabels.students, icon: Users },
    { id: 'staff', label: menuLabels.staff, icon: UserCheck },
    { id: 'attendance', label: menuLabels.attendance, icon: Calendar },
    { id: 'payments', label: 'Paiements', icon: CreditCard },
    { id: 'reports', label: 'Rapports', icon: BarChart3 },
  ]

  const handleNavigation = (id: string) => {
    setCurrentPage(id)
    setIsOpen(false)
  }

  const SidebarContent = () => (
    <div style={{
      width: '76px',
      background: 'var(--surface)',
      borderRight: '1px solid var(--border)',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '20px 0',
      gap: '4px',
      position: 'sticky',
      top: 0,
    }}>
      {/* Logo */}
      <div style={{
        width: '44px', height: '44px',
        background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
        borderRadius: '14px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: '24px',
        boxShadow: '0 4px 14px rgba(79,70,229,0.35)',
        flexShrink: 0,
      }}>
        <GraduationCap style={{ color: 'white', width: '22px', height: '22px' }} />
      </div>

      {/* Menu Items */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px', width: '100%', padding: '0 10px' }}>
        {menuItems.map((item) => {
          const Icon = item.icon
          const isActive = currentPage === item.id
          return (
            <button
              key={item.id}
              onClick={() => handleNavigation(item.id)}
              title={item.label}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '14px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: 'none',
                background: isActive
                  ? 'linear-gradient(135deg, rgba(79,70,229,0.15) 0%, rgba(124,58,237,0.15) 100%)'
                  : 'transparent',
                color: isActive ? '#4F46E5' : 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                position: 'relative',
              }}
              onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)' }}
              onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              {isActive && (
                <div style={{
                  position: 'absolute', left: '-10px', top: '50%', transform: 'translateY(-50%)',
                  width: '3px', height: '20px',
                  background: 'linear-gradient(180deg, #4F46E5, #7C3AED)',
                  borderRadius: '999px',
                }} />
              )}
              <Icon style={{ width: '20px', height: '20px' }} />
            </button>
          )
        })}
      </div>

      {/* Bottom */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%', padding: '0 10px' }}>
        <button onClick={toggleDarkMode} title={darkMode ? 'Mode clair' : 'Mode sombre'} style={{
          width: '100%', padding: '12px', borderRadius: '14px',
          border: 'none', background: 'transparent',
          color: 'var(--text-secondary)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.2s ease',
        }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
        >
          {darkMode ? <Sun style={{ width: '18px', height: '18px' }} /> : <Moon style={{ width: '18px', height: '18px' }} />}
        </button>

        <button onClick={onLogout} title="Déconnexion" style={{
          width: '100%', padding: '12px', borderRadius: '14px',
          border: 'none', background: 'transparent',
          color: '#EF4444', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.2s ease',
        }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.08)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
        >
          <LogOut style={{ width: '18px', height: '18px' }} />
        </button>
      </div>
    </div>
  )

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden"
        style={{
          position: 'fixed', top: '16px', left: '16px', zIndex: 50,
          padding: '10px', background: 'var(--surface)',
          borderRadius: '12px', boxShadow: 'var(--shadow-md)',
          border: '1px solid var(--border)', color: 'var(--text-primary)',
        }}
      >
        {isOpen ? <X style={{ width: '20px', height: '20px' }} /> : <Menu style={{ width: '20px', height: '20px' }} />}
      </button>

      {isOpen && (
        <div onClick={() => setIsOpen(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 40,
        }} className="lg:hidden" />
      )}

      <div className={`hidden lg:flex`}>
        <SidebarContent />
      </div>

      <div className={`lg:hidden fixed z-50 transition-transform duration-300 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <SidebarContent />
      </div>
    </>
  )
}
