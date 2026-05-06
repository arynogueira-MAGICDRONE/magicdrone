import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { PageHeader, Section } from '../components/layout/UI';

const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
function fmt(v) { return 'R$ ' + (v||0).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
function fmtDate(str) { if (!str) return '—'; const [y,m,d] = str.split('-'); return `${d}/${m}/${y}`; }
function monthLabel(ym) {
  const [y, m] = ym.split('-');
  return `${MONTHS[parseInt(m) - 1]}/${y.slice(2)}`;
}

const TABS = [
  { key: 'estado',    label: 'Por Estado' },
  { key: 'mes',       label: 'Por Mês' },
  { key: 'regiao',    label: 'Região × Mês' },
  { key: 'financeiro',label: 'Receita × Despesa' },
  { key: 'equipe',    label: 'Equipe' },
  { key: 'custos',    label: 'Custos' },
];

function Bar({ pct, color = '#4caf50' }) {
  return (
    <div style={{ height: 4, background: '#111', borderRadius: 2, overflow: 'hidden' }}>
      <div style={{ height: 4, width: `${Math.min(pct, 100)}%`, background: color, transition: 'width 0.4s' }} />
    </div>
  );
}

function Row({ label, value, pct, color, sub }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: 11, color: '#ccc' }}>{label}</span>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: color || '#fff' }}>{value}</span>
          {sub && <span style={{ fontSize: 9, color: '#555', marginLeft: 6 }}>{sub}</span>}
        </div>
      </div>
      <Bar pct={pct} color={color || '#4caf50'} />
    </div>
  );
}

const TH = { fontSize: 8, letterSpacing: 2, color: '#555', textTransform: 'uppercase', padding: '6px 8px', borderBottom: '1px solid #1a1a1a', textAlign: 'left' };
const TD = { fontSize: 11, padding: '8px 8px', borderBottom: '1px solid #111' };

