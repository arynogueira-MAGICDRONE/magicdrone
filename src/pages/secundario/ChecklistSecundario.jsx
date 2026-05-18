import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase';

function pad(n) { return n < 10 ? '0' + n : n; }
function fmtDate(str) {
  if (!str) return '—';
  const [y, m, d] = str.split('-');
  return `${d}/${m}/${y}`;
}
function nowTime() { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }

const TEMPLATES = {
  110: { drones:120, batTotal:180, ap:2, rede:2, energia:1, radio:2, tripes:5 },
  200: { drones:220, batTotal:300, ap:3, rede:3, energia:1, radio:2, tripes:6 },
  300: { drones:320, batTotal:300, ap:4, rede:4, energia:1, radio:2, tripes:7 },
};
const ITEM_LABELS = {
  drones:'Drones', batSean:'Baterias Sean', batMagic:'Baterias Magic',
  rtk:'RTK', ap:'AP (Access Point)', servidor:'Servidor', computador:'Computador',
  rede:'Cabos de Rede', energia:'Cabos de Energia', radio:'Kit Rádio',
  starlink:'Starlink', tripes:'Tripés',
};

function initChecklist(type) {
  const t = TEMPLATES[type];
  return {
    drones:     { target: t.drones,   qty:'', who:'', time:'', done:false },
    batSean:    { target: t.batTotal,  qty:'', who:'', time:'', done:false, isBat:true },
    batMagic:   { target: t.batTotal,  qty:'', who:'', time:'', done:false, isBat:true },
    rtk:        { target: 1,           qty:'', who:'', time:'', done:false },
    ap:         { target: t.ap,        qty:'', who:'', time:'', done:false },
    servidor:   { target: 1,           qty:'', who:'', time:'', done:false },
    computador: { target: 1,           qty:'', who:'', time:'', done:false },
    rede:       { target: t.rede,      qty:'', who:'', time:'', done:false },
    energia:    { target: t.energia,   qty:'', who:'', time:'', done:false },
    radio:      { target: t.radio,     qty:'', who:'', time:'', done:false },
    starlink:   { target:'s/n',        val:'', who:'', time:'', done:false, isStarlink:true },
    tripes:     { target: t.tripes,    qty:'', who:'', time:'', done:false },
  };
}

const INP = {
  background:'#000', border:'1px solid #333', color:'#fff',
  padding:'9px 12px', fontFamily:'Space Mono,monospace', fontSize:14,
  outline:'none', width:'100%', boxSizing:'border-box',
};

