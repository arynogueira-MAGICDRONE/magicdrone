// Dashboard.jsx - will be built next
import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { PageHeader, StatusPill, Btn } from '../components/layout/UI';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const { user, isMaster } = useAuth();
  const { drones, shows, members, budgets } = useApp();
  const navigate = useNavigate();
  const [selectedShow, setSelectedShow] = React.useState('');

  const dronesOk = drones.filter(d => d.status === 'ok').length;
  const dronesBad = drones.filter(d => d.status === 'bad').length;
  const nextShow = shows.filter(s => s.status !== 'exec').sort((a, b) => a.date.localeCompare(b.date))[0];
  const visibleShows = isMaster() ? shows : shows.filter(s => s.status !== 'neg');

  const fmtDate = (str) => { if (!str) return '—'; const [y,m,d] = str.split('-'); return `${d}/${m}/${y}`; };
  const fmt = (v) => 'R$ ' + v.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  const resumo = selectedShow !== '' ? shows.find(s => s.id === parseInt(selectedShow)) : null;
  const totalPrev = resumo ? (budgets[resumo.id] || []).reduce((a, i) => a + i.prev, 0) : 0;
  const totalReal = resumo ? (budgets[resumo.id] || []).reduce((a, i) => a + i.real, 0) : 0;

  return (
    <div>
      <PageHeader label="Bem-vindo" title={user?.name?.split(' ')[0] || 'Master'} />

      {nextShow && (
        <div onClick={() => navigate('/shows')} style={{
          margin: '14px 16px 0', background: '#fff', color: '#000', padding: 14, cursor: 'pointer',
        }}>
          <div style={{ fontSize: 8, letterSpacing: 4, textTransform: 'uppercase', color: '#555', marginBottom: 6 }}>Próximo Show</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 2 }}>{nextShow.client}</div>
          <div style={{ fontSize: 10, color: '#555' }}>{fmtDate(nextShow.date)} · {nextShow.city}, {nextShow.state}</div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <span style={{ fontSize: 8, letterSpacing: 2, padding: '3px 8px', border: '1px solid #2e7d32', color: '#2e7d32', textTransform: 'uppercase' }}>
              {nextShow.status === 'conf' ? 'Confirmado' : 'Negociando'}
            </span>
            <span style={{ fontSize: 8, letterSpacing: 2, padding: '3px 8px', border: '1px solid #999', color: '#666', textTransform: 'uppercase' }}>
              {nextShow.drones} drones
            </span>
          </div>
        </div>
      )}

      <div style={{ padding: '14px 16px 0' }}>
        <div style={{ fontSize: 9, letterSpacing: 4, color: '#666', textTransform: 'uppercase', marginBottom: 10 }}>Visão Geral</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[
            { icon: '📦', label: 'Equipamentos', val: drones.length, sub: `${dronesOk} bons · ${dronesBad} ruins`, to: '/inventario' },
            { icon: '📅', label: 'Shows',        val: visibleShows.filter(s => s.status !== 'exec').length, sub: 'próximos', to: '/shows' },
            { icon: '👥', label: 'Equipe',       val: members.length, sub: 'membros ativos', to: '/equipe' },
            { icon: '💰', label: 'Orçamento',    val: nextShow ? fmt((budgets[nextShow.id]||[]).reduce((a,i)=>a+i.prev,0)) : '—', sub: 'próximo show', to: '/orcamento' },
          ].map(card => (
            <div key={card.label} onClick={() => navigate(card.to)} style={{
              background: '#0a0a0a', border: '1px solid #1a1a1a', padding: 12, cursor: 'pointer',
            }}>
              <div style={{ fontSize: 16, marginBottom: 6 }}>{card.icon}</div>
              <div style={{ fontSize: 8, letterSpacing: 3, color: '#666', textTransform: 'uppercase', marginBottom: 3 }}>{card.label}</div>
              <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'Bebas Neue, sans-serif' }}>{card.val}</div>
              <div style={{ fontSize: 9, color: '#555', marginTop: 3 }}>{card.sub}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ margin: '14px 16px 0', background: '#0a0a0a', border: '1px solid #1a1a1a' }}>
        <div style={{ padding: '12px 14px', borderBottom: '1px solid #111', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 9, letterSpacing: 4, textTransform: 'uppercase', color: '#888' }}>Resumo do Show</div>
          <select value={selectedShow} onChange={e => setSelectedShow(e.target.value)}
            style={{ background: '#000', border: '1px solid #333', color: '#fff', padding: '5px 8px', fontFamily: 'Space Mono, monospace', fontSize: 10, outline: 'none' }}>
            <option value="">Selecionar...</option>
            {visibleShows.map(s => <option key={s.id} value={s.id}>{s.client}</option>)}
          </select>
        </div>
        <div style={{ padding: 14 }}>
          {!resumo ? (
            <div style={{ textAlign: 'center', padding: '16px 0', color: '#333', fontSize: 10, letterSpacing: 3, textTransform: 'uppercase' }}>
              Selecione um show
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {[
                ['Status', <StatusPill key="s" status={resumo.status} />],
                ['Data', fmtDate(resumo.date)],
                ['Ensaio', fmtDate(resumo.test)],
                ['Local', `${resumo.city}, ${resumo.state}`],
                ['Drones', resumo.drones],
                ['Orç. Previsto', fmt(totalPrev)],
                ['Orç. Realizado', totalReal > 0 ? fmt(totalReal) : '—'],
              ].map(([label, val]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid #111' }}>
                  <span style={{ fontSize: 10, color: '#666' }}>{label}</span>
                  <span style={{ fontSize: 10, fontWeight: 600 }}>{val}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: '14px 16px 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ fontSize: 9, letterSpacing: 4, color: '#666', textTransform: 'uppercase', marginBottom: 4 }}>Acesso Rápido</div>
        {[
          { label: 'Manual de Instruções', to: '/manual', icon: '📖' },
          { label: 'Documentação', to: '/documentacao', icon: '📄' },
        ].map(item => (
          <div key={item.to} onClick={() => navigate(item.to)} style={{
            display: 'flex', alignItems: 'center', gap: 10, background: '#0a0a0a',
            border: '1px solid #1a1a1a', padding: '10px 12px', cursor: 'pointer',
          }}>
            <span style={{ fontSize: 16 }}>{item.icon}</span>
            <span style={{ fontSize: 11, fontWeight: 600 }}>{item.label}</span>
            <span style={{ marginLeft: 'auto', color: '#555' }}>›</span>
          </div>
        ))}
      </div>
    </div>
  );
}