export default function Relatorios() {
  const { shows, budgets, scaling, members, loadAllBudgets, loadAllScaling } = useApp();
  const [tab, setTab] = useState('estado');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([loadAllBudgets(), loadAllScaling()]).then(() => setLoaded(true));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── a) Shows por Estado ───────────────────────────────────────────────────
  const byState = Object.entries(
    shows.reduce((acc, s) => { if (s.state) acc[s.state] = (acc[s.state] || 0) + 1; return acc; }, {})
  ).sort((a, b) => b[1] - a[1]);
  const maxState = byState[0]?.[1] || 1;

  // ── b) Shows por Mês ──────────────────────────────────────────────────────
  const byMonth = Object.entries(
    shows.reduce((acc, s) => {
      if (!s.date) return acc;
      const ym = s.date.slice(0, 7);
      acc[ym] = (acc[ym] || 0) + 1;
      return acc;
    }, {})
  ).sort().map(([ym, n]) => ({ label: monthLabel(ym), n }));
  const maxMonth = Math.max(...byMonth.map(m => m.n), 1);

  // ── c) Região × Mês ───────────────────────────────────────────────────────
  const regionMonth = shows
    .filter(s => s.state && s.date)
    .reduce((acc, s) => {
      const key = `${monthLabel(s.date.slice(0, 7))} — ${s.state}`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  const regionRows = Object.entries(regionMonth).sort((a, b) => b[1] - a[1]).slice(0, 20);
  const maxRegion = regionRows[0]?.[1] || 1;

  // ── d) Receita × Despesa × Lucro ─────────────────────────────────────────
  const financeiro = shows.map(s => {
    const items = budgets[s.id] || [];
    const despesa = items.reduce((a, i) => a + (i.real || 0), 0);
    const receita = s.valor || 0;
    const lucro = receita - despesa;
    return { show: s.client, date: s.date, receita, despesa, lucro };
  }).filter(s => s.receita > 0 || s.despesa > 0).sort((a, b) => b.lucro - a.lucro);
  const maxReceita = Math.max(...financeiro.map(f => f.receita), 1);

  // ── e) Equipe × Shows escalados ──────────────────────────────────────────
  const equipeData = members.map(m => {
    const shows_count = Object.values(scaling).filter(scaled => scaled.some(s => s.memberId === m.id)).length;
    return { name: m.name, shows_count };
  }).filter(m => m.shows_count > 0).sort((a, b) => b.shows_count - a.shows_count);
  const maxEquipe = equipeData[0]?.shows_count || 1;

  // ── f) Impacto de custos ──────────────────────────────────────────────────
  const catTotals = {};
  let grandTotal = 0;
  Object.values(budgets).flat().forEach(item => {
    if (item.real > 0) {
      catTotals[item.cat] = (catTotals[item.cat] || 0) + item.real;
      grandTotal += item.real;
    }
  });
  const custos = Object.entries(catTotals)
    .map(([cat, total]) => ({ cat, total, pct: grandTotal > 0 ? (total / grandTotal * 100) : 0 }))
    .sort((a, b) => b.total - a.total);

  const renderTab = () => {
    if (!loaded) return (
      <div style={{ textAlign: 'center', padding: '32px 0', color: '#555', fontSize: 10, letterSpacing: 3, textTransform: 'uppercase' }}>
        Carregando dados...
      </div>
    );

    if (tab === 'estado') return (
      <div>
        {byState.length === 0
          ? <div style={{ color: '#444', fontSize: 10, textAlign: 'center', padding: '24px 0' }}>Sem dados</div>
          : byState.map(([state, n]) => (
            <Row key={state} label={state} value={n + ' shows'} pct={(n / maxState) * 100} />
          ))}
      </div>
    );

    if (tab === 'mes') return (
      <div>
        {byMonth.length === 0
          ? <div style={{ color: '#444', fontSize: 10, textAlign: 'center', padding: '24px 0' }}>Sem dados</div>
          : byMonth.map(({ label, n }) => (
            <Row key={label} label={label} value={n + ' shows'} pct={(n / maxMonth) * 100} />
          ))}
      </div>
    );

    if (tab === 'regiao') return (
      <div>
        {regionRows.length === 0
          ? <div style={{ color: '#444', fontSize: 10, textAlign: 'center', padding: '24px 0' }}>Sem dados</div>
          : regionRows.map(([key, n]) => (
            <Row key={key} label={key} value={n + ' shows'} pct={(n / maxRegion) * 100} color="#ff9800" />
          ))}
      </div>
    );

    if (tab === 'financeiro') return (
      <div>
        {financeiro.length === 0
          ? <div style={{ color: '#444', fontSize: 10, textAlign: 'center', padding: '24px 0' }}>Sem dados financeiros</div>
          : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={TH}>Show</th>
                    <th style={{ ...TH, textAlign: 'right' }}>Receita</th>
                    <th style={{ ...TH, textAlign: 'right' }}>Despesa</th>
                    <th style={{ ...TH, textAlign: 'right' }}>Lucro</th>
                  </tr>
                </thead>
                <tbody>
                  {financeiro.map((f, i) => (
                    <tr key={i}>
                      <td style={TD}>
                        <div style={{ fontWeight: 600 }}>{f.show}</div>
                        <div style={{ fontSize: 9, color: '#555' }}>{fmtDate(f.date)}</div>
                      </td>
                      <td style={{ ...TD, textAlign: 'right', color: '#4caf50' }}>{fmt(f.receita)}</td>
                      <td style={{ ...TD, textAlign: 'right', color: '#f44336' }}>{fmt(f.despesa)}</td>
                      <td style={{ ...TD, textAlign: 'right', color: f.lucro >= 0 ? '#4caf50' : '#f44336', fontWeight: 700 }}>{fmt(f.lucro)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {/* Totais */}
              <div style={{ background: '#111', border: '1px solid #1a1a1a', padding: '10px 12px', marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                {[
                  ['Total Receita', financeiro.reduce((a, f) => a + f.receita, 0), '#4caf50'],
                  ['Total Despesa', financeiro.reduce((a, f) => a + f.despesa, 0), '#f44336'],
                  ['Lucro Total', financeiro.reduce((a, f) => a + f.lucro, 0), '#fff'],
                ].map(([l, v, c]) => (
                  <div key={l} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 8, letterSpacing: 2, color: '#555', textTransform: 'uppercase', marginBottom: 4 }}>{l}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: c }}>{fmt(v)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
      </div>
    );

    if (tab === 'equipe') return (
      <div>
        {equipeData.length === 0
          ? <div style={{ color: '#444', fontSize: 10, textAlign: 'center', padding: '24px 0' }}>Sem escalações registradas</div>
          : equipeData.map(m => (
            <Row key={m.name} label={m.name} value={m.shows_count + ' show(s)'} pct={(m.shows_count / maxEquipe) * 100} color="#9c27b0" />
          ))}
      </div>
    );

    if (tab === 'custos') return (
      <div>
        {custos.length === 0
          ? <div style={{ color: '#444', fontSize: 10, textAlign: 'center', padding: '24px 0' }}>Sem despesas realizadas</div>
          : (
            <>
              {custos.map(c => (
                <Row key={c.cat} label={c.cat} value={fmt(c.total)} sub={c.pct.toFixed(1) + '%'} pct={c.pct} color="#2196f3" />
              ))}
              <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderTop: '1px solid #1a1a1a' }}>
                <span style={{ fontSize: 10, color: '#666', letterSpacing: 2, textTransform: 'uppercase' }}>Total Geral</span>
                <span style={{ fontSize: 14, fontWeight: 700 }}>{fmt(grandTotal)}</span>
              </div>
            </>
          )}
      </div>
    );
  };

  return (
    <div>
      <PageHeader label="Módulo" title="Relatórios" />

      {/* Tabs */}
      <div style={{ display: 'flex', overflowX: 'auto', borderBottom: '1px solid #1a1a1a', padding: '0 16px' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            flex: 'none', padding: '10px 12px', fontSize: 8, letterSpacing: 2, textTransform: 'uppercase',
            fontFamily: 'Space Mono,monospace', cursor: 'pointer',
            color: tab === t.key ? '#fff' : '#555',
            borderBottom: `2px solid ${tab === t.key ? '#fff' : 'transparent'}`,
            background: 'transparent', border: 'none',
            borderBottomColor: tab === t.key ? '#fff' : 'transparent',
            borderBottomWidth: 2, borderBottomStyle: 'solid',
            whiteSpace: 'nowrap',
          }}>{t.label}</button>
        ))}
      </div>

      {/* Resumo geral */}
      <div style={{ padding: '12px 16px 0', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, marginBottom: 0 }}>
        {[
          ['Shows', shows.length, '#fff'],
          ['Confirmados', shows.filter(s => s.status === 'conf').length, '#4caf50'],
          ['Estados', byState.length, '#ff9800'],
        ].map(([l, n, c]) => (
          <div key={l} style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', padding: '8px 10px', textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: c }}>{n}</div>
            <div style={{ fontSize: 8, letterSpacing: 2, color: '#555', textTransform: 'uppercase', marginTop: 2 }}>{l}</div>
          </div>
        ))}
      </div>

      <Section title={TABS.find(t => t.key === tab)?.label || ''}>
        {renderTab()}
      </Section>
    </div>
  );
}