export default function ChecklistSecundario() {
  const [shows,        setShows]        = useState([]);
  const [loadingShows, setLoadingShows] = useState(true);

  const [sel,       setSel]       = useState('');
  const [type,      setType]      = useState(110);
  const [checklist, setChecklist] = useState(initChecklist(110));
  const [open,      setOpen]      = useState({});

  // Carrega shows confirmados diretamente do Supabase
  useEffect(() => {
    setLoadingShows(true);
    supabase
      .from('shows')
      .select('id, cliente, data, drones, cidade, estado')
      .eq('status', 'conf')
      .order('data', { ascending: true })
      .then(({ data, error }) => {
        if (!error && data) setShows(data);
        setLoadingShows(false);
      });
  }, []);

  const show = sel ? shows.find(s => String(s.id) === sel) : null;

  function handleShowSelect(id) {
    setSel(id);
    if (!id) return;
    const s = shows.find(sh => String(sh.id) === id);
    if (!s) return;
    const n = parseInt(s.drones) || 0;
    const t = n <= 110 ? 110 : n <= 200 ? 200 : 300;
    setType(t);
    setChecklist(initChecklist(t));
    setOpen({});
  }

  const keys = Object.keys(checklist);
  const done = keys.filter(k => checklist[k].done).length;
  const pct  = Math.round(done / keys.length * 100);

  const update = (key, field, value) =>
    setChecklist(prev => ({ ...prev, [key]: { ...prev[key], [field]: value } }));

  function confirm(key) {
    const item = checklist[key];
    if (item.isStarlink && !item.val) { alert('Selecione Sim ou Não para o Starlink.'); return; }
    if (!item.isStarlink && !item.qty) { alert('Informe a quantidade.'); return; }
    if (!item.who || !item.time) { alert('Informe quem conferiu e o horário.'); return; }

    if (item.isBat) {
      const t        = TEMPLATES[type];
      const otherKey = key === 'batSean' ? 'batMagic' : 'batSean';
      const thisQty  = parseInt(item.qty) || 0;
      const otherQty = parseInt(checklist[otherKey].qty) || 0;
      if (thisQty + otherQty !== t.batTotal) {
        alert(`Sean + Magic deve totalizar ${t.batTotal}. Atual: ${thisQty + otherQty}`);
        return;
      }
    }

    update(key, 'done', true);
    setOpen(prev => ({ ...prev, [key]: false }));
  }

  return (
    <div>
      {/* Header */}
      <div style={{ padding: '16px 16px 10px', borderBottom: '1px solid #111' }}>
        <div style={{ fontSize: 12, letterSpacing: 3, color: '#bbb', textTransform: 'uppercase', marginBottom: 3 }}>Módulo</div>
        <div style={{ fontSize: 26, fontWeight: 700, fontFamily: 'Bebas Neue, sans-serif', letterSpacing: 2 }}>Checklist</div>
      </div>

      <div style={{ padding: '14px 16px 0' }}>
        {/* Seletor de show */}
        <div style={{ fontSize: 12, letterSpacing: 2, color: '#aaa', textTransform: 'uppercase', marginBottom: 6 }}>Selecionar Show</div>
        {loadingShows ? (
          <div style={{ padding: '10px 0', color: '#555', fontSize: 13, letterSpacing: 2, textTransform: 'uppercase' }}>Carregando shows...</div>
        ) : (
          <select value={sel} onChange={e => handleShowSelect(e.target.value)} style={{ ...INP, marginBottom: 12 }}>
            <option value="">Selecione um show...</option>
            {shows.map(s => (
              <option key={s.id} value={String(s.id)}>
                {s.cliente} — {fmtDate(s.data)}
              </option>
            ))}
          </select>
        )}

        {!show && !loadingShows && (
          <div style={{ textAlign: 'center', padding: '30px 0', color: '#333', fontSize: 14, letterSpacing: 3, textTransform: 'uppercase' }}>
            Selecione um show
          </div>
        )}

        {show && (
          <>
            {/* Template indicator */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              {[110, 200, 300].map(t => (
                <div key={t} style={{
                  flex: 1, padding: '8px 4px', textAlign: 'center',
                  fontFamily: 'Space Mono, monospace', fontSize: 12,
                  letterSpacing: 1, textTransform: 'uppercase',
                  border: `1px solid ${type === t ? '#fff' : '#222'}`,
                  background: type === t ? '#111' : 'transparent',
                  color: type === t ? '#fff' : '#444',
                }}>{t} Drones</div>
              ))}
            </div>

            {/* Progresso */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ background: '#111', height: 4, borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: 4, background: pct === 100 ? '#4caf50' : '#fff', width: `${pct}%`, transition: 'width 0.3s' }} />
              </div>
              <div style={{ fontSize: 13, color: '#aaa', letterSpacing: 1, marginTop: 5, display: 'flex', justifyContent: 'space-between' }}>
                <span>{done} / {keys.length} conferidos</span>
                <span style={{ color: pct === 100 ? '#4caf50' : '#fff', fontWeight: 700 }}>{pct}%</span>
              </div>
            </div>

            {/* Itens */}
            {keys.map(key => {
              const item   = checklist[key];
              const isOpen = open[key];
              const targetTxt = item.isStarlink ? 'Sim / Não' : item.isBat ? `Total: ${item.target} (Sean+Magic)` : `Meta: ${item.target}`;

              return (
                <div key={key} style={{
                  background: '#0a0a0a',
                  border: `1px solid ${item.done ? '#1a2a1a' : '#1a1a1a'}`,
                  borderLeft: `3px solid ${item.done ? '#4caf50' : '#333'}`,
                  padding: '12px 14px', marginBottom: 8,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                    onClick={() => !item.done && setOpen(prev => ({ ...prev, [key]: !prev[key] }))}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 600, color: item.done ? '#4caf50' : '#fff' }}>
                        {item.done ? '✓ ' : ''}{ITEM_LABELS[key]}
                      </div>
                      <div style={{ fontSize: 12, color: '#555', marginTop: 2 }}>{targetTxt}</div>
                      {item.done && (
                        <div style={{ fontSize: 12, color: '#4caf50', marginTop: 3 }}>
                          Por {item.who} às {item.time}
                          {!item.isStarlink && ` — Qtd: ${item.qty}`}
                        </div>
                      )}
                    </div>
                    {!item.done && (
                      <span style={{ fontSize: 18, color: '#444', marginLeft: 8 }}>{isOpen ? '▲' : '▼'}</span>
                    )}
                  </div>

                  {isOpen && !item.done && (
                    <div style={{ paddingTop: 12, borderTop: '1px solid #111', marginTop: 10 }}>
                      {item.isStarlink ? (
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ fontSize: 12, letterSpacing: 2, color: '#aaa', textTransform: 'uppercase', marginBottom: 8 }}>Vai usar Starlink?</div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            {['sim', 'nao'].map(v => (
                              <button key={v} onClick={() => update(key, 'val', v)} style={{
                                flex: 1, padding: '10px', fontFamily: 'Space Mono, monospace',
                                fontSize: 13, letterSpacing: 1, textTransform: 'uppercase', cursor: 'pointer',
                                border: `1px solid ${item.val === v ? (v==='sim'?'#4caf50':'#f44336') : '#333'}`,
                                background: item.val === v ? (v==='sim'?'#0a1a0a':'#1a0a0a') : 'transparent',
                                color: item.val === v ? (v==='sim'?'#4caf50':'#f44336') : '#555',
                              }}>{v === 'sim' ? 'Sim' : 'Não'}</button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div style={{ marginBottom: 10 }}>
                          <label style={{ fontSize: 12, letterSpacing: 2, color: '#aaa', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Quantidade</label>
                          <input type="number" value={item.qty}
                            onChange={e => update(key, 'qty', e.target.value)}
                            placeholder="0" style={INP}
                            onFocus={e => e.target.style.borderColor='#fff'}
                            onBlur={e  => e.target.style.borderColor='#333'}
                          />
                        </div>
                      )}

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                        <div>
                          <label style={{ fontSize: 12, letterSpacing: 2, color: '#aaa', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Conferido por</label>
                          <input value={item.who} onChange={e => update(key, 'who', e.target.value)}
                            placeholder="Nome" style={INP}
                            onFocus={e => e.target.style.borderColor='#fff'}
                            onBlur={e  => e.target.style.borderColor='#333'}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: 12, letterSpacing: 2, color: '#aaa', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Horário</label>
                          <input type="time" value={item.time || nowTime()}
                            onChange={e => update(key, 'time', e.target.value)}
                            style={INP}
                            onFocus={e => e.target.style.borderColor='#fff'}
                            onBlur={e  => e.target.style.borderColor='#333'}
                          />
                        </div>
                      </div>

                      <button onClick={() => confirm(key)} style={{
                        width: '100%', padding: '12px', background: '#fff', color: '#000',
                        border: 'none', fontFamily: 'Space Mono, monospace', fontSize: 13,
                        letterSpacing: 2, textTransform: 'uppercase', cursor: 'pointer', fontWeight: 700,
                      }}>✓ Confirmar Item</button>
                    </div>
                  )}
                </div>
              );
            })}

            {pct === 100 && (
              <div style={{ margin: '16px 0', padding: '16px', background: '#0a1a0a', border: '1px solid #4caf50', textAlign: 'center' }}>
                <div style={{ fontSize: 16, color: '#4caf50', fontWeight: 700, letterSpacing: 2 }}>✓ Checklist Completo!</div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
