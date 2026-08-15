import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

interface Establishment {
  id: string
  name: string
  type: string
  plan: string
  city?: string
}

interface EstablishmentContextType {
  establishment: Establishment | null
  nurseryId: string | null
  loading: boolean
}

const EstablishmentContext = createContext<EstablishmentContextType | undefined>(undefined)

export function EstablishmentProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [establishment, setEstablishment] = useState<Establishment | null>(null)
  const [nurseryId, setNurseryId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchEstablishment = async () => {
      if (!user) {
        setEstablishment(null)
        setNurseryId(null)
        setLoading(false)
        return
      }

      // Get nursery_id from user metadata
      const userNurseryId = user.user_metadata?.nursery_id

      if (userNurseryId) {
        setNurseryId(userNurseryId)

        // Fetch establishment data
        const { data, error } = await supabase
          .from('nurseries')
          .select('id, name, type, plan, city')
          .eq('id', userNurseryId)
          .single()

        if (!error && data) {
          setEstablishment(data)
        }
      } else {
        // Fallback: try to find by email (for old users)
        const { data, error } = await supabase
          .from('nurseries')
          .select('id, name, type, plan, city')
          .eq('email', user.email)
          .single()

        if (!error && data) {
          setEstablishment(data)
          setNurseryId(data.id)
        }
      }
      
      setLoading(false)
    }

    fetchEstablishment()
  }, [user])

  return (
    <EstablishmentContext.Provider value={{ establishment, nurseryId, loading }}>
      {children}
    </EstablishmentContext.Provider>
  )
}

export const useEstablishment = () => {
  const context = useContext(EstablishmentContext)
  if (!context) throw new Error('useEstablishment must be used within EstablishmentProvider')
  return context
}