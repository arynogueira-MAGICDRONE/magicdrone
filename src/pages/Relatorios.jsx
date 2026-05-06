import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../supabase';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { PageHeader } from '../components/layout/UI';

// ─── Constantes ──────────────────────────────────────────────────────────────
const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const QUARTERS = { '1':[1,2,3], '2':[4,5,6], '3':[7,8,9], '4':[10,11,12] };
const STATUS_MAP = { conf:'Confirmado', neg:'Negociando', exec:'Executado', cancelado:'Cancelado' };
const PIE_COLORS = ['#4caf50','#2196f3','#ff9800','#e91e63','#9c27b0','#00bcd4','#ff5722','#8bc34a','#ffc107','#607d8b','#795548'];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmt(v) { return 'R$ ' + (v||0).toFixed(2).replace('.',',').replace(/\B(?=(\d{3})+(?!\d))/g,'.'); }
function fmtShort(v) {
  if (v >= 1000000) return 'R$' + (v/1000000).toFixed(1) + 'M';
  if (v >= 1000)    return 'R$' + (v/1000).toFixed(1) + 'k';
  return fmt(v);
}
function fmtDate(s) { if (!s) return '—'; const [y,m,d]=s.split('-'); return `${d}/${m}/${y}`; }
function todayStr() { const d=new Date(),p=n=>n<10?'0'+n:n; return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`; }

// ─── Estilos compartilhados ───────────────────────────────────────────────────
const thS = { fontSize:8, letterSpacing:2, color:'#aaa', textTransform:'uppercase', padding:'7px 10px', borderBottom:'1px solid #1a1a1a', textAlign:'left', background:'#050505', whiteSpace:'nowrap' };
const tdS = { fontSize:13, padding:'8px 10px', borderBottom:'1px solid #0d0d0d' };
const selS = { background:'#000', border:'1px solid #333', color:'#fff', padding:'6px 8px', fontFamily:'Space Mono,monospace', fontSize:12, outline:'none' };

// ─── Sub-componentes ─────────────────────────────────────────────────────────
function KPI({ label, value, sub, color='#fff' }) {
  return (
    <div style={{ background:'#0a0a0a', border:'1px solid #1a1a1a', padding:'12px 10px' }}>
      <div style={{ fontSize:8, letterSpacing:3, color:'#aaa', textTransform:'uppercase', marginBottom:5 }}>{label}</div>
      <div style={{ fontSize:22, fontWeight:700, fontFamily:'Bebas Neue,sans-serif', color, letterSpacing:1 }}>{value}</div>
      {sub && <div style={{ fontSize:11, color:'#888', marginTop:3 }}>{sub}</div>}
    </div>
  );
}

function SHead({ title }) {
  return (
    <div style={{ fontSize:11, letterSpacing:4, color:'#aaa', textTransform:'uppercase', padding:'18px 16px 8px', borderTop:'1px solid #0d0d0d' }}>
      {title}
    </div>
  );
}

function SortTH({ label, col, sort, setSort, style={} }) {
  const active = sort.col === col;
  return (
    <th onClick={() => setSort(s => ({ col, dir: s.col===col && s.dir==='asc' ? 'desc' : 'asc' }))}
      style={{ ...thS, cursor:'pointer', userSelect:'none', ...style }}>
      {label} {active ? (sort.dir==='asc' ? '↑' : '↓') : <span style={{color:'#333'}}>⇅</span>}
    </th>
  );
}

// ─── Gráfico de Barras (SVG) ─────────────────────────────────────────────────
function BarChart({ data, labelKey, valueKey, fmtTip, color='#fff', height=140 }) {
  const [hov, setHov] = useState(null);
  if (!data.length || data.every(d=>!d[valueKey]))
    return <div style={{ textAlign:'center', padding:'20px 0', color:'#888', fontSize:12 }}>Sem dados</div>;
  const maxV = Math.max(...data.map(d => d[valueKey]||0), 1);
  const barW = Math.max(18, Math.min(36, Math.floor(260 / data.length)));
  const gap  = 4;
  const padL = 4, padT = 24, padB = 22;
  const totalW = data.length * (barW + gap) + padL;
  return (
    <div style={{ overflowX:'auto' }}>
      <svg width={Math.max(totalW, 280)} height={height+padT+padB} style={{ display:'block' }}>
        {/* grid */}
        {[0,0.25,0.5,0.75,1].map(f => {
          const y = padT + height - f*height;
          return <line key={f} x1={padL} y1={y} x2={totalW} y2={y} stroke="#0d0d0d" strokeWidth={1} />;
        })}
        {data.map((d, i) => {
          const val = d[valueKey] || 0;
          const bH  = (val / maxV) * height;
          const x   = padL + i * (barW + gap);
          const y   = padT + height - bH;
          return (
            <g key={i} onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)}>
              <rect x={x} y={y} width={barW} height={bH || 1}
                fill={hov===i ? '#ddd' : color} style={{ transition:'fill 0.1s' }} />
              {hov===i && val>0 && (
                <text x={x+barW/2} y={Math.max(y-6, padT-2)} textAnchor="middle"
                  fill="#fff" fontSize={8} fontFamily="Space Mono,monospace">{fmtTip ? fmtTip(val) : val}</text>
              )}
              <text x={x+barW/2} y={height+padT+padB-4} textAnchor="middle"
                fill="#555" fontSize={7} fontFamily="Space Mono,monospace">{d[labelKey]}</text>
            </g>
          );
        })}
        <line x1={padL} y1={padT} x2={padL} y2={height+padT} stroke="#1a1a1a" strokeWidth={1} />
        <line x1={padL} y1={height+padT} x2={totalW} y2={height+padT} stroke="#1a1a1a" strokeWidth={1} />
      </svg>
    </div>
  );
}

// ─── Gráfico de Linha (SVG) ──────────────────────────────────────────────────
function LineChart({ data, labelKey, valueKey, height=130 }) {
  const [hov, setHov] = useState(null);
  const nonEmpty = data.filter(d => d[valueKey] > 0);
  if (!nonEmpty.length)
    return <div style={{ textAlign:'center', padding:'20px 0', color:'#888', fontSize:12 }}>Sem dados</div>;
  const maxV  = Math.max(...data.map(d => d[valueKey]||0), 1);
  const padL=48, padR=12, padT=18, padB=22;
  const totalW = Math.max(data.length * 44 + padL + padR, 280);
  const step   = (totalW - padL - padR) / Math.max(data.length-1, 1);
  const pts = data.map((d, i) => ({
    x: padL + i*step, y: padT + height - (d[valueKey]/maxV)*height,
    val: d[valueKey], label: d[labelKey],
  }));
  const polyPts = pts.map(p => `${p.x},${p.y}`).join(' ');
  return (
    <div style={{ overflowX:'auto' }}>
      <svg width={totalW} height={height+padT+padB} style={{ display:'block' }}>
        {[0,0.25,0.5,0.75,1].map(f => {
          const y = padT + height - f*height;
          return (
            <g key={f}>
              <line x1={padL} y1={y} x2={totalW-padR} y2={y} stroke="#0d0d0d" strokeWidth={1} />
              <text x={padL-4} y={y+4} textAnchor="end" fill="#444" fontSize={8} fontFamily="Space Mono,monospace">
                {fmtShort(maxV*f).replace('R$ ','R$')}
              </text>
            </g>
          );
        })}
        <polyline points={polyPts} fill="none" stroke="#444" strokeWidth={1} strokeDasharray="2 2" />
        <polyline points={pts.filter(p=>p.val>0).map(p=>`${p.x},${p.y}`).join(' ')} fill="none" stroke="#fff" strokeWidth={2} />
        {pts.map((p, i) => (
          <g key={i} onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)}>
            <circle cx={p.x} cy={p.y} r={p.val>0?4:2}
              fill={hov===i?'#fff':'#000'} stroke={p.val>0?'#fff':'#333'} strokeWidth={2} style={{ cursor:'default' }} />
            {hov===i && p.val>0 && (
              <text x={p.x} y={p.y-10} textAnchor="middle" fill="#fff" fontSize={8} fontFamily="Space Mono,monospace">
                {fmtShort(p.val)}
              </text>
            )}
            <text x={p.x} y={height+padT+padB-4} textAnchor="middle" fill="#555" fontSize={7} fontFamily="Space Mono,monospace">
              {p.label}
            </text>
          </g>
        ))}
        <line x1={padL} y1={padT} x2={padL} y2={height+padT} stroke="#1a1a1a" strokeWidth={1} />
        <line x1={padL} y1={height+padT} x2={totalW-padR} y2={height+padT} stroke="#1a1a1a" strokeWidth={1} />
      </svg>
    </div>
  );
}

// ─── Gráfico de Pizza (SVG stroke-dasharray) ─────────────────────────────────
function PieChart({ data, nameKey, valueKey }) {
  const [hov, setHov] = useState(null);
  const total = data.reduce((a,d) => a+d[valueKey], 0);
  if (!data.length || total === 0)
    return <div style={{ textAlign:'center', padding:'20px 0', color:'#888', fontSize:12 }}>Sem dados</div>;
  const r = 48, cx = 60, cy = 60, circ = 2*Math.PI*r;
  let offset = 0;
  const segs = data.map((d, i) => {
    const frac  = d[valueKey] / total;
    const dash  = frac * circ;
    const angle = -90 + (offset/circ)*360;
    const seg   = { ...d, frac, dash, angle, color: PIE_COLORS[i % PIE_COLORS.length] };
    offset += dash;
    return seg;
  });
  return (
    <div style={{ display:'flex', alignItems:'flex-start', gap:20, flexWrap:'wrap' }}>
      <svg width={120} height={120} style={{ flexShrink:0 }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#111" strokeWidth={22} />
        {segs.map((seg, i) => (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none"
            stroke={seg.color}
            strokeWidth={hov===i ? 26 : 22}
            strokeDasharray={`${seg.dash} ${circ}`}
            style={{ transform:`rotate(${seg.angle}deg)`, transformOrigin:`${cx}px ${cy}px`, transition:'stroke-width 0.15s', cursor:'default' }}
            onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)}
          />
        ))}
      </svg>
      <div style={{ flex:1, minWidth:120 }}>
        {segs.map((seg, i) => (
          <div key={i} style={{ display:'flex', alignItems:'center', gap:6, marginBottom:5,
            opacity: hov!==null && hov!==i ? 0.35 : 1, transition:'opacity 0.15s', cursor:'default' }}
            onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)}>
            <div style={{ width:8, height:8, background:seg.color, flexShrink:0 }} />
            <span style={{ fontSize:11, color:'#ccc', flex:1 }}>{seg[nameKey]}</span>
            <span style={{ fontSize:11, color:'#aaa', whiteSpace:'nowrap' }}>{(seg.frac*100).toFixed(1)}%</span>
            <span style={{ fontSize:11, color:'#888', whiteSpace:'nowrap', marginLeft:4 }}>{fmt(seg[valueKey])}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Componente principal ────────────────────────────────────────────────────
export default function Relatorios() {
  const { shows, budgets, scaling, members, loadAllBudgets, loadAllScaling } = useApp();
  const { isMaster } = useAuth();
  const [loaded, setLoaded] = useState(false);
  const [crmData, setCrmData] = useState([]);

  // Meta mensal (persiste em localStorage)
  const [meta, setMeta] = useState(() => parseFloat(localStorage.getItem('md_meta_mensal') || '0'));
  const [editMeta, setEditMeta] = useState(false);
  const [metaInput, setMetaInput] = useState('');

  // Filtros
  const [filterYear,    setFilterYear]    = useState('');
  const [filterQuarter, setFilterQuarter] = useState('');
  const [filterState,   setFilterState]   = useState('');
  const [filterStatus,  setFilterStatus]  = useState('');

  // Sorts
  const [sortFin, setSortFin] = useState({ col:'lucro',  dir:'desc' });
  const [sortCli, setSortCli] = useState({ col:'receita', dir:'desc' });

  useEffect(() => {
    Promise.all([loadAllBudgets(), loadAllScaling()]).then(() => setLoaded(true));
    supabase.from('crm').select('*').then(({ data }) => { if (data) setCrmData(data); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Filtros disponíveis ──
  const years  = useMemo(() => [...new Set(shows.map(s=>s.date?.slice(0,4)).filter(Boolean))].sort().reverse(), [shows]);
  const states = useMemo(() => [...new Set(shows.map(s=>s.state).filter(Boolean))].sort(), [shows]);

  const filteredShows = useMemo(() => shows.filter(s => {
    if (filterYear    && s.date?.slice(0,4) !== filterYear) return false;
    if (filterState   && s.state !== filterState)           return false;
    if (filterStatus  && s.status !== filterStatus)         return false;
    if (filterQuarter) {
      const m = parseInt(s.date?.slice(5,7));
      if (!QUARTERS[filterQuarter]?.includes(m)) return false;
    }
    return true;
  }), [shows, filterYear, filterState, filterStatus, filterQuarter]);

  const confirmedShows = useMemo(() => filteredShows.filter(s => s.status === 'conf'), [filteredShows]);

  // ── KPIs ──
  const receitaTotal = useMemo(() => confirmedShows.reduce((a,s) => a+(s.valor||0), 0), [confirmedShows]);
  const despesaTotal = useMemo(() => confirmedShows.reduce((a,s) =>
    a + (budgets[s.id]||[]).reduce((b,i) => b+(i.real||0), 0), 0), [confirmedShows, budgets]);
  const lucroTotal  = receitaTotal - despesaTotal;
  const ticketMedio = confirmedShows.length > 0 ? receitaTotal / confirmedShows.length : 0;
  const lucroMedio  = confirmedShows.length > 0 ? lucroTotal  / confirmedShows.length : 0;
  const taxaCRM     = crmData.length > 0
    ? (crmData.filter(c=>c.status==='confirmado').length / crmData.length * 100) : 0;

  // ── Dados para gráficos ──
  const showsByMonth = useMemo(() => {
    const map = {};
    filteredShows.forEach(s => { if (s.date) { const m=parseInt(s.date.slice(5,7))-1; map[m]=(map[m]||0)+1; } });
    return MONTHS.map((label,i) => ({ label, n: map[i]||0 }));
  }, [filteredShows]);

  const receitaByState = useMemo(() => {
    const map = {};
    confirmedShows.forEach(s => { const st=s.state||'N/A'; map[st]=(map[st]||0)+(s.valor||0); });
    return Object.entries(map).map(([label,receita]) => ({label,receita})).sort((a,b)=>b.receita-a.receita);
  }, [confirmedShows]);

  const receitaMensal = useMemo(() => {
    const map = {};
    confirmedShows.forEach(s => { if (s.date) { const m=parseInt(s.date.slice(5,7))-1; map[m]=(map[m]||0)+(s.valor||0); } });
    return MONTHS.map((label,i) => ({ label, receita: map[i]||0 }));
  }, [confirmedShows]);

  const custosByCat = useMemo(() => {
    const map = {};
    filteredShows.forEach(s => {
      (budgets[s.id]||[]).forEach(item => { if (item.real>0) map[item.cat]=(map[item.cat]||0)+item.real; });
    });
    return Object.entries(map).map(([cat,total])=>({cat,total})).sort((a,b)=>b.total-a.total);
  }, [filteredShows, budgets]);

  // ── Tabela financeiro ──
  const finRows = useMemo(() => filteredShows.map(s => {
    const items   = budgets[s.id]||[];
    const despesa = items.reduce((a,i)=>a+(i.real||0),0);
    const receita = s.valor||0;
    const lucro   = receita - despesa;
    const margem  = receita > 0 ? lucro/receita*100 : 0;
    return { show:s.client, date:s.date, receita, despesa, lucro, margem };
  }).filter(f=>f.receita>0||f.despesa>0), [filteredShows, budgets]);

  const sortedFin = useMemo(() => [...finRows].sort((a,b) =>
    sortFin.dir==='asc' ? (a[sortFin.col]>b[sortFin.col]?1:-1) : (a[sortFin.col]<b[sortFin.col]?1:-1)
  ), [finRows, sortFin]);

  // ── Tabela equipe ──
  const equipeRows = useMemo(() => members.map(m => {
    const myShows = Object.entries(scaling).filter(([,sc]) => sc.some(s=>s.memberId===m.id));
    let totalDiarias = 0;
    myShows.forEach(([sid]) => {
      (budgets[parseInt(sid)]||budgets[sid]||[]).forEach(item => {
        if (item.cat==='Diárias') totalDiarias += (item.real||0);
      });
    });
    return { name:m.name, showsCount:myShows.length, totalDiarias };
  }).filter(m=>m.showsCount>0).sort((a,b)=>b.showsCount-a.showsCount), [members, scaling, budgets]);

  // ── Ranking clientes CRM ──
  const clientesRanking = useMemo(() => {
    const map = {};
    crmData.forEach(c => {
      if (!map[c.empresa]) map[c.empresa] = { empresa:c.empresa, count:0, receita:0 };
      map[c.empresa].count++;
      map[c.empresa].receita += c.valor||0;
    });
    return Object.values(map)
      .map(c => ({ ...c, ticket: c.count>0 ? c.receita/c.count : 0 }))
      .sort((a,b) => b.receita-a.receita);
  }, [crmData]);

  const sortedCli = useMemo(() => {
    const col = sortCli.col==='ticket' ? 'ticket' : sortCli.col==='count' ? 'count' : 'receita';
    return [...clientesRanking].sort((a,b) =>
      sortCli.dir==='asc' ? (a[col]>b[col]?1:-1) : (a[col]<b[col]?1:-1));
  }, [clientesRanking, sortCli]);

  // ── Conversão CRM por mês ──
  const crmConversao = useMemo(() => {
    const map = {};
    crmData.forEach(c => {
      const ym = c.created_at?.slice(0,7); if (!ym) return;
      if (!map[ym]) map[ym] = { total:0, conv:0 };
      map[ym].total++;
      if (c.status==='confirmado') map[ym].conv++;
    });
    return Object.entries(map).sort().map(([ym,d]) => ({
      mes: `${MONTHS[parseInt(ym.slice(5,7))-1]}/${ym.slice(2,4)}`,
      total:d.total, conv:d.conv, taxa: d.total>0 ? (d.conv/d.total*100).toFixed(1) : '0',
    }));
  }, [crmData]);

  // ── Previsão ──
  const today    = todayStr();
  const previsao = shows.filter(s=>s.status==='conf'&&s.date>today).reduce((a,s)=>a+(s.valor||0),0);

  // ── Exportar Excel ──
  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['Indicador','Valor'],
      ['Shows Confirmados', confirmedShows.length],
      ['Receita Total', receitaTotal],
      ['Despesa Total', despesaTotal],
      ['Lucro Total', lucroTotal],
      ['Ticket Médio', ticketMedio],
      ['Lucro Médio/Show', lucroMedio],
      ['Taxa Conversão CRM (%)', taxaCRM.toFixed(1)],
      ['Previsão Receita (futuros)', previsao],
    ]), 'KPIs');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['Show','Data','Receita','Despesas','Lucro','Margem %'],
      ...sortedFin.map(f=>[f.show, fmtDate(f.date), f.receita, f.despesa, f.lucro, f.margem.toFixed(1)+'%']),
      ['TOTAL','', finRows.reduce((a,f)=>a+f.receita,0), finRows.reduce((a,f)=>a+f.despesa,0), lucroTotal,''],
    ]), 'Financeiro');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['Membro','Shows Escalado','Valor Diárias'],
      ...equipeRows.map(m=>[m.name, m.showsCount, m.totalDiarias]),
    ]), 'Equipe');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['Empresa','Orçamentos','Valor Total','Ticket Médio'],
      ...sortedCli.map(c=>[c.empresa, c.count, c.receita, c.ticket]),
    ]), 'Clientes CRM');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['Mês','Orçamentos','Convertidos','Taxa %'],
      ...crmConversao.map(c=>[c.mes, c.total, c.conv, c.taxa+'%']),
    ]), 'Conversão CRM');
    XLSX.writeFile(wb, 'magicdrone-relatorios.xlsx');
  };

  const clearFilters = () => { setFilterYear(''); setFilterQuarter(''); setFilterState(''); setFilterStatus(''); };
  const hasFilter = filterYear || filterQuarter || filterState || filterStatus;

  if (!loaded) return (
    <div style={{ textAlign:'center', padding:'60px 16px', color:'#aaa', fontSize:12, letterSpacing:3, textTransform:'uppercase' }}>
      Carregando dados...
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div id="relatorios-root">
      {/* Print styles */}
      <style>{`
        @media print {
          body { background:#fff !important; color:#000 !important; }
          .no-print { display:none !important; }
          svg rect, svg circle { opacity:0.8; }
          table { border-collapse:collapse; }
          td, th { border:1px solid #ccc !important; }
        }
      `}</style>

      <PageHeader label="Módulo" title="Relatórios" />

      {/* ── Filtros + Exportação ─────────────────────────────── */}
      <div className="no-print" style={{ padding:'10px 16px', background:'#050505', borderBottom:'1px solid #111', display:'flex', flexWrap:'wrap', gap:6, alignItems:'center' }}>
        <select value={filterYear}    onChange={e=>setFilterYear(e.target.value)}    style={selS}>
          <option value="">Todos os anos</option>
          {years.map(y=><option key={y} value={y}>{y}</option>)}
        </select>
        <select value={filterQuarter} onChange={e=>setFilterQuarter(e.target.value)} style={selS}>
          <option value="">Todos trimestres</option>
          {['1','2','3','4'].map(q=><option key={q} value={q}>T{q}</option>)}
        </select>
        <select value={filterState}   onChange={e=>setFilterState(e.target.value)}   style={selS}>
          <option value="">Todos os estados</option>
          {states.map(s=><option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterStatus}  onChange={e=>setFilterStatus(e.target.value)}  style={selS}>
          <option value="">Todos os status</option>
          {Object.entries(STATUS_MAP).map(([k,v])=><option key={k} value={k}>{v}</option>)}
        </select>
        {hasFilter && (
          <button onClick={clearFilters} style={{ ...selS, cursor:'pointer', color:'#f44336', borderColor:'f44336' }}>
            ✕ Limpar
          </button>
        )}
        <div style={{ marginLeft:'auto', display:'flex', gap:6 }}>
          <button onClick={()=>window.print()} style={{ ...selS, cursor:'pointer', borderColor:'#555', color:'#aaa' }}>⎙ PDF</button>
          <button onClick={exportExcel}        style={{ ...selS, cursor:'pointer', borderColor:'#4caf50', color:'#4caf50' }}>↓ Excel</button>
        </div>
      </div>

      {/* ── KPIs ─────────────────────────────────────────────── */}
      <div style={{ padding:'14px 16px 0', display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))', gap:8 }}>
        <KPI label="Shows Confirmados" value={confirmedShows.length} />
        <KPI label="Receita Total"     value={fmtShort(receitaTotal)} color="#4caf50" />
        <KPI label="Lucro Médio/Show"  value={fmtShort(lucroMedio)}  color={lucroMedio>=0?'#4caf50':'#f44336'} />
        <KPI label="Ticket Médio"      value={fmtShort(ticketMedio)} />
        <KPI label="Conversão CRM"     value={taxaCRM.toFixed(1)+'%'}
          sub={`${crmData.filter(c=>c.status==='confirmado').length} de ${crmData.length}`} />
      </div>

      {/* ── Previsão de receita ───────────────────────────────── */}
      <div style={{ padding:'12px 16px 0' }}>
        <div style={{ background:'#0a0a0a', border:'1px solid #1a1a1a', padding:14, display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
          <div>
            <div style={{ fontSize:8, letterSpacing:3, color:'#aaa', textTransform:'uppercase', marginBottom:4 }}>Previsão de Receita</div>
            <div style={{ fontSize:8, color:'#888', marginBottom:4 }}>Shows confirmados com data futura</div>
            <div style={{ fontSize:24, fontWeight:700, fontFamily:'Bebas Neue,sans-serif', color:'#fff' }}>{fmt(previsao)}</div>
          </div>
          <div>
            <div style={{ fontSize:8, letterSpacing:3, color:'#aaa', textTransform:'uppercase', marginBottom:4 }}>Meta Mensal</div>
            {editMeta ? (
              <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                <input type="number" value={metaInput} onChange={e=>setMetaInput(e.target.value)}
                  style={{ width:100, background:'#000', border:'1px solid #fff', color:'#fff', padding:'4px 8px', fontFamily:'Space Mono,monospace', fontSize:14, outline:'none' }} />
                <button onClick={() => {
                  const v = parseFloat(metaInput)||0;
                  setMeta(v); localStorage.setItem('md_meta_mensal',String(v)); setEditMeta(false);
                }} style={{ padding:'4px 10px', background:'#fff', color:'#000', border:'none', fontFamily:'Space Mono,monospace', fontSize:11, cursor:'pointer' }}>OK</button>
              </div>
            ) : (
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <div style={{ fontSize:20, fontWeight:700, color: meta>0&&previsao>=meta?'#4caf50':'#fff' }}>
                  {meta>0 ? fmt(meta) : '—'}
                </div>
                {isMaster() && (
                  <button onClick={()=>{setMetaInput(String(meta));setEditMeta(true);}} className="no-print"
                    style={{ fontSize:8, padding:'3px 8px', background:'transparent', border:'1px solid #333', color:'#aaa', fontFamily:'Space Mono,monospace', cursor:'pointer' }}>
                    Editar
                  </button>
                )}
              </div>
            )}
            {meta>0 && (
              <div style={{ fontSize:11, color:previsao>=meta?'#4caf50':'#f44336', marginTop:3 }}>
                {previsao>=meta ? '✓ Meta atingida' : `Faltam ${fmt(meta-previsao)}`}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Gráfico: Shows por Mês ───────────────────────────── */}
      <SHead title="Shows por Mês" />
      <div style={{ padding:'8px 16px 4px' }}>
        <BarChart data={showsByMonth} labelKey="label" valueKey="n" fmtTip={v=>v+' show'+(v!==1?'s':'')} />
      </div>

      {/* ── Gráfico: Receita por Estado ──────────────────────── */}
      <SHead title="Receita por Estado (shows confirmados)" />
      <div style={{ padding:'8px 16px 4px' }}>
        <BarChart data={receitaByState} labelKey="label" valueKey="receita" fmtTip={fmtShort} />
      </div>

      {/* ── Gráfico de Linha: Evolução de Receita ────────────── */}
      <SHead title="Evolução de Receita Mensal" />
      <div style={{ padding:'8px 16px 4px' }}>
        <LineChart data={receitaMensal} labelKey="label" valueKey="receita" />
      </div>

      {/* ── Gráfico de Pizza: Impacto de Custos ──────────────── */}
      <SHead title="Impacto de Custos por Categoria" />
      <div style={{ padding:'8px 16px 14px' }}>
        <PieChart data={custosByCat} nameKey="cat" valueKey="total" />
        {custosByCat.length>0 && (
          <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderTop:'1px solid #111', marginTop:10 }}>
            <span style={{ fontSize:11, color:'#aaa', letterSpacing:2, textTransform:'uppercase' }}>Total Despesas</span>
            <span style={{ fontSize:13, fontWeight:700, color:'#f44336' }}>{fmt(custosByCat.reduce((a,c)=>a+c.total,0))}</span>
          </div>
        )}
      </div>

      {/* ── Tabela: Receita × Despesa × Lucro ───────────────── */}
      <SHead title="Receita × Despesa × Lucro por Show" />
      <div style={{ padding:'0 16px 16px', overflowX:'auto' }}>
        {sortedFin.length===0 ? (
          <div style={{ color:'#888', fontSize:12, textAlign:'center', padding:'20px 0' }}>Sem dados financeiros</div>
        ) : (
          <table style={{ width:'100%', borderCollapse:'collapse', minWidth:500 }}>
            <thead>
              <tr>
                <SortTH label="Show"     col="show"    sort={sortFin} setSort={setSortFin} />
                <SortTH label="Data"     col="date"    sort={sortFin} setSort={setSortFin} style={{ textAlign:'right' }} />
                <SortTH label="Receita"  col="receita" sort={sortFin} setSort={setSortFin} style={{ textAlign:'right' }} />
                <SortTH label="Despesas" col="despesa" sort={sortFin} setSort={setSortFin} style={{ textAlign:'right' }} />
                <SortTH label="Lucro"    col="lucro"   sort={sortFin} setSort={setSortFin} style={{ textAlign:'right' }} />
                <SortTH label="Margem"   col="margem"  sort={sortFin} setSort={setSortFin} style={{ textAlign:'right' }} />
              </tr>
            </thead>
            <tbody>
              {sortedFin.map((f,i) => (
                <tr key={i} style={{ background:i%2===0?'#050505':'transparent' }}>
                  <td style={{ ...tdS, fontWeight:600 }}>{f.show}</td>
                  <td style={{ ...tdS, textAlign:'right', color:'#aaa' }}>{fmtDate(f.date)}</td>
                  <td style={{ ...tdS, textAlign:'right', color:'#4caf50' }}>{fmt(f.receita)}</td>
                  <td style={{ ...tdS, textAlign:'right', color:'#f44336' }}>{fmt(f.despesa)}</td>
                  <td style={{ ...tdS, textAlign:'right', fontWeight:700, color:f.lucro>=0?'#4caf50':'#f44336' }}>{fmt(f.lucro)}</td>
                  <td style={{ ...tdS, textAlign:'right', color:f.margem>=0?'#4caf50':'#f44336' }}>{f.margem.toFixed(1)}%</td>
                </tr>
              ))}
              <tr style={{ background:'#111', borderTop:'2px solid #222' }}>
                <td style={{ ...tdS, fontSize:11, letterSpacing:2, textTransform:'uppercase', color:'#888', fontWeight:700 }} colSpan={2}>Total</td>
                <td style={{ ...tdS, textAlign:'right', color:'#4caf50', fontWeight:700 }}>{fmt(finRows.reduce((a,f)=>a+f.receita,0))}</td>
                <td style={{ ...tdS, textAlign:'right', color:'#f44336', fontWeight:700 }}>{fmt(finRows.reduce((a,f)=>a+f.despesa,0))}</td>
                <td style={{ ...tdS, textAlign:'right', fontWeight:700, color:lucroTotal>=0?'#4caf50':'#f44336' }}>{fmt(lucroTotal)}</td>
                <td style={tdS} />
              </tr>
            </tbody>
          </table>
        )}
      </div>

      {/* ── Tabela: Equipe × Diárias ─────────────────────────── */}
      <SHead title="Equipe × Diárias" />
      <div style={{ padding:'0 16px 16px', overflowX:'auto' }}>
        {equipeRows.length===0 ? (
          <div style={{ color:'#888', fontSize:12, textAlign:'center', padding:'20px 0' }}>Sem escalações registradas</div>
        ) : (
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr>
                <th style={thS}>Membro</th>
                <th style={{ ...thS, textAlign:'right' }}>Shows Escalado</th>
                <th style={{ ...thS, textAlign:'right' }}>Total Diárias</th>
                <th style={{ ...thS, textAlign:'right' }}>Valor Diárias</th>
              </tr>
            </thead>
            <tbody>
              {equipeRows.map((m,i) => (
                <tr key={m.name} style={{ background:i%2===0?'#050505':'transparent' }}>
                  <td style={{ ...tdS, fontWeight:600 }}>{m.name}</td>
                  <td style={{ ...tdS, textAlign:'right' }}>{m.showsCount}</td>
                  <td style={{ ...tdS, textAlign:'right' }}>{m.showsCount}</td>
                  <td style={{ ...tdS, textAlign:'right', color:m.totalDiarias>0?'#fff':'#444' }}>
                    {m.totalDiarias>0 ? fmt(m.totalDiarias) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Tabela: Ranking Clientes CRM ─────────────────────── */}
      <SHead title="Ranking de Clientes (CRM)" />
      <div style={{ padding:'0 16px 16px', overflowX:'auto' }}>
        {sortedCli.length===0 ? (
          <div style={{ color:'#888', fontSize:12, textAlign:'center', padding:'20px 0' }}>Sem dados no CRM</div>
        ) : (
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr>
                <th style={thS}>Empresa</th>
                <SortTH label="Orçamentos"  col="count"   sort={sortCli} setSort={setSortCli} style={{ textAlign:'right' }} />
                <SortTH label="Receita Tot." col="receita" sort={sortCli} setSort={setSortCli} style={{ textAlign:'right' }} />
                <SortTH label="Ticket Médio" col="ticket"  sort={sortCli} setSort={setSortCli} style={{ textAlign:'right' }} />
              </tr>
            </thead>
            <tbody>
              {sortedCli.map((c,i) => (
                <tr key={c.empresa} style={{ background:i%2===0?'#050505':'transparent' }}>
                  <td style={{ ...tdS, fontWeight:600 }}>{c.empresa}</td>
                  <td style={{ ...tdS, textAlign:'right' }}>{c.count}</td>
                  <td style={{ ...tdS, textAlign:'right', color:c.receita>0?'#4caf50':'#444' }}>{c.receita>0?fmt(c.receita):'—'}</td>
                  <td style={{ ...tdS, textAlign:'right' }}>{c.ticket>0?fmt(c.ticket):'—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Tabela: Taxa de Conversão CRM ────────────────────── */}
      <SHead title="Taxa de Conversão CRM por Mês" />
      <div style={{ padding:'0 16px 24px', overflowX:'auto' }}>
        {crmConversao.length===0 ? (
          <div style={{ color:'#888', fontSize:12, textAlign:'center', padding:'20px 0' }}>Sem dados de conversão</div>
        ) : (
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr>
                <th style={thS}>Mês</th>
                <th style={{ ...thS, textAlign:'right' }}>Orçamentos</th>
                <th style={{ ...thS, textAlign:'right' }}>Convertidos</th>
                <th style={{ ...thS, textAlign:'right' }}>Taxa %</th>
              </tr>
            </thead>
            <tbody>
              {crmConversao.map((c,i) => (
                <tr key={c.mes} style={{ background:i%2===0?'#050505':'transparent' }}>
                  <td style={tdS}>{c.mes}</td>
                  <td style={{ ...tdS, textAlign:'right' }}>{c.total}</td>
                  <td style={{ ...tdS, textAlign:'right', color:'#4caf50' }}>{c.conv}</td>
                  <td style={{ ...tdS, textAlign:'right', fontWeight:700, color:parseFloat(c.taxa)>=50?'#4caf50':'#ff9800' }}>
                    {c.taxa}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
