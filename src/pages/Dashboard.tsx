import { Users, Calendar, UserCheck, TrendingUp, ArrowUp, ArrowRight, Clock } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { useEstablishment } from '../context/EstablishmentContext'

export function Dashboard() {
  const { establishment } = useEstablishment()
  const type = establishment?.type || 'Crèche'
  const name = establishment?.name || 'Mon Établissement'

  const getLabels = (type: string) => {
    switch (type) {
      case 'École de langue': return { students: 'Étudiants inscrits', present: "Présents aujourd'hui", staff: 'Formateurs', welcome: 'Tableau de bord' }
      case 'École de cours': return { students: 'Élèves inscrits', present: "Présents aujourd'hui", staff: 'Professeurs', welcome: 'Tableau de bord' }
      case 'École de formation': return { students: 'Apprenants inscrits', present: "Présents aujourd'hui", staff: 'Formateurs', welcome: 'Tableau de bord' }
      default: return { students: 'Enfants inscrits', present: "Présents aujourd'hui", staff: 'Personnel', welcome: 'Tableau de bord' }
    }
  }
  const labels = getLabels(type)

  const stats = [
    { label: labels.students, value: '87', change: '+5', icon: Users, color: '#4F46E5', bg: 'rgba(79,70,229,0.10)' },
    { label: labels.present, value: '72', change: '83%', icon: Calendar, color: '#7C3AED', bg: 'rgba(124,58,237,0.10)' },
    { label: labels.staff, value: '14', change: '+1', icon: UserCheck, color: '#6366F1', bg: 'rgba(99,102,241,0.10)' },
    { label: "Taux d'occupation", value: '92%', change: '+4%', icon: TrendingUp, color: '#818CF8', bg: 'rgba(129,140,248,0.10)' },
  ]

  const chartData = [
    { day: 'Lun', present: 78, absent: 9 },
    { day: 'Mar', present: 82, absent: 5 },
    { day: 'Mer', present: 75, absent: 12 },
    { day: 'Jeu', present: 80, absent: 7 },
    { day: 'Ven', present: 85, absent: 2 },
  ]

  const recentActivity = [
    { name: 'Amira Benali', action: 'Présence confirmée', time: 'Il y a 5 min', type: 'presence' },
    { name: 'Yacine Boudjema', action: 'Paiement reçu — 8 500 DA', time: 'Il y a 22 min', type: 'payment' },
    { name: 'Sarah Meziane', action: 'Nouveau dossier créé', time: 'Il y a 1h', type: 'new' },
    { name: 'Omar Khalil', action: 'Absence notifiée', time: 'Il y a 2h', type: 'absence' },
  ]

  const activityColor = (type: string) => {
    switch (type) {
      case 'presence': return '#10B981'
      case 'payment': return '#4F46E5'
      case 'new': return '#7C3AED'
      case 'absence': return '#F59E0B'
      default: return '#6B7280'
    }
  }

  return (
    <div style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1400px' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            {labels.welcome}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: '4px 0 0' }}>
            {name} · {new Date().toLocaleDateString('fr-DZ', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          background: 'rgba(79,70,229,0.08)', padding: '8px 14px',
          borderRadius: '999px', border: '1px solid rgba(79,70,229,0.15)',
        }}>
          <div style={{ width: '8px', height: '8px', background: '#10B981', borderRadius: '50%' }} />
          <span style={{ fontSize: '13px', color: '#4F46E5', fontWeight: 600 }}>En ligne</span>
        </div>
      </div>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        {stats.map((stat, i) => {
          const Icon = stat.icon
          return (
            <div key={i} style={{
              background: 'var(--surface)', borderRadius: '20px',
              border: '1px solid var(--border)', padding: '22px',
              boxShadow: 'var(--shadow-sm)', transition: 'all 0.25s ease',
              cursor: 'default',
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)'; (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-md)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-sm)' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: stat.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon style={{ width: '20px', height: '20px', color: stat.color }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(16,185,129,0.10)', padding: '4px 8px', borderRadius: '999px' }}>
                  <ArrowUp style={{ width: '10px', height: '10px', color: '#10B981' }} />
                  <span style={{ fontSize: '11px', color: '#10B981', fontWeight: 700 }}>{stat.change}</span>
                </div>
              </div>
              <p style={{ fontSize: '30px', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px', fontFamily: 'Syne, sans-serif' }}>{stat.value}</p>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>{stat.label}</p>
            </div>
          )
        })}
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '16px' }} className="charts-row">
        {/* Bar Chart */}
        <div style={{ background: 'var(--surface)', borderRadius: '20px', border: '1px solid var(--border)', padding: '24px', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h3 style={{ fontFamily: 'Syne, sans-serif', fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Présence cette semaine</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '2px 0 0' }}>Présents vs Absents</p>
            </div>
            <div style={{ display: 'flex', gap: '16px' }}>
              {[{ color: '#4F46E5', label: 'Présents' }, { color: '#EDE9FE', label: 'Absents' }].map((l, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: l.color }} />
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{l.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ height: '220px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barGap={4}>
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} />
                <Tooltip
                  contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', boxShadow: 'var(--shadow-md)', fontSize: '13px' }}
                  cursor={{ fill: 'var(--surface-2)' }}
                />
                <Bar dataKey="present" fill="#4F46E5" radius={[8, 8, 0, 0]} />
                <Bar dataKey="absent" fill="#EDE9FE" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Activity Feed */}
        <div style={{ background: 'var(--surface)', borderRadius: '20px', border: '1px solid var(--border)', padding: '24px', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ fontFamily: 'Syne, sans-serif', fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Activité récente</h3>
            <button style={{ fontSize: '12px', color: '#4F46E5', background: 'none', border: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
              Tout voir <ArrowRight style={{ width: '12px', height: '12px' }} />
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {recentActivity.map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '10px',
                  background: `rgba(${item.type === 'presence' ? '16,185,129' : item.type === 'payment' ? '79,70,229' : item.type === 'new' ? '124,58,237' : '245,158,11'}, 0.10)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: activityColor(item.type) }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</p>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>{item.action}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                  <Clock style={{ width: '10px', height: '10px', color: 'var(--text-muted)' }} />
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{item.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
