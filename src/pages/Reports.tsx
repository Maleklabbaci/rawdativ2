import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { Download } from 'lucide-react'

export function Reports() {
  const attendanceData = [
    { name: 'Lun', present: 78, absent: 9 },
    { name: 'Mar', present: 82, absent: 5 },
    { name: 'Mer', present: 75, absent: 12 },
    { name: 'Jeu', present: 80, absent: 7 },
    { name: 'Ven', present: 85, absent: 2 },
  ]
  const groupData = [
    { name: 'Petits', value: 32, color: '#4F46E5' },
    { name: 'Moyens', value: 28, color: '#7C3AED' },
    { name: 'Grands', value: 27, color: '#818CF8' },
  ]
  const revenueData = [
    { name: 'Jan', revenue: 180000 }, { name: 'Fév', revenue: 210000 },
    { name: 'Mar', revenue: 195000 }, { name: 'Avr', revenue: 230000 },
    { name: 'Mai', revenue: 255000 },
  ]

  const chartTooltipStyle = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', boxShadow: 'var(--shadow-md)', fontSize: '13px' }

  return (
    <div style={{ padding: '28px', maxWidth: '1400px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Rapports</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: '4px 0 0' }}>Statistiques et analyses</p>
        </div>
        <button style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--surface)', color: '#4F46E5', border: '1.5px solid rgba(79,70,229,0.3)', borderRadius: '12px', padding: '10px 16px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
          <Download style={{ width: '15px', height: '15px' }} /> Exporter PDF
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px' }}>
        {/* Attendance */}
        <div style={{ background: 'var(--surface)', borderRadius: '20px', border: '1px solid var(--border)', padding: '22px', boxShadow: 'var(--shadow-sm)' }}>
          <h3 style={{ fontFamily: 'Syne, sans-serif', fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 18px' }}>Présence cette semaine</h3>
          <div style={{ height: '220px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={attendanceData}>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} />
                <Tooltip contentStyle={chartTooltipStyle} cursor={{ fill: 'var(--surface-2)' }} />
                <Bar dataKey="present" fill="#4F46E5" name="Présents" radius={[6,6,0,0]} />
                <Bar dataKey="absent" fill="#EDE9FE" name="Absents" radius={[6,6,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Groups */}
        <div style={{ background: 'var(--surface)', borderRadius: '20px', border: '1px solid var(--border)', padding: '22px', boxShadow: 'var(--shadow-sm)' }}>
          <h3 style={{ fontFamily: 'Syne, sans-serif', fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 18px' }}>Répartition par groupe</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ height: '180px', flex: 1 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={groupData} dataKey="value" cx="50%" cy="50%" outerRadius={80} innerRadius={50}>
                    {groupData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={chartTooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {groupData.map((g, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: g.color, flexShrink: 0 }} />
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{g.name}</span>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginLeft: 'auto' }}>{g.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Revenue */}
        <div style={{ background: 'var(--surface)', borderRadius: '20px', border: '1px solid var(--border)', padding: '22px', boxShadow: 'var(--shadow-sm)', gridColumn: '1 / -1' }}>
          <h3 style={{ fontFamily: 'Syne, sans-serif', fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 18px' }}>Revenus mensuels (DA)</h3>
          <div style={{ height: '200px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueData}>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} />
                <Tooltip contentStyle={chartTooltipStyle} cursor={{ fill: 'var(--surface-2)' }} formatter={(v: any) => [`${Number(v).toLocaleString('fr-DZ')} DA`, 'Revenu']} />
                <Bar dataKey="revenue" fill="url(#gradient)" radius={[8,8,0,0]} />
                <defs>
                  <linearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4F46E5" />
                    <stop offset="100%" stopColor="#7C3AED" />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}
