import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { PageHeader, Section, Empty } from '../components/layout/UI';

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
    drones:     { target: t.drones,   qty: '', who: '', time: '', done: false, isStarlink: false },
    batSean:    { target: t.batTotal,  qty: '', who: '', time: '', done: false, isBat: true },
    batMagic:   { target: t.batTotal,  qty: '', who: '', time: '', done: false, isBat: true },
    rtk:        { target: 1,           qty: '', who: '', time: '', done: false },
    ap:         { target: t.ap,        qty: '', who: '', time: '', done: false },
    servidor:   { target: 1,           qty: '', who: '', time: '', done: false },
    computador: { target: 1,           qty: '', who: '', time: '', done: false },
    rede:       { target: t.rede,      qty: '', who: '', time: '', done: false },
    energia:    { target: t.energia,   qty: '', who: '', time: '', done: false },
    radio:      { target: t.radio,     qty: '', who: '', time: '', done: false },
    starlink:   { target: 's/n',       val: '', who: '', time: '', done: false, isStarlink: true },
    tripes:     { target: t.tripes,    qty: '', who: '', time: '', done: false },
  };
}

function pad(n) { return n < 10 ? '0' + n : n; }
function nowTime() { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }

export default function Checklist() {
  const { shows } = useApp();
  const { isMaster } = useAuth();
  const visibleShows = isMaster() ? shows : shows.filter(s => s.status === 'conf');
  const [type, setType] = useState(110);
  const [selectedShow, setSelectedShow] = useState('');
  const [checklist, setChecklist] = useState(initChecklist(110));
  const [open, setOpen] = useState({});
  const [extras, setExtras] = useState([]);

  const changeType = (t) => { setType(t); setChecklist(initChecklist(t)); setOpen({}); };

  const keys = Object.keys(checklist);
  const done = keys.filter(k => checklist[k].done).length;
  const pct = Math.round(done / keys.length * 100);

  const update = (key, field, value) => setChecklist(prev => ({ ...prev, [key]: { ...prev[key], [field]: value } }));

  const confirm = (key) => {
    const item = checklist[key];
    if (item.isStarlink && !item.val) { alert('Selecione Sim ou Não para o Starlink.'); return; }
    if (!item.isStarlink && !item.qty) { alert('Informe a quantidade.'); return; }
    if (!item.who || !item.time) { alert('Informe quem conferiu e o horário.'); return; }

    if (item.isBat) {
      const t = TEMPLATES[type];
      const sean = parseInt(checklist.batSean.qty) || 0;
      const magic = parseInt(checklist.batMagic.qty) || 0;
      if (key === 'batMagic' || key === 'batSean') {
        const otherKey = key === 'batSean' ? 'batMagic' : 'batSean';
        const other = parseInt(checklist[otherKey].qty) || 0;
        const thisQty = parseInt(item.qty) || 0;
        if (thisQty + other !== t.batTotal) {
          alert(`Sean + Magic deve totalizar ${t.batTotal}. Atual: ${thisQty + other}`);
          return;
        }
      }
    }
    update(key, 'done', true);
    setOpen(prev => ({ ...prev, [key]: false }));
  };

  const addExtra = () => setExtras(prev => [...prev, { id: Date.now(), name: '', qty: '' }]);
  const updateExtra = (id, field, val) => setExtras(prev => prev.map(e => e.id === id ? { ...e, [field]: val } : e));
  const delExtra = (id) => setExtras(prev => prev.filter(e => e.id !== id));

  const inputStyle = { background: '#000', border: '1px solid #222', color: '#fff', padding: '6px 8px', fontFamily: 'Space Mono,monospace', fontSize: 11, outline: 'none', width: '100%' };

  return (
    <div>
      <PageHeader label="Módulo" title="Checklist" />

      {/* Type selector */}
      <div style={{ display: 'flex', gap: 6, padding: '12px 16px 0' }}>
        {[110, 200, 300].map(t => (
          <button key={t} onClick={() => changeType(t)} style={{
            flex: 1, padding: '8px 4px', fontFamily: 'Space Mono,monospace', fontSize: 9,
            letterSpacing: 2, textTransform: 'uppercase', cursor: 'pointer',
            border: `1px solid ${type === t ? '#fff' : '#333'}`,
            background: type === t ? '#111' : 'transparent',
            color: type === t ? '#fff' : '#555',
          }}>{t} Drones</button>
        ))}
      </div>

      {/* Show selector */}
      <div style={{ padding: '10px 16px 0' }}>
        <select value={selectedShow} onChange={e => setSelectedShow(e.target.value)}
          style={{ width: '100%', background: '#000', border: '1px solid #333', color: '#fff', padding: '8px 10px', fontFamily: 'Space Mono,monospace', fontSize: 12, outline: 'none' }}>
          <option value="">Selecionar show...</option>
          {visibleShows.map(s => <option key={s.id} value={s.id}>{s.client}</option>)}
        </select>
      </div>

      {/* Progress */}
      <div style={{ padding: '10px 16px 0' }}>
        <div style={{ background: '#111', height: 3 }}>
          <div style={{ height: 3, background: '#fff', width: `${pct}%`, transition: 'width 0.3s' }} />
        </div>
        <div style={{ fontSize: 9, color: '#555', letterSpacing: 2, marginTop: 4, textAlign: 'right' }}>
          {done} / {keys.length} itens conferidos
        </div>
      </div>

      <Section title="Equipamentos">
        {keys.map(key => {
          const item = checklist[key];
          const isOpen = open[key];
          const targetTxt = item.isStarlink ? 'Sim / Não' : item.isBat ? `Total: ${item.target} (Sean+Magic)` : `Qtd: ${item.target}`;

          return (
            <div key={key} style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', padding: '10px 12px', marginBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                onClick={() => setOpen(prev => ({ ...prev, [key]: !prev[key] }))}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{ITEM_LABELS[key]}</div>
                  <div style={{ fontSize: 9, color: '#555', marginTop: 1 }}>{targetTxt}</div>
                  {item.done && <div style={{ fontSize: 8, color: '#4caf50', marginTop: 2, letterSpacing: 1 }}>✓ Por {item.who} às {item.time}</div>}
                </div>
                <div style={{
                  width: 20, height: 20, border: `1px solid ${item.done ? '#fff' : '#444'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, background: item.done ? '#fff' : 'transparent', color: item.done ? '#000' : 'transparent',
                }}>✓</div>
              </div>

              {isOpen && (
                <div style={{ paddingTop: 10, borderTop: '1px solid #111', marginTop: 8 }}>
                  {item.isStarlink ? (
                    <div>
                      <div style={{ fontSize: 9, letterSpacing: 2, color: '#555', textTransform: 'uppercase', marginBottom: 6 }}>Vai usar Starlink?</div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {['sim','nao'].map(v => (
                          <button key={v} onClick={() => update(key, 'val', v)} style={{
                            flex: 1, padding: 7, fontFamily: 'Space Mono,monospace', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', cursor: 'pointer',
                            border: `1px solid ${item.val===v ? (v==='sim'?'#4caf50':'#f44336') : '#333'}`,
                            background: item.val===v ? (v==='sim'?'#0a1a0a':'#1a0a0a') : 'transparent',
                            color: item.val===v ? (v==='sim'?'#4caf50':'#f44336') : '#555',
                          }}>{v === 'sim' ? 'Sim' : 'Não'}</button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 9, letterSpacing: 2, color: '#555', textTransform: 'uppercase', marginBottom: 4 }}>Quantidade pega</div>
                      <input value={item.qty} onChange={e => update(key, 'qty', e.target.value)} type="number" placeholder="0" style={inputStyle} />
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                    <div>
                      <div style={{ fontSize: 9, letterSpacing: 2, color: '#555', textTransform: 'uppercase', marginBottom: 4 }}>Conferido por</div>
                      <input value={item.who} onChange={e => update(key, 'who', e.target.value)} placeholder="Nome" style={inputStyle} />
                    </div>
                    <div>
                      <div style={{ fontSize: 9, letterSpacing: 2, color: '#555', textTransform: 'uppercase', marginBottom: 4 }}>Horário</div>
                      <input value={item.time} onChange={e => update(key, 'time', e.target.value)} type="time" style={inputStyle} />
                    </div>
                  </div>

                  <button onClick={() => confirm(key)} style={{
                    width: '100%', padding: 8, marginTop: 8, fontFamily: 'Space Mono,monospace',
                    fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', cursor: 'pointer',
                    border: '1px solid #fff', background: 'transparent', color: '#fff',
                  }}>Confirmar Item</button>
                </div>
              )}
            </div>
          );
        })}
      </Section>

      <Section title="Itens Extras" action={<button onClick={addExtra} style={{ fontSize: 9, letterSpacing: 2, padding: '4px 10px', border: '1px solid #444', background: 'transparent', color: '#aaa', fontFamily: 'Space Mono,monospace', cursor: 'pointer', textTransform: 'uppercase' }}>+ Add</button>}>
        {extras.length === 0 ? <Empty text="Nenhum item extra" /> : extras.map(e => (
          <div key={e.id} style={{ display: 'flex', gap: 6, marginBottom: 4, alignItems: 'center' }}>
            <input value={e.name} onChange={ev => updateExtra(e.id, 'name', ev.target.value)} placeholder="Item extra..." style={{ ...inputStyle, flex: 1 }} />
            <input value={e.qty} onChange={ev => updateExtra(e.id, 'qty', ev.target.value)} type="number" placeholder="Qtd" style={{ ...inputStyle, width: 60, flex: 'none' }} />
            <button onClick={() => delExtra(e.id)} style={{ background: 'transparent', border: '1px solid #333', color: '#f44336', padding: '6px 10px', cursor: 'pointer', fontSize: 12 }}>✕</button>
          </div>
        ))}
      </Section>
    </div>
  );
}
