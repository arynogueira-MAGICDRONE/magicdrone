import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../supabase';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { PageHeader } from '../components/layout/UI';

// ─── Constantes ──────────────────────────────────────────────────────────────
const MONTHS_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const MONTHS_FULL  = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const PIE_COLORS   = ['#fff','#4caf50','#f44336','#ff9800','#378ADD','#9c27b0','#00bcd4','#ff5722','#8bc34a','#ffc107','#607d8b','#e91e63'];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmt(v) { return 'R$ '+(v||0).toFixed(2).replace('.',',').replace(/\B(?=(\d{3})+(?!\d))/g,'.'); }
function fmtShort(v) {
  if ((v||0)>=1000000) return 'R$'+(v/1000000).toFixed(1)+'M';
  if ((v||0)>=1000)    return 'R$'+(v/1000).toFixed(1)+'k';
  return fmt(v);
}
function fmtPct(v) { return (v||0).toFixed(1)+'%'; }
function fmtDate(s) { if (!s) return '—'; const [y,m,d]=s.split('-'); return `${d}/${m}/${y}`; }
function todayStr() { const d=new Date(),p=n=>n<10?'0'+n:n; return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`; }
function padMonth(n) { return String(n).padStart(2,'0'); }

const selS = { background:'#000', border:'1px solid #333', color:'#fff', padding:'7px 10px', fontFamily:'Space Mono,monospace', fontSize:14, outline:'none' };
const thS  = { fontSize:13, letterSpacing:1, color:'#bbb', textTransform:'uppercase', padding:'8px 10px', borderBottom:'1px solid #1a1a1a', textAlign:'left', background:'#050505', whiteSpace:'nowrap' };
const tdS  = { fontSize:14, padding:'8px 10px', borderBottom:'1px solid #0d0d0d' };

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KPICard({ label, value, sub, color='#fff', badge }) {
  return (
    <div style={{ background:'#0a0a0a', border:'1px solid #1a1a1a', padding:'12px 14px', minHeight:72 }}>
      <div style={{ fontSize:11, letterSpacing:2, color:'#bbb', textTransform:'uppercase', marginBottom:6 }}>{label}</div>
      <div style={{ fontSize:20, fontWeight:700, fontFamily:'Bebas Neue,sans-serif', color, letterSpacing:1 }}>{value}</div>
      {sub   && <div style={{ fontSize:12, color:'#888', marginTop:3 }}>{sub}</div>}
      {badge && <div style={{ fontSize:11, letterSpacing:1, marginTop:4, padding:'2px 7px', border:'1px solid #333', color:'#aaa', display:'inline-block', textTransform:'uppercase' }}>{badge}</div>}
    </div>
  );
}

// ─── Multi-Line Chart ─────────────────────────────────────────────────────────
function MultiLineChart({ data, height=150 }) {
  const [hov, setHov] = useState(null);
  const series = [
    { key:'receita', color:'#fff',    label:'Receita' },
    { key:'despesa', color:'#f44336', label:'Despesa' },
    { key:'lucro',   color:'#4caf50', label:'Lucro' },
  ];
  if (!data.length) return null;
  const allV = data.flatMap(d => series.map(s => d[s.key]||0));
  const maxV = Math.max(...allV, 1);
  const minV = Math.min(...allV, 0);
  const range = maxV - minV || 1;
  const padL=52, padR=8, padT=18, padB=26;
  const W = Math.max(data.length*40+padL+padR, 300);
  const xOf = i => padL + i*(W-padL-padR)/(data.length-1||1);
  const yOf = v => padT + height - ((v-minV)/range)*height;

  return (
    <div>
      <div style={{ display:'flex', gap:16, marginBottom:8, flexWrap:'wrap' }}>
        {series.map(s=>(
          <div key={s.key} style={{ display:'flex', alignItems:'center', gap:6 }}>
            <div style={{ width:20, height:2, background:s.color }}/>
            <span style={{ fontSize:12, color:'#aaa' }}>{s.label}</span>
          </div>
        ))}
      </div>
      <div style={{ overflowX:'auto' }}>
        <svg width={W} height={height+padT+padB} style={{ display:'block' }}>
          {[0,0.25,0.5,0.75,1].map(f=>{
            const v = minV + f*range, y = padT + height - f*height;
            return (
              <g key={f}>
                <line x1={padL} y1={y} x2={W-padR} y2={y} stroke="#111" strokeWidth={1}/>
                <text x={padL-4} y={y+4} textAnchor="end" fill="#555" fontSize={9} fontFamily="Space Mono,monospace">{fmtShort(v)}</text>
              </g>
            );
          })}
          {series.map(s=>{
            const pts = data.map((d,i)=>({x:xOf(i),y:yOf(d[s.key]||0),v:d[s.key]||0,label:d.label}));
            const poly = pts.map(p=>`${p.x},${p.y}`).join(' ');
            return (
              <g key={s.key}>
                <polyline points={poly} fill="none" stroke={s.color} strokeWidth={2} opacity={0.85}/>
                {pts.map((p,i)=>(
                  <g key={i} onMouseEnter={()=>setHov({s:s.key,i})} onMouseLeave={()=>setHov(null)}>
                    <circle cx={p.x} cy={p.y} r={hov?.s===s.key&&hov?.i===i?6:3} fill={s.color} stroke="#000" strokeWidth={1.5}/>
                    {hov?.s===s.key&&hov?.i===i&&(
                      <text x={p.x} y={p.y-10} textAnchor="middle" fill="#fff" fontSize={10} fontFamily="Space Mono,monospace">{fmtShort(p.v)}</text>
                    )}
                  </g>
                ))}
              </g>
            );
          })}
          {data.map((d,i)=>(
            <text key={i} x={xOf(i)} y={height+padT+padB-4} textAnchor="middle" fill="#aaa" fontSize={10} fontFamily="Space Mono,monospace">{d.label}</text>
          ))}
          <line x1={padL} y1={padT} x2={padL} y2={height+padT} stroke="#1a1a1a" strokeWidth={1}/>
          <line x1={padL} y1={height+padT} x2={W-padR} y2={height+padT} stroke="#1a1a1a" strokeWidth={1}/>
        </svg>
      </div>
    </div>
  );
}

// ─── Bar Chart ────────────────────────────────────────────────────────────────
function BarChart({ data, labelKey='label', valueKey='n', fmtTip, color='#fff', height=130 }) {
  const [hov, setHov] = useState(null);
  if (!data.length || data.every(d=>!d[valueKey]))
    return <div style={{ textAlign:'center', padding:'16px 0', color:'#555', fontSize:13 }}>Sem dados</div>;
  const maxV = Math.max(...data.map(d=>d[valueKey]||0),1);
  const barW  = Math.max(16, Math.min(38, Math.floor(260/data.length)));
  const gap=4, padL=4, padT=22, padB=24;
  const totalW = data.length*(barW+gap)+padL;
  return (
    <div style={{ overflowX:'auto' }}>
      <svg width={Math.max(totalW,280)} height={height+padT+padB} style={{ display:'block' }}>
        {[0,0.25,0.5,0.75,1].map(f=>{
          const y = padT+height-f*height;
          return <line key={f} x1={padL} y1={y} x2={totalW} y2={y} stroke="#111" strokeWidth={1}/>;
        })}
        {data.map((d,i)=>{
          const val=d[valueKey]||0, bH=(val/maxV)*height;
          const x=padL+i*(barW+gap), y=padT+height-bH;
          return (
            <g key={i} onMouseEnter={()=>setHov(i)} onMouseLeave={()=>setHov(null)}>
              <rect x={x} y={y} width={barW} height={bH||1} fill={hov===i?'#ddd':color} style={{ transition:'fill 0.1s' }}/>
              {hov===i&&val>0&&(
                <text x={x+barW/2} y={Math.max(y-5,padT-2)} textAnchor="middle" fill="#fff" fontSize={9} fontFamily="Space Mono,monospace">{fmtTip?fmtTip(val):val}</text>
              )}
              <text x={x+barW/2} y={height+padT+padB-4} textAnchor="middle" fill="#aaa" fontSize={9} fontFamily="Space Mono,monospace">{d[labelKey]}</text>
            </g>
          );
        })}
        <line x1={padL} y1={padT} x2={padL} y2={height+padT} stroke="#1a1a1a" strokeWidth={1}/>
        <line x1={padL} y1={height+padT} x2={totalW} y2={height+padT} stroke="#1a1a1a" strokeWidth={1}/>
      </svg>
    </div>
  );
}

// ─── Pie Chart ────────────────────────────────────────────────────────────────
function PieChart({ data, nameKey='cat', valueKey='total' }) {
  const [hov, setHov] = useState(null);
  const total = data.reduce((a,d)=>a+d[valueKey],0);
  if (!data.length||total===0)
    return <div style={{ textAlign:'center', padding:'16px 0', color:'#555', fontSize:13 }}>Sem dados</div>;
  const r=48,cx=60,cy=60,circ=2*Math.PI*r;
  let offset=0;
  const segs = data.map((d,i)=>{
    const frac=d[valueKey]/total, dash=frac*circ, angle=-90+(offset/circ)*360;
    const seg={ ...d, frac, dash, angle, color:PIE_COLORS[i%PIE_COLORS.length] };
    offset+=dash; return seg;
  });
  return (
    <div style={{ display:'flex', alignItems:'flex-start', gap:20, flexWrap:'wrap' }}>
      <svg width={120} height={120} style={{ flexShrink:0 }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#111" strokeWidth={22}/>
        {segs.map((seg,i)=>(
          <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={seg.color}
            strokeWidth={hov===i?26:22}
            strokeDasharray={`${seg.dash} ${circ}`}
            style={{ transform:`rotate(${seg.angle}deg)`, transformOrigin:`${cx}px ${cy}px`, transition:'stroke-width 0.15s', cursor:'default' }}
            onMouseEnter={()=>setHov(i)} onMouseLeave={()=>setHov(null)}/>
        ))}
      </svg>
      <div style={{ flex:1, minWidth:140, maxHeight:160, overflowY:'auto' }}>
        {segs.slice(0,10).map((seg,i)=>(
          <div key={i} style={{ display:'flex', alignItems:'center', gap:6, marginBottom:5, opacity:hov!==null&&hov!==i?0.35:1, transition:'opacity 0.15s', cursor:'default' }}
            onMouseEnter={()=>setHov(i)} onMouseLeave={()=>setHov(null)}>
            <div style={{ width:8, height:8, background:seg.color, flexShrink:0 }}/>
            <span style={{ fontSize:12, color:'#ccc', flex:1 }}>{seg[nameKey]}</span>
            <span style={{ fontSize:12, color:'#aaa', whiteSpace:'nowrap' }}>{fmtPct(seg.frac*100)}</span>
            <span style={{ fontSize:11, color:'#666', whiteSpace:'nowrap', marginLeft:4 }}>{fmtShort(seg[valueKey])}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Funnel Chart ─────────────────────────────────────────────────────────────
function FunnelChart({ data }) {
  if (!data.length) return null;
  const maxVal = Math.max(...data.map(d=>d.value),1);
  const W=260, H=38, GAP=4;
  return (
    <div style={{ overflowX:'auto' }}>
      <svg width={W+100} height={data.length*(H+GAP)} style={{ display:'block' }}>
        {data.map((d,i)=>{
          const pct=d.value/maxVal, barW=Math.max(pct*W,20);
          const x=(W-barW)/2, y=i*(H+GAP);
          const prevPct = i>0 ? data[i-1].value/maxVal : null;
          const convPct = prevPct && data[i-1].value>0 ? (d.value/data[i-1].value*100).toFixed(0)+'%' : null;
          return (
            <g key={i}>
              <rect x={x} y={y} width={barW} height={H} fill={d.color} opacity={0.85} rx={2}/>
              <text x={W/2} y={y+H/2+5} textAnchor="middle" fill="#000" fontSize={13} fontWeight={700} fontFamily="Space Mono,monospace">{d.label} ({d.value})</text>
              {convPct&&(
                <text x={W+55} y={y-2} textAnchor="middle" fill="#888" fontSize={11} fontFamily="Space Mono,monospace">↓ {convPct}</text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ─── Section title ────────────────────────────────────────────────────────────
function SHead({ title, action }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', fontSize:13, letterSpacing:2, color:'#bbb', textTransform:'uppercase', padding:'18px 16px 8px', borderTop:'1px solid #111' }}>
      <span>{title}</span>
      {action}
    </div>
  );
}

// ─── Componente Principal ─────────────────────────────────────────────────────
export default function Relatorios() {
  const { shows, members, scaling, loadAllScaling } = useApp();
  const { isMaster } = useAuth();

  const [orcamento,   setOrcamento]   = useState([]);
  const [crmData,     setCrmData]     = useState([]);
  const [loaded,      setLoaded]      = useState(false);

  // Meta mensal
  const [meta,      setMeta]      = useState(() => parseFloat(localStorage.getItem('md_meta_mensal')||'0'));
  const [editMeta,  setEditMeta]  = useState(false);
  const [metaInput, setMetaInput] = useState('');

  // Filtros globais
  const [filterYear,  setFilterYear]  = useState(String(new Date().getFullYear()));
  const [filterState, setFilterState] = useState('');

  // Relatório rápido ativo
  const [activeReport, setActiveReport] = useState('overview');

  // Análise personalizada
  const [axisX,      setAxisX]      = useState('mes');
  const [axisY,      setAxisY]      = useState('receita');
  const [groupBy,    setGroupBy]    = useState('none');
  const [dateFr,     setDateFr]     = useState('');
  const [dateTo,     setDateTo]     = useState('');
  const [custState,  setCustState]  = useState('');
  const [custResult, setCustResult] = useState(null);

  // ── Carga de dados ──────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      await loadAllScaling();
      const [oRes, cRes] = await Promise.all([
        supabase.from('orcamento').select('id,show_id,categoria,previsto,realizado'),
        supabase.from('crm').select('id,status,created_at'),
      ]);
      if (oRes.data) setOrcamento(oRes.data);
      if (cRes.data) setCrmData(cRes.data);
      setLoaded(true);
    }
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived ─────────────────────────────────────────────────────
  const today         = todayStr();
  const curYear       = new Date().getFullYear();
  const curMonth      = new Date().getMonth(); // 0-based
  const monthStr      = `${curYear}-${padMonth(curMonth+1)}`;

  const years  = useMemo(()=>[...new Set(shows.map(s=>s.date?.slice(0,4)).filter(Boolean))].sort().reverse(),[shows]);
  const states = useMemo(()=>[...new Set(shows.map(s=>s.state).filter(Boolean))].sort(),[shows]);

  // Shows filtrados pelo ano/estado selecionado
  const filteredShows = useMemo(()=>shows.filter(s=>{
    if (filterYear  && !s.date?.startsWith(filterYear))  return false;
    if (filterState && s.state !== filterState)           return false;
    return true;
  }),[shows,filterYear,filterState]);

  // IDs dos shows filtrados
  const filteredIds = useMemo(()=>new Set(filteredShows.map(s=>String(s.id))),[filteredShows]);

  // Orçamento filtrado
  const filteredOrc = useMemo(()=>orcamento.filter(i=>filteredIds.has(String(i.show_id))),[orcamento,filteredIds]);

  // ── KPIs Financeiros ────────────────────────────────────────────
  const receitaTotal = useMemo(()=>
    filteredShows.filter(s=>['exec','conf'].includes(s.status))
      .reduce((a,s)=>a+(s.valor||0),0),[filteredShows]);

  const despesaTotal = useMemo(()=>
    filteredOrc.reduce((a,i)=>a+(i.realizado||0),0),[filteredOrc]);

  const lucroTotal = receitaTotal - despesaTotal;
  const margem     = receitaTotal>0 ? lucroTotal/receitaTotal*100 : 0;

  const realizadoMes = useMemo(()=>
    shows.filter(s=>s.date?.startsWith(monthStr)&&(s.valor||0)>0)
      .reduce((a,s)=>a+(s.valor||0),0),[shows,monthStr]);

  // ── KPIs Operacionais ───────────────────────────────────────────
  const showsRealizados = filteredShows.filter(s=>s.status==='exec').length;
  const showsFuturos    = shows.filter(s=>s.status==='conf'&&s.date>=today).length;
  const taxaCRM         = crmData.length>0 ? crmData.filter(c=>c.status==='confirmado').length/crmData.length*100 : 0;

  const stateMap = useMemo(()=>{
    const m={};
    filteredShows.forEach(s=>{ if(s.state) m[s.state]=(m[s.state]||0)+1; });
    return m;
  },[filteredShows]);
  const topState = Object.entries(stateMap).sort((a,b)=>b[1]-a[1])[0];

  // ── KPIs Equipe ─────────────────────────────────────────────────
  const memberScaleMap = useMemo(()=>{
    const m={};
    Object.values(scaling).flat().forEach(sc=>{ m[sc.memberId]=(m[sc.memberId]||0)+1; });
    return m;
  },[scaling]);
  const topMemberEntry = Object.entries(memberScaleMap).sort((a,b)=>b[1]-a[1])[0];
  const topMember      = members.find(m=>m.id===topMemberEntry?.[0]);

  const monthShowIds = useMemo(()=>new Set(shows.filter(s=>s.date?.startsWith(monthStr)).map(s=>String(s.id))),[shows,monthStr]);
  const diariasMonth = useMemo(()=>
    orcamento.filter(i=>monthShowIds.has(String(i.show_id))&&(i.categoria?.startsWith('Diária -')||i.categoria?.startsWith('Meia Diária -')))
      .reduce((a,i)=>a+(i.realizado||0),0),[orcamento,monthShowIds]);

  // ── Chart Data ──────────────────────────────────────────────────
  const monthlyData = useMemo(()=>MONTHS_SHORT.map((label,mi)=>{
    const prefix=`${filterYear||curYear}-${padMonth(mi+1)}`;
    const ms=shows.filter(s=>s.date?.startsWith(prefix));
    const receita=ms.reduce((a,s)=>a+(s.valor||0),0);
    const ids=new Set(ms.map(s=>String(s.id)));
    const despesa=orcamento.filter(i=>ids.has(String(i.show_id))).reduce((a,i)=>a+(i.realizado||0),0);
    return { label, receita, despesa, lucro:receita-despesa, n:ms.length };
  }),[shows,orcamento,filterYear]);

  const stateBarData = useMemo(()=>
    Object.entries(stateMap).map(([label,n])=>({label,n})).sort((a,b)=>b.n-a.n).slice(0,12),
    [stateMap]);

  const costData = useMemo(()=>{
    const m={};
    filteredOrc.forEach(i=>{ if((i.realizado||0)>0) m[i.categoria]=(m[i.categoria]||0)+i.realizado; });
    return Object.entries(m).map(([cat,total])=>({cat,total})).sort((a,b)=>b.total-a.total);
  },[filteredOrc]);

  const funnelData = useMemo(()=>[
    { label:'Orçamento',  value: crmData.filter(c=>!c.status||c.status==='orcamento').length,  color:'#ff9800' },
    { label:'Negociando', value: crmData.filter(c=>c.status==='negociando').length,             color:'#ffeb3b' },
    { label:'Confirmado', value: crmData.filter(c=>c.status==='confirmado').length + shows.filter(s=>s.status==='exec').length, color:'#4caf50' },
    { label:'Executado',  value: shows.filter(s=>s.status==='exec').length,                    color:'#888' },
  ],[crmData,shows]);

  // ── Relatórios Rápidos ──────────────────────────────────────────
  const clienteRanking = useMemo(()=>{
    const m={};
    filteredShows.filter(s=>s.valor>0).forEach(s=>{
      if(!m[s.client]) m[s.client]={label:s.client,receita:0,n:0};
      m[s.client].receita+=(s.valor||0); m[s.client].n++;
    });
    return Object.values(m).sort((a,b)=>b.receita-a.receita).slice(0,10);
  },[filteredShows]);

  const sazonalidadeData = useMemo(()=>{
    const m={};
    shows.filter(s=>s.date).forEach(s=>{
      const mi=parseInt(s.date.slice(5,7))-1;
      m[mi]=(m[mi]||0)+1;
    });
    return MONTHS_SHORT.map((label,i)=>({label,n:m[i]||0}));
  },[shows]);

  const equipeData = useMemo(()=>members.map(m=>{
    const sc=Object.values(scaling).flat().filter(s=>s.memberId===m.id).length;
    const diarias=orcamento.filter(i=>(i.categoria?.includes(m.name))&&(i.categoria?.startsWith('Diária -')||i.categoria?.startsWith('Meia Diária -')))
      .reduce((a,i)=>a+(i.realizado||0),0);
    return { label:m.name, n:sc, diarias };
  }).filter(m=>m.n>0).sort((a,b)=>b.n-a.n),[members,scaling,orcamento]);

  const custosPorCat = useMemo(()=>costData.slice(0,10),[costData]);

  const stateTableData = useMemo(()=>{
    const m={};
    filteredShows.forEach(s=>{
      if(!s.state) return;
      if(!m[s.state]) m[s.state]={state:s.state,n:0,receita:0,despesa:0};
      m[s.state].n++;
      m[s.state].receita+=(s.valor||0);
    });
    const ids={};
    filteredShows.forEach(s=>{ if(s.state) ids[s.state]=(ids[s.state]||new Set()).add(String(s.id)); });
    Object.entries(ids).forEach(([st,set])=>{
      m[st].despesa=orcamento.filter(i=>set.has(String(i.show_id))).reduce((a,i)=>a+(i.realizado||0),0);
    });
    return Object.values(m).sort((a,b)=>b.n-a.n);
  },[filteredShows,orcamento]);

  // ── Análise Personalizada ───────────────────────────────────────
  function gerarAnalise() {
    const scope = shows.filter(s=>{
      if(dateFr && s.date < dateFr) return false;
      if(dateTo && s.date > dateTo) return false;
      if(custState && s.state !== custState) return false;
      return true;
    });
    const scopeIds = new Set(scope.map(s=>String(s.id)));
    const scopeOrc = orcamento.filter(i=>scopeIds.has(String(i.show_id)));

    // Build axis X groups
    const groups={};
    const addGroup=(key,show)=>{
      if(!groups[key]) groups[key]={label:key,receita:0,despesa:0,lucro:0,n:0,diarias:0};
      groups[key].receita+=(show.valor||0);
      groups[key].n++;
    };
    scope.forEach(s=>{
      let key='—';
      if(axisX==='mes')     key=MONTHS_SHORT[parseInt((s.date||'').slice(5,7))-1]||'—';
      if(axisX==='estado')  key=s.state||'—';
      if(axisX==='cliente') key=s.client||'—';
      if(axisX==='status')  key=s.status||'—';
      addGroup(key,s);
    });
    // Add despesa/lucro
    scopeOrc.forEach(i=>{
      const show=scope.find(s=>String(s.id)===String(i.show_id));
      if(!show) return;
      let key='—';
      if(axisX==='mes')     key=MONTHS_SHORT[parseInt((show.date||'').slice(5,7))-1]||'—';
      if(axisX==='estado')  key=show.state||'—';
      if(axisX==='cliente') key=show.client||'—';
      if(axisX==='status')  key=show.status||'—';
      if(!groups[key]) return;
      groups[key].despesa+=(i.realizado||0);
      if(i.categoria?.startsWith('Diária -')||i.categoria?.startsWith('Meia Diária -'))
        groups[key].diarias+=(i.realizado||0);
    });
    Object.values(groups).forEach(g=>{ g.lucro=g.receita-g.despesa; });

    const sorted = Object.values(groups).sort((a,b)=>{
      if(axisX==='mes') return MONTHS_SHORT.indexOf(a.label)-MONTHS_SHORT.indexOf(b.label);
      return b[axisY]-a[axisY];
    });
    setCustResult(sorted);
  }

  function exportCustomExcel() {
    if(!custResult) return;
    const wb=XLSX.utils.book_new();
    const rows=[
      [`Análise: ${axisX} × ${axisY}`],[''],
      ['Grupo','Receita','Despesa','Lucro','Shows','Diárias'],
      ...custResult.map(r=>[r.label,r.receita,r.despesa,r.lucro,r.n,r.diarias]),
    ];
    const ws=XLSX.utils.aoa_to_sheet(rows);
    ws['!cols']=[{wch:28},{wch:16},{wch:16},{wch:16},{wch:10},{wch:14}];
    XLSX.utils.book_append_sheet(wb,ws,'Análise');
    XLSX.writeFile(wb,`analise-${axisX}-${axisY}.xlsx`);
  }

  // ── Export Excel global ─────────────────────────────────────────
  function exportExcel() {
    const wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['KPI','Valor'],
      ['Receita Total',receitaTotal],['Despesa Total',despesaTotal],['Lucro Líquido',lucroTotal],
      ['Margem %',margem.toFixed(1)+'%'],['Shows Realizados',showsRealizados],
      ['Shows Confirmados',showsFuturos],['Taxa Conversão CRM %',taxaCRM.toFixed(1)+'%'],
    ]),'KPIs');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['Mês','Receita','Despesa','Lucro','Shows'],
      ...monthlyData.map(d=>[d.label,d.receita,d.despesa,d.lucro,d.n]),
    ]),'Por Mês');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['Estado','Shows','Receita','Despesa'],
      ...stateTableData.map(d=>[d.state,d.n,d.receita,d.despesa]),
    ]),'Por Estado');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['Cliente','Receita','Shows'],
      ...clienteRanking.map(d=>[d.label,d.receita,d.n]),
    ]),'Clientes');
    XLSX.writeFile(wb,'magicdrone-relatorios.xlsx');
  }

  if (!loaded) return (
    <div style={{ textAlign:'center', padding:'60px 16px', color:'#aaa', fontSize:13, letterSpacing:3, textTransform:'uppercase' }}>
      Carregando dados...
    </div>
  );

  const QUICK_REPORTS=[
    { key:'overview',      label:'Overview' },
    { key:'porMes',        label:'Por Mês' },
    { key:'porEstado',     label:'Por Estado' },
    { key:'porCliente',    label:'Por Cliente' },
    { key:'sazonalidade',  label:'Sazonalidade' },
    { key:'equipe',        label:'Equipe' },
    { key:'custos',        label:'Custos' },
  ];

  return (
    <div id="relatorios-root">

      {/* ── Filtros globais + Export ──────────────────────────── */}
      <div style={{ padding:'10px 16px', background:'#050505', borderBottom:'1px solid #111', display:'flex', flexWrap:'wrap', gap:6, alignItems:'center' }}>
        <select value={filterYear}  onChange={e=>setFilterYear(e.target.value)}  style={selS}>
          <option value="">Todos os anos</option>
          {years.map(y=><option key={y} value={y}>{y}</option>)}
        </select>
        <select value={filterState} onChange={e=>setFilterState(e.target.value)} style={selS}>
          <option value="">Todos os estados</option>
          {states.map(s=><option key={s} value={s}>{s}</option>)}
        </select>
        {(filterYear||filterState) && (
          <button onClick={()=>{setFilterYear(String(curYear));setFilterState('');}}
            style={{ ...selS, cursor:'pointer', color:'#f44336', borderColor:'#f44336' }}>✕ Limpar</button>
        )}
        <div style={{ marginLeft:'auto', display:'flex', gap:6 }}>
          <button onClick={()=>window.print()} style={{ ...selS, cursor:'pointer', color:'#aaa' }}>⎙ PDF</button>
          <button onClick={exportExcel}         style={{ ...selS, cursor:'pointer', color:'#4caf50', borderColor:'#4caf50' }}>↓ Excel</button>
        </div>
      </div>

      <PageHeader label="Módulo" title="Relatórios" />

      {/* ── KPI Linha 1 — Financeiro ─────────────────────────── */}
      <SHead title="Financeiro" />
      <div style={{ padding:'0 16px 14px', display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:8 }}>
        <KPICard label="Receita Total"   value={fmtShort(receitaTotal)} color="#fff" />
        <KPICard label="Total Despesas"  value={fmtShort(despesaTotal)} color="#f44336" />
        <KPICard label="Lucro Líquido"   value={fmtShort(lucroTotal)}   color={lucroTotal>=0?'#4caf50':'#f44336'} />
        <KPICard label="Margem Média"    value={fmtPct(margem)}         color={margem>=20?'#4caf50':margem>=5?'#ff9800':'#f44336'} />
        <div style={{ background:'#0a0a0a', border:'1px solid #1a1a1a', padding:'12px 14px', gridColumn:'span 1' }}>
          <div style={{ fontSize:11, letterSpacing:2, color:'#bbb', textTransform:'uppercase', marginBottom:6 }}>Meta Mensal</div>
          {editMeta ? (
            <div style={{ display:'flex', gap:6, alignItems:'center' }}>
              <input type="number" value={metaInput} onChange={e=>setMetaInput(e.target.value)}
                style={{ flex:1, background:'#000', border:'1px solid #fff', color:'#fff', padding:'4px 6px', fontFamily:'Space Mono,monospace', fontSize:13, outline:'none' }}/>
              <button onClick={()=>{ const v=parseFloat(metaInput)||0; setMeta(v); localStorage.setItem('md_meta_mensal',String(v)); setEditMeta(false); }}
                style={{ padding:'4px 8px', background:'#fff', color:'#000', border:'none', fontFamily:'Space Mono,monospace', fontSize:12, cursor:'pointer' }}>OK</button>
            </div>
          ) : (
            <>
              <div style={{ fontSize:20, fontWeight:700, fontFamily:'Bebas Neue,sans-serif', color:meta>0&&realizadoMes>=meta?'#4caf50':'#fff' }}>
                {meta>0?fmtShort(meta):'—'}
              </div>
              <div style={{ fontSize:12, color:'#888', marginTop:2 }}>Realizado: {fmtShort(realizadoMes)}</div>
              {meta>0&&<div style={{ fontSize:11, color:realizadoMes>=meta?'#4caf50':'#ff9800', marginTop:2 }}>
                {realizadoMes>=meta?'✓ Meta atingida':`Faltam ${fmtShort(meta-realizadoMes)}`}
              </div>}
              {isMaster()&&<button onClick={()=>{setMetaInput(String(meta));setEditMeta(true);}}
                style={{ marginTop:4, fontSize:11, padding:'2px 7px', background:'transparent', border:'1px solid #333', color:'#aaa', fontFamily:'Space Mono,monospace', cursor:'pointer' }}>Editar</button>}
            </>
          )}
        </div>
      </div>

      {/* ── KPI Linha 2 — Operacional ────────────────────────── */}
      <SHead title="Operacional" />
      <div style={{ padding:'0 16px 14px', display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:8 }}>
        <KPICard label="Shows Realizados"   value={showsRealizados}   sub="status executado" />
        <KPICard label="Shows Confirmados"  value={showsFuturos}      sub="datas futuras" color="#4caf50" />
        <KPICard label="Conversão CRM"      value={fmtPct(taxaCRM)}   sub={`${crmData.filter(c=>c.status==='confirmado').length} de ${crmData.length}`} color="#378ADD"/>
        <KPICard label="Top Estado"
          value={topState?.[0]||'—'}
          sub={topState?`${topState[1]} show${topState[1]!==1?'s':''}`:undefined}/>
      </div>

      {/* ── KPI Linha 3 — Equipe ─────────────────────────────── */}
      <SHead title="Equipe" />
      <div style={{ padding:'0 16px 14px', display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:8 }}>
        <KPICard label="Mais Escalado"
          value={topMember?.name?.split(' ')[0]||'—'}
          sub={topMemberEntry?`${topMemberEntry[1]} shows`:undefined}
          color="#fff"/>
        <KPICard label="Diárias do Mês"  value={fmtShort(diariasMonth)} color="#ff9800" sub={MONTHS_FULL[curMonth]} />
        <KPICard label="Equipe Cadastrada" value={members.length} sub="membros ativos" />
        <KPICard label="Total Escalações" value={Object.values(scaling).flat().length} />
      </div>

      {/* ── Relatórios Rápidos — abas ────────────────────────── */}
      <SHead title="Relatórios Rápidos" />
      <div style={{ padding:'0 16px', display:'flex', gap:4, flexWrap:'wrap', marginBottom:14 }}>
        {QUICK_REPORTS.map(r=>(
          <button key={r.key} onClick={()=>setActiveReport(r.key)} style={{
            padding:'7px 12px', fontFamily:'Space Mono,monospace', fontSize:12, letterSpacing:1, textTransform:'uppercase', cursor:'pointer',
            border:`1px solid ${activeReport===r.key?'#fff':'#333'}`,
            background:activeReport===r.key?'#fff':'transparent',
            color:activeReport===r.key?'#000':'#bbb',
          }}>{r.label}</button>
        ))}
      </div>

      {/* ── Conteúdo do relatório rápido ─────────────────────── */}
      <div style={{ padding:'0 16px 16px' }}>

        {/* Overview */}
        {activeReport==='overview' && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
            <div>
              <div style={{ fontSize:13, color:'#bbb', letterSpacing:2, textTransform:'uppercase', marginBottom:8 }}>Receita × Despesa × Lucro</div>
              <MultiLineChart data={monthlyData} />
            </div>
            <div>
              <div style={{ fontSize:13, color:'#bbb', letterSpacing:2, textTransform:'uppercase', marginBottom:8 }}>Funil CRM</div>
              <FunnelChart data={funnelData} />
            </div>
            <div>
              <div style={{ fontSize:13, color:'#bbb', letterSpacing:2, textTransform:'uppercase', marginBottom:8 }}>Shows por Estado</div>
              <BarChart data={stateBarData} labelKey="label" valueKey="n" color="#fff"/>
            </div>
            <div>
              <div style={{ fontSize:13, color:'#bbb', letterSpacing:2, textTransform:'uppercase', marginBottom:8 }}>Distribuição de Custos</div>
              <PieChart data={costData} nameKey="cat" valueKey="total"/>
            </div>
          </div>
        )}

        {/* Por Mês */}
        {activeReport==='porMes' && (
          <>
            <div style={{ fontSize:13, color:'#bbb', letterSpacing:2, textTransform:'uppercase', marginBottom:12 }}>Receita × Despesa × Lucro por Mês</div>
            <MultiLineChart data={monthlyData} height={180} />
            <div style={{ marginTop:20, overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', minWidth:400 }}>
                <thead>
                  <tr>
                    {['Mês','Shows','Receita','Despesa','Lucro'].map(h=><th key={h} style={thS}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {monthlyData.map((d,i)=>(
                    <tr key={i} style={{ background:i%2===0?'#050505':'transparent' }}>
                      <td style={tdS}>{d.label}</td>
                      <td style={tdS}>{d.n}</td>
                      <td style={{ ...tdS, color:'#4caf50' }}>{d.receita>0?fmt(d.receita):'—'}</td>
                      <td style={{ ...tdS, color:'#f44336' }}>{d.despesa>0?fmt(d.despesa):'—'}</td>
                      <td style={{ ...tdS, color:d.lucro>=0?'#4caf50':'#f44336', fontWeight:700 }}>{d.receita>0||d.despesa>0?fmt(d.lucro):'—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Por Estado */}
        {activeReport==='porEstado' && (
          <>
            <div style={{ fontSize:13, color:'#bbb', letterSpacing:2, textTransform:'uppercase', marginBottom:12 }}>Performance por Estado</div>
            <BarChart data={stateBarData} labelKey="label" valueKey="n" color="#378ADD"/>
            <div style={{ marginTop:20, overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr>{['Estado','Shows','Receita','Despesa','Lucro'].map(h=><th key={h} style={thS}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {stateTableData.map((d,i)=>(
                    <tr key={d.state} style={{ background:i%2===0?'#050505':'transparent' }}>
                      <td style={{ ...tdS, fontWeight:700 }}>{d.state}</td>
                      <td style={tdS}>{d.n}</td>
                      <td style={{ ...tdS, color:'#4caf50' }}>{d.receita>0?fmt(d.receita):'—'}</td>
                      <td style={{ ...tdS, color:'#f44336' }}>{d.despesa>0?fmt(d.despesa):'—'}</td>
                      <td style={{ ...tdS, color:d.receita-d.despesa>=0?'#4caf50':'#f44336', fontWeight:700 }}>{fmt(d.receita-d.despesa)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Por Cliente */}
        {activeReport==='porCliente' && (
          <>
            <div style={{ fontSize:13, color:'#bbb', letterSpacing:2, textTransform:'uppercase', marginBottom:12 }}>Ranking de Clientes por Receita</div>
            <BarChart data={clienteRanking} labelKey="label" valueKey="receita" fmtTip={fmtShort} color="#ff9800"/>
            <div style={{ marginTop:20, overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead><tr>{['Cliente','Shows','Receita','Ticket Médio'].map(h=><th key={h} style={thS}>{h}</th>)}</tr></thead>
                <tbody>
                  {clienteRanking.map((c,i)=>(
                    <tr key={c.label} style={{ background:i%2===0?'#050505':'transparent' }}>
                      <td style={{ ...tdS, fontWeight:600 }}>{c.label}</td>
                      <td style={tdS}>{c.n}</td>
                      <td style={{ ...tdS, color:'#4caf50' }}>{fmt(c.receita)}</td>
                      <td style={tdS}>{fmt(c.receita/c.n)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Sazonalidade */}
        {activeReport==='sazonalidade' && (
          <>
            <div style={{ fontSize:13, color:'#bbb', letterSpacing:2, textTransform:'uppercase', marginBottom:12 }}>Shows por Mês (histórico total)</div>
            <BarChart data={sazonalidadeData} labelKey="label" valueKey="n" color="#9c27b0"/>
            <div style={{ marginTop:16, display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:6 }}>
              {sazonalidadeData.map(d=>(
                <div key={d.label} style={{ background:'#0a0a0a', border:'1px solid #1a1a1a', padding:'8px 10px', textAlign:'center' }}>
                  <div style={{ fontSize:14, fontWeight:700, color: d.n===Math.max(...sazonalidadeData.map(x=>x.n))?'#fff':'#aaa' }}>{d.n}</div>
                  <div style={{ fontSize:11, color:'#666', textTransform:'uppercase', letterSpacing:1, marginTop:2 }}>{d.label}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Equipe */}
        {activeReport==='equipe' && (
          <>
            <div style={{ fontSize:13, color:'#bbb', letterSpacing:2, textTransform:'uppercase', marginBottom:12 }}>Shows e Diárias por Membro</div>
            <BarChart data={equipeData} labelKey="label" valueKey="n" color="#4caf50"/>
            <div style={{ marginTop:20, overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead><tr>{['Membro','Shows Escalado','Diárias (R$)'].map(h=><th key={h} style={thS}>{h}</th>)}</tr></thead>
                <tbody>
                  {equipeData.map((m,i)=>(
                    <tr key={m.label} style={{ background:i%2===0?'#050505':'transparent' }}>
                      <td style={{ ...tdS, fontWeight:600 }}>{m.label}</td>
                      <td style={tdS}>{m.n}</td>
                      <td style={{ ...tdS, color:m.diarias>0?'#ff9800':'#555' }}>{m.diarias>0?fmt(m.diarias):'—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Custos */}
        {activeReport==='custos' && (
          <>
            <div style={{ fontSize:13, color:'#bbb', letterSpacing:2, textTransform:'uppercase', marginBottom:12 }}>Distribuição de Custos por Categoria</div>
            <PieChart data={custosPorCat} nameKey="cat" valueKey="total"/>
            <div style={{ marginTop:20, overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead><tr>{['Categoria','Total Realizado','%'].map(h=><th key={h} style={thS}>{h}</th>)}</tr></thead>
                <tbody>
                  {(() => {
                    const totalAll=custosPorCat.reduce((a,c)=>a+c.total,0)||1;
                    return custosPorCat.map((c,i)=>(
                      <tr key={c.cat} style={{ background:i%2===0?'#050505':'transparent' }}>
                        <td style={{ ...tdS, fontWeight:600 }}>{c.cat}</td>
                        <td style={{ ...tdS, color:'#f44336' }}>{fmt(c.total)}</td>
                        <td style={tdS}>{fmtPct(c.total/totalAll*100)}</td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* ── Análise Personalizada ────────────────────────────── */}
      <SHead title="Análise Personalizada" action={
        custResult&&<button onClick={exportCustomExcel}
          style={{ fontSize:12, padding:'5px 10px', background:'transparent', border:'1px solid #4caf50', color:'#4caf50', fontFamily:'Space Mono,monospace', cursor:'pointer', textTransform:'uppercase', letterSpacing:1 }}>
          ↓ Excel
        </button>
      }/>

      <div style={{ padding:'0 16px 14px', background:'#050505', borderBottom:'1px solid #111' }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:8, marginBottom:10 }}>
          <div>
            <div style={{ fontSize:11, color:'#888', letterSpacing:2, textTransform:'uppercase', marginBottom:4 }}>Eixo X</div>
            <select value={axisX} onChange={e=>setAxisX(e.target.value)} style={{ ...selS, width:'100%' }}>
              <option value="mes">Mês</option>
              <option value="estado">Estado</option>
              <option value="cliente">Cliente</option>
              <option value="status">Status</option>
            </select>
          </div>
          <div>
            <div style={{ fontSize:11, color:'#888', letterSpacing:2, textTransform:'uppercase', marginBottom:4 }}>Eixo Y</div>
            <select value={axisY} onChange={e=>setAxisY(e.target.value)} style={{ ...selS, width:'100%' }}>
              <option value="receita">Receita</option>
              <option value="despesa">Despesas</option>
              <option value="lucro">Lucro</option>
              <option value="n">Qtd Shows</option>
              <option value="diarias">Diárias</option>
            </select>
          </div>
          <div>
            <div style={{ fontSize:11, color:'#888', letterSpacing:2, textTransform:'uppercase', marginBottom:4 }}>Período início</div>
            <input type="date" value={dateFr} onChange={e=>setDateFr(e.target.value)} style={{ ...selS, width:'100%' }}/>
          </div>
          <div>
            <div style={{ fontSize:11, color:'#888', letterSpacing:2, textTransform:'uppercase', marginBottom:4 }}>Período fim</div>
            <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} style={{ ...selS, width:'100%' }}/>
          </div>
          <div>
            <div style={{ fontSize:11, color:'#888', letterSpacing:2, textTransform:'uppercase', marginBottom:4 }}>Filtrar Estado</div>
            <select value={custState} onChange={e=>setCustState(e.target.value)} style={{ ...selS, width:'100%' }}>
              <option value="">Todos</option>
              {states.map(s=><option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <button onClick={gerarAnalise} style={{ padding:'10px 20px', background:'#fff', color:'#000', border:'none', fontFamily:'Space Mono,monospace', fontSize:13, cursor:'pointer', letterSpacing:2, textTransform:'uppercase', fontWeight:700 }}>
          Gerar Análise
        </button>
      </div>

      {custResult && (
        <div style={{ padding:'16px 16px 24px' }}>
          <div style={{ fontSize:12, color:'#888', marginBottom:12, letterSpacing:1 }}>
            {axisX.toUpperCase()} × {axisY.toUpperCase()} — {custResult.length} grupos
          </div>
          <BarChart data={custResult} labelKey="label" valueKey={axisY}
            fmtTip={['receita','despesa','lucro','diarias'].includes(axisY)?fmtShort:undefined}
            color="#378ADD" height={160}/>
          <div style={{ marginTop:14, overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr>
                  <th style={thS}>{axisX}</th>
                  <th style={{ ...thS, textAlign:'right' }}>Receita</th>
                  <th style={{ ...thS, textAlign:'right' }}>Despesa</th>
                  <th style={{ ...thS, textAlign:'right' }}>Lucro</th>
                  <th style={{ ...thS, textAlign:'right' }}>Shows</th>
                </tr>
              </thead>
              <tbody>
                {custResult.map((r,i)=>(
                  <tr key={r.label} style={{ background:i%2===0?'#050505':'transparent' }}>
                    <td style={{ ...tdS, fontWeight:600 }}>{r.label}</td>
                    <td style={{ ...tdS, textAlign:'right', color:'#4caf50' }}>{r.receita>0?fmt(r.receita):'—'}</td>
                    <td style={{ ...tdS, textAlign:'right', color:'#f44336' }}>{r.despesa>0?fmt(r.despesa):'—'}</td>
                    <td style={{ ...tdS, textAlign:'right', color:r.lucro>=0?'#4caf50':'#f44336', fontWeight:700 }}>{fmt(r.lucro)}</td>
                    <td style={{ ...tdS, textAlign:'right' }}>{r.n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* print styles */}
      <style>{`@media print{.no-print{display:none!important}}`}</style>
    </div>
  );
}
