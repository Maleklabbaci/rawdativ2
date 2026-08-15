import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { GraduationCap, ArrowRight, ArrowLeft } from 'lucide-react'

export function Login() {
  const [isLogin, setIsLogin] = useState(true)
  const [step, setStep] = useState(1)
  const [establishmentName, setEstablishmentName] = useState('')
  const [city, setCity] = useState('')
  const [establishmentType, setEstablishmentType] = useState('Crèche')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const { signIn } = useAuth()

  const establishmentTypes = ['Crèche', 'École de langue', 'École de cours', 'École de formation']

  const resetForm = () => {
    setStep(1)
    setEstablishmentName(''); setCity(''); setEstablishmentType('Crèche')
    setFullName(''); setEmail(''); setPassword(''); setConfirmPassword(''); setPhone('')
    setError(''); setSuccess('')
  }

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault()
    if (!establishmentName || !city) { setError("Veuillez remplir le nom et la ville"); return }
    setError(''); setStep(2)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    if (password !== confirmPassword) { setError("Les mots de passe ne correspondent pas"); setLoading(false); return }
    try {
      const { data: authData, error: signUpError } = await supabase.auth.signUp({ email, password })
      if (signUpError) throw signUpError
      if (authData.user) {
        const { data: nurseryData, error: nurseryError } = await supabase
          .from('nurseries').insert({ name: establishmentName, owner_name: fullName, email, phone, city, type: establishmentType, status: 'Active', plan: 'Trial' })
          .select().single()
        if (nurseryError) {
          // Rollback : supprimer le compte Auth pour éviter un utilisateur orphelin sans établissement
          await supabase.auth.admin?.deleteUser?.(authData.user.id).catch(() => undefined)
          throw new Error("Impossible d'enregistrer l'établissement. Veuillez réessayer.")
        }
        await supabase.auth.updateUser({ data: { nursery_id: nurseryData.id } })
      }
      setSuccess("Inscription réussie !")
      setTimeout(() => { setIsLogin(true); resetForm() }, 2000)
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue')
    } finally { setLoading(false) }
  }

  const inputStyle = {
    width: '100%', padding: '12px 16px',
    borderRadius: '12px',
    border: '1.5px solid var(--border)',
    background: 'var(--surface-2)',
    color: 'var(--text-primary)',
    fontSize: '14px',
    transition: 'all 0.2s',
  }

  const labelStyle = {
    display: 'block', fontSize: '12px', fontWeight: 600,
    color: 'var(--text-secondary)', marginBottom: '6px',
    textTransform: 'uppercase' as const, letterSpacing: '0.05em',
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Decorative blobs */}
      <div style={{
        position: 'absolute', top: '-100px', right: '-100px',
        width: '500px', height: '500px',
        background: 'radial-gradient(circle, rgba(124,58,237,0.12) 0%, transparent 70%)',
        borderRadius: '50%', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '-150px', left: '-150px',
        width: '600px', height: '600px',
        background: 'radial-gradient(circle, rgba(79,70,229,0.10) 0%, transparent 70%)',
        borderRadius: '50%', pointerEvents: 'none',
      }} />

      {/* Left panel - branding */}
      <div style={{
        flex: 1, display: 'none',
        flexDirection: 'column', justifyContent: 'center',
        padding: '60px',
        background: 'linear-gradient(145deg, #4F46E5 0%, #7C3AED 100%)',
        position: 'relative', overflow: 'hidden',
      }} className="lg:flex">
        <div style={{
          position: 'absolute', top: '-80px', right: '-80px',
          width: '300px', height: '300px',
          background: 'rgba(255,255,255,0.06)',
          borderRadius: '50%',
        }} />
        <div style={{
          position: 'absolute', bottom: '40px', left: '-60px',
          width: '250px', height: '250px',
          background: 'rgba(255,255,255,0.04)',
          borderRadius: '50%',
        }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{
            width: '56px', height: '56px',
            background: 'rgba(255,255,255,0.2)',
            borderRadius: '16px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: '32px',
            backdropFilter: 'blur(10px)',
          }}>
            <GraduationCap style={{ color: 'white', width: '28px', height: '28px' }} />
          </div>

          <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: '42px', fontWeight: 800, color: 'white', margin: '0 0 16px', lineHeight: 1.1 }}>
            Rawdha+
          </h1>
          <p style={{ fontSize: '16px', color: 'rgba(255,255,255,0.75)', lineHeight: 1.6, maxWidth: '320px', margin: '0 0 48px' }}>
            La plateforme intelligente de gestion pour vos établissements éducatifs.
          </p>

          {/* Feature pills */}
          {['Gestion des élèves', 'Suivi des présences', 'Paiements & rapports'].map((f, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              marginBottom: '14px',
            }}>
              <div style={{
                width: '20px', height: '20px',
                background: 'rgba(255,255,255,0.25)',
                borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <div style={{ width: '6px', height: '6px', background: 'white', borderRadius: '50%' }} />
              </div>
              <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '14px' }}>{f}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel - form */}
      <div style={{
        width: '100%', maxWidth: '480px',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '40px 48px',
        background: 'var(--surface)',
        overflowY: 'auto',
      }} className="lg:max-w-md">

        {/* Mobile logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '40px' }} className="lg:hidden">
          <div style={{
            width: '40px', height: '40px',
            background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
            borderRadius: '12px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <GraduationCap style={{ color: 'white', width: '20px', height: '20px' }} />
          </div>
          <span style={{ fontFamily: 'Syne, sans-serif', fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)' }}>Rawdha+</span>
        </div>

        <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: '26px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px' }}>
          {isLogin ? 'Bon retour 👋' : step === 1 ? 'Votre établissement' : 'Votre compte'}
        </h2>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: '0 0 32px' }}>
          {isLogin ? 'Connectez-vous à votre espace' : step === 1 ? 'Étape 1 sur 2 — Informations de base' : 'Étape 2 sur 2 — Créez vos accès'}
        </p>

        {/* Toggle */}
        <div style={{
          display: 'flex', background: 'var(--surface-2)',
          borderRadius: '999px', padding: '4px',
          marginBottom: '28px', border: '1px solid var(--border)',
        }}>
          {['Connexion', 'Inscription'].map((label, i) => (
            <button key={i} onClick={() => { setIsLogin(i === 0); resetForm() }} style={{
              flex: 1, padding: '9px',
              borderRadius: '999px', border: 'none', fontSize: '13px', fontWeight: 600,
              background: (isLogin ? i === 0 : i === 1) ? 'var(--surface)' : 'transparent',
              color: (isLogin ? i === 0 : i === 1) ? '#4F46E5' : 'var(--text-secondary)',
              boxShadow: (isLogin ? i === 0 : i === 1) ? '0 2px 8px rgba(79,70,229,0.12)' : 'none',
              transition: 'all 0.2s',
            }}>{label}</button>
          ))}
        </div>

        {error && <div style={{ background: '#FEF2F2', color: '#EF4444', padding: '10px 14px', borderRadius: '10px', fontSize: '13px', marginBottom: '16px', border: '1px solid #FEE2E2' }}>{error}</div>}
        {success && <div style={{ background: '#F0FDF4', color: '#16A34A', padding: '10px 14px', borderRadius: '10px', fontSize: '13px', marginBottom: '16px', border: '1px solid #DCFCE7' }}>{success}</div>}

        {isLogin ? (
          <form onSubmit={async (e) => {
            e.preventDefault(); setLoading(true)
            setError('')
            try { await signIn(email, password) }
            catch (err: any) { setError(err.message || 'Échec de la connexion') }
            finally { setLoading(false) }
          }} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div><label style={labelStyle}>Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} required /></div>
            <div><label style={labelStyle}>Mot de passe</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} style={inputStyle} required /></div>
            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '14px',
              background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
              color: 'white', border: 'none', borderRadius: '14px',
              fontWeight: 700, fontSize: '15px', marginTop: '8px',
              boxShadow: '0 4px 14px rgba(79,70,229,0.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              fontFamily: 'Syne, sans-serif',
            }}>
              {loading ? 'Connexion...' : <><span>Se connecter</span><ArrowRight style={{ width: '16px', height: '16px' }} /></>}
            </button>
          </form>
        ) : (
          <form onSubmit={step === 1 ? handleNextStep : handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {step === 1 ? (
              <>
                <div><label style={labelStyle}>Nom de l'établissement</label><input type="text" value={establishmentName} onChange={e => setEstablishmentName(e.target.value)} style={inputStyle} required /></div>
                <div><label style={labelStyle}>Ville</label><input type="text" value={city} onChange={e => setCity(e.target.value)} style={inputStyle} required /></div>
                <div>
                  <label style={labelStyle}>Type d'établissement</label>
                  <select value={establishmentType} onChange={e => setEstablishmentType(e.target.value)} style={inputStyle}>
                    {establishmentTypes.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <button type="submit" style={{
                  width: '100%', padding: '14px',
                  background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
                  color: 'white', border: 'none', borderRadius: '14px',
                  fontWeight: 700, fontSize: '15px', marginTop: '8px',
                  boxShadow: '0 4px 14px rgba(79,70,229,0.35)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  fontFamily: 'Syne, sans-serif',
                }}>
                  Continuer <ArrowRight style={{ width: '16px', height: '16px' }} />
                </button>
              </>
            ) : (
              <>
                <div><label style={labelStyle}>Nom complet</label><input type="text" value={fullName} onChange={e => setFullName(e.target.value)} style={inputStyle} required /></div>
                <div><label style={labelStyle}>Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} required /></div>
                <div><label style={labelStyle}>Téléphone</label><input type="tel" value={phone} onChange={e => setPhone(e.target.value)} style={inputStyle} /></div>
                <div><label style={labelStyle}>Mot de passe</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} style={inputStyle} required /></div>
                <div><label style={labelStyle}>Confirmer le mot de passe</label><input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} style={inputStyle} required /></div>
                <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                  <button type="button" onClick={() => setStep(1)} style={{
                    flex: 1, padding: '14px', borderRadius: '14px',
                    border: '1.5px solid var(--border)', background: 'transparent',
                    color: 'var(--text-secondary)', fontWeight: 600, fontSize: '14px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  }}>
                    <ArrowLeft style={{ width: '16px', height: '16px' }} /> Retour
                  </button>
                  <button type="submit" disabled={loading} style={{
                    flex: 1, padding: '14px',
                    background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
                    color: 'white', border: 'none', borderRadius: '14px',
                    fontWeight: 700, fontSize: '14px',
                    boxShadow: '0 4px 14px rgba(79,70,229,0.35)',
                    fontFamily: 'Syne, sans-serif',
                  }}>
                    {loading ? 'Création...' : 'Créer mon compte'}
                  </button>
                </div>
              </>
            )}
          </form>
        )}
      </div>
    </div>
  )
}
