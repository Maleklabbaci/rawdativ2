import { createContext, useContext, useState, ReactNode } from 'react'

interface Toast {
  id: number
  message: string
  type: 'success' | 'error' | 'info'
}

interface ToastContextType {
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Date.now()
    const newToast = { id, message, type }
    
    setToasts(prev => [...prev, newToast])

    // Auto remove after 4 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 4000)
  }

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      
      {/* Toast Container */}
      <div className="fixed bottom-6 right-6 z-50 space-y-3">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`px-6 py-4 rounded-2xl shadow-xl text-white max-w-sm flex items-start gap-3 ${
              toast.type === 'success' ? 'bg-emerald-600' :
              toast.type === 'error' ? 'bg-red-600' : 'bg-gray-800'
            }`}
          >
            <div className="flex-1 text-sm font-medium">{toast.message}</div>
            <button 
              onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
              className="text-white/70 hover:text-white"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used within ToastProvider')
  return context
}