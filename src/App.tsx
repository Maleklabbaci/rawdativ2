import { useState, useEffect } from 'react'
import { useLanguage } from './context/LanguageContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import { LanguageProvider } from './context/LanguageContext'
import { EstablishmentProvider } from './context/EstablishmentContext'
import { ToastProvider } from './context/ToastContext'
import { Login } from './pages/Login'
import { Sidebar } from './components/Sidebar'
import { Header } from './components/Header'
import { Dashboard } from './pages/Dashboard'
import { Children } from './pages/Children'
import { Staff } from './pages/Staff'
import { Attendance } from './pages/Attendance'
import { Payments } from './pages/Payments'
import { Reports } from './pages/Reports'

function AppContent() {
  const [currentPage, setCurrentPage] = useState<'dashboard' | 'children' | 'staff' | 'attendance' | 'payments' | 'reports'>('dashboard')
  const [darkMode, setDarkMode] = useState(() => window.localStorage.getItem('rawdha-dark') === '1')
  const { user, loading, signOut } = useAuth()
  const { language } = useLanguage()

  const toggleDarkMode = () => {
    setDarkMode(prev => {
      const next = !prev
      window.localStorage.setItem('rawdha-dark', next ? '1' : '0')
      document.documentElement.classList.toggle('dark', next)
      return next
    })
  }

  useEffect(() => {
    // Appliquer la direction RTL/LTR et la locale du document selon la langue
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr'
    document.documentElement.lang = language
  }, [language])

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Chargement...</div>
  }

  if (!user) {
    return <Login />
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard': return <Dashboard />
      case 'children': return <Children />
      case 'staff': return <Staff />
      case 'attendance': return <Attendance />
      case 'payments': return <Payments />
      case 'reports': return <Reports />
      default: return <Dashboard />
    }
  }

  return (
    <div className={`min-h-screen ${darkMode ? 'dark bg-gray-950 text-white' : 'bg-gray-50 text-gray-900'}`} dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="flex">
        <Sidebar 
          currentPage={currentPage} 
          setCurrentPage={setCurrentPage} 
          darkMode={darkMode}
          toggleDarkMode={toggleDarkMode}
          onLogout={signOut}
        />
        
        <div className="flex-1 flex flex-col">
          <Header />
          
          <main className="flex-1 p-6 lg:p-8">
            <div className="max-w-7xl mx-auto">
              {renderPage()}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <EstablishmentProvider>
          <ToastProvider>
            <AppContent />
          </ToastProvider>
        </EstablishmentProvider>
      </LanguageProvider>
    </AuthProvider>
  )
}

export default App