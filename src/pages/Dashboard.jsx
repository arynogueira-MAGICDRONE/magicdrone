import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { PageHeader, StatusPill } from '../components/layout/UI';
import { useNavigate } from 'react-router-dom';

function todayStr() {
  const d = new Date();
  const pad = n => n < 10 ? '0' + n : n;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function Dashboard() {
  const { user, isMaster } = useAuth();
  const { drones, shows, members, budgets, loadBudget, scaling, loadScaling } = useApp();
  const navigate = useNavigate();
  const [selectedShow, setSelectedShow] = React.useState('');
  const [showIdx, setShowIdx] = React.useState(0);

  const dronesOk = drones.filter(d => d.status === 'ok').length;
  const dronesBad = drones.filter(d => d.status === 'bad').length;

  const today = todayStr();
  const confirmedShows = shows
    .filter(s => s.status === 'conf' && s.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date));
  const nextShow = confirmedShows[showIdx] || null;

  const visibleShows = isMaster() ? shows : shows.filter(s => s.status === 'conf');

  const fmtDate = (str) => { if (!str) return '—'; const [y, m, d] = str.split('-'); return `${d}/${m}/${y}`; };
  const fmt = (v) => 'R$ ' + v.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  const resumo = selectedShow !== '' ? shows.find(s => String(s.id) === String(selectedShow)) : null;

  // Carrega budget do próximo show para o card
  const nextShowLoadedRef = React.useRef(null);
  React.useEffect(() => {
    if (nextShow && nextShowLoadedRef.current !== nextShow.id) {
      nextShowLoadedRef.current = nextShow.id;
      loadBudget(nextShow.id);
    }
  }, [nextShow?.id]);

  const loadedRef = React.useRef(null);
  React.useEffect(() => {
    if (!selectedShow || loadedRef.current === selectedShow) return;
    loadedRef.current = selectedShow;
    const show = shows.find(s => String(s.id) === String(selectedShow));
    if (show) {
      loadBudget(show.id);
      loadScaling(show.id);
    }
  }, [selectedShow]);

  const totalPrev = resumo ? (budgets[resumo.id] || []).reduce((a, i) => a + i.prev, 0) : 0;
  const totalReal = resumo ? (budgets[resumo.id] || []).reduce((a, i) => a + i.real, 0) : 0;
  const rawTeam = resumo ? (scaling[resumo.id] || []) : [];
  const scaledTeam = Array.from(new Map(rawTeam.map(sc => [sc.memberId, sc])).values());

  return (
    <div>
      <PageHeader label="Bem-vindo" title={user?.nome?.split(' ')[0] || user?.name?.split(' ')[0] || 'Master'} />

      {/* Próximo Show */}
      <div style={{ margin: '14px 16px 0' }}>
        {confirmedShows.length === 0 ? (
          <div style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', padding: 14, fontSize: 10, color: '#444', letterSpacing: 2, textTransform: 'uppercase', textAlign: 'center' }}>
            Nenhum show confirmado
          </div>
        ) : (
          <div style={{ background: '#fff', color: '#000', padding: 14, position: 'relative' }}>
            <div style={{ fontSize: 8, letterSpacing: 4, textTransform: 'uppercase', color: '#555', marginBottom: 6 }}>
              Próximo Show {confirmedShows.length > 1 ? `(${showIdx + 1}/${confirmedShows.length})` : ''}
            </div>
            <div onClick={() => navigate('/shows')} style={{ cursor: 'pointer' }}>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 2 }}>{nextShow.client}</div>
              <div style={{ fontSize: 10, color: '#555' }}>{fmtDate(nextShow.date)} · {nextShow.city}, {nextShow.state}</div>
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <span style={{ fontSize: 8, letterSpacing: 2, padding: '3px 8px', border: '1px solid #2e7d32', color: '#2e7d32', textTransform: 'uppercase' }}>
                  Confirmado
                </span>
                <span style={{ fontSize: 8, letterSpacing: 2, padding: '3px 8px', border: '1px solid #999', color: '#666', textTransform: 'uppercase' }}>
                  {nextShow.drones} drones
                </span>
              </div>
            </div>
            {confirmedShows.length > 1 && (
              <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                <button onClick={() => setShowIdx(i => Math.max(0, i - 1))} disabled={showIdx === 0}
                  style={{ flex: 1, padding: '5px 0', background: 'transparent', border: '1px solid #ccc', color: showIdx === 0 ? '#ccc' : '#000', fontFamily: 'Space Mono, monospace', fontSize: 11, cursor: showIdx === 0 ? 'not-allowed' : 'pointer' }}>←</button>
                <button onClick={() => setShowIdx(i => Math.min(confirmedShows.length - 1, i + 1))} disabled={showIdx === confirmedShows.length - 1}
                  style={{ flex: 1, padding: '5px 0', background: 'transparent', border: '1px solid #ccc', color: showIdx === confirmedShows.length - 1 ? '#ccc' : '#000', fontFamily: 'Space Mono, monospace', fontSize: 11, cursor: showIdx === confirmedShows.length - 1 ? 'not-allowed' : 'pointer' }}>→</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Visão Geral */}
      <div style={{ padding: '14px 16px 0' }}>
        <div style={{ fontSize: 9, letterSpacing: 4, color: '#666', textTransform: 'uppercase', marginBottom: 10 }}>Visão Geral</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[
            { icon: '📦', label: 'Equipamentos', val: drones.length, sub: `${dronesOk} bons · ${dronesBad} ruins`, to: '/inventario' },
            { icon: '📅', label: 'Shows',        val: visibleShows.filter(s => s.status === 'conf').length, sub: 'confirmados', to: '/shows' },
            { icon: '👥', label: 'Equipe',       val: members.length, sub: 'membros ativos', to: '/equipe' },
            { icon: '💰', label: 'Orçamento',    val: nextShow && budgets[nextShow.id]?.length ? fmt((budgets[nextShow.id]).reduce((a, i) => a + i.prev, 0)) : '—', sub: 'próximo show', to: '/orcamento' },
          ].map(card => (
            <div key={card.label} onClick={() => navigate(card.to)} style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', padding: 12, cursor: 'pointer' }}>
              <div style={{ fontSize: 16, marginBottom: 6 }}>{card.icon}</div>
              <div style={{ fontSize: 8, letterSpacing: 3, color: '#666', textTransform: 'uppercase', marginBottom: 3 }}>{card.label}</div>
              <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'Bebas Neue, sans-serif' }}>{card.val}</div>
              <div style={{ fontSize: 9, color: '#555', marginTop: 3 }}>{card.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Resumo do Show */}
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
                ['Status',         <StatusPill key="s" status={resumo.status} />],
                ['Data',           fmtDate(resumo.date)],
                ['Ensaio',         fmtDate(resumo.test)],
                ['Local',          `${resumo.city}, ${resumo.state}`],
                ['Drones',         resumo.drones],
                ['Orç. Previsto',  fmt(totalPrev)],
                ['Orç. Realizado', totalReal > 0 ? fmt(totalReal) : '—'],
              ].map(([label, val]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid #111' }}>
                  <span style={{ fontSize: 10, color: '#666' }}>{label}</span>
                  <span style={{ fontSize: 10, fontWeight: 600 }}>{val}</span>
                </div>
              ))}
              {scaledTeam.length > 0 && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid #111' }}>
                    <span style={{ fontSize: 10, color: '#666' }}>Equipe</span>
                    <span style={{ fontSize: 10, fontWeight: 600 }}>{scaledTeam.length} membro(s)</span>
                  </div>
                  {scaledTeam.map(sc => {
                    const m = members.find(m => m.id === sc.memberId);
                    if (!m) return null;
                    return (
                      <div key={sc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0 5px 10px', borderBottom: '1px solid #0d0d0d' }}>
                        <span style={{ fontSize: 10, color: '#aaa' }}>{m.name}</span>
                        <span style={{ fontSize: 9, color: '#555' }}>{sc.role || '—'}</span>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Acesso Rápido */}
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
