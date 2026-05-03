// ─── ORÇAMENTO ───────────────────────────────────────────────────────────────
import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { PageHeader, Section, Input, Select, Modal, ModalBtns, Empty, Btn } from '../components/layout/UI';

const CATS = ['Hotel','Combustível','Pedágio','Alimentação','Outros'];
const DISTANCES = [
  { km: '165 km', tempo: '1h 45min' },
  { km: '348 km', tempo: '4h 10min' },
  { km: '570 km', tempo: '6h 20min' },
];

function fmt(v) { return 'R$ ' + (v||0).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }

export function Orcamento() {
  const { shows, budgets, addBudgetItem, deleteBudgetItem } = useApp();
  const [sel, setSel] = useState('');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ cat: 'Hotel', prev: '', real: '', nova: '' });
  const [dist, setDist] = useState(null);
  const [loadingDist, setLoadingDist] = useState(false);
  const [dias, setDias] = useState(3);

  const show = sel ? shows.find(s => s.id === parseInt(sel)) : null;
  const items = show ? (budgets[show.id] || []) : [];
  const totalPrev = items.reduce((a, i) => a + i.prev, 0);
  const totalReal = items.reduce((a, i) => a + i.real, 0);
  const diff = totalReal - totalPrev;

  const calcDist = () => {
    setLoadingDist(true);
    setTimeout(() => {
      const idx = shows.findIndex(s => s.id === parseInt(sel));
      setDist(DISTANCES[idx] || { km: '—', tempo: '—' });
      setLoadingDist(false);
    }, 1200);
  };

  const save = () => {
    if (!show) return;
    const cat = form.cat === 'nova' ? form.nova || 'Outro' : form.cat;
    addBudgetItem(show.id, { cat, prev: parseFloat(form.prev) || 0, real: parseFloat(form.real) || 0 });
    setModal(false); setForm({ cat: 'Hotel', prev: '', real: '', nova: '' });
  };

  return (
    <div>
      <PageHeader label="Módulo" title="Orçamento" />
      <Section title="Selecionar Show">
        <select value={sel} onChange={e => { setSel(e.target.value); setDist(null); }}
          style={{ width: '100%', background: '#000', border: '1px solid #333', color: '#fff', padding: '10px', fontFamily: 'Space Mono,monospace', fontSize: 12, outline: 'none' }}>
          <option value="">Selecione um show...</option>
          {shows.map(s => <option key={s.id} value={s.id}>{s.client}</option>)}
        </select>
      </Section>

      {!show && <div style={{ textAlign: 'center', padding: '32px 0', color: '#333', fontSize: 10, letterSpacing: 3, textTransform: 'uppercase' }}>Selecione um show</div>}

      {show && <>
        <Section title="Informações da Viagem">
          <div style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', padding: 12 }}>
            {[
              ['Origem', 'São José dos Campos, SP'],
              ['Destino', `${show.city}, ${show.state}`],
            ].map(([l, v]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #111', fontSize: 12 }}>
                <span style={{ color: '#666', fontSize: 10 }}>{l}</span><span>{v}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid #111' }}>
              <span style={{ color: '#666', fontSize: 10 }}>Distância</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12 }}>{dist ? dist.km : '—'}</span>
                <button onClick={calcDist} disabled={loadingDist} style={{ fontSize: 8, letterSpacing: 2, padding: '3px 8px', border: '1px solid #fff', background: 'transparent', color: '#fff', fontFamily: 'Space Mono,monospace', cursor: 'pointer', textTransform: 'uppercase' }}>
                  {loadingDist ? '...' : 'Calcular'}
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #111', fontSize: 12 }}>
              <span style={{ color: '#666', fontSize: 10 }}>Tempo estimado</span><span>{dist ? dist.tempo : '—'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0' }}>
              <span style={{ color: '#666', fontSize: 10 }}>Dias de viagem</span>
              <input type="number" value={dias} onChange={e => setDias(e.target.value)} min={1}
                style={{ background: '#000', border: '1px solid #333', color: '#fff', padding: '4px 8px', fontFamily: 'Space Mono,monospace', fontSize: 12, width: 60, outline: 'none', textAlign: 'right' }} />
            </div>
          </div>
        </Section>

        <Section title="Despesas" action={<Btn size="sm" onClick={() => setModal(true)}>+ Add</Btn>}>
          {items.length === 0 ? <Empty text="Nenhuma despesa" /> : items.map(item => {
            const over = item.real > item.prev && item.real > 0;
            return (
              <div key={item.id} style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', padding: 12, marginBottom: 5 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: '#888' }}>{item.cat}</div>
                  <span onClick={() => deleteBudgetItem(show.id, item.id)} style={{ fontSize: 10, color: '#f44336', cursor: 'pointer' }}>✕</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {[['Previsto', item.prev, '#fff'], ['Realizado', item.real, over ? '#f44336' : '#4caf50']].map(([l, v, c]) => (
                    <div key={l} style={{ background: '#111', border: '1px solid #1a1a1a', padding: '8px 10px' }}>
                      <div style={{ fontSize: 8, letterSpacing: 2, color: '#555', textTransform: 'uppercase', marginBottom: 3 }}>{l}</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: c }}>{fmt(v)}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </Section>

        {items.length > 0 && (
          <div style={{ background: '#fff', color: '#000', padding: '14px 16px', margin: '14px 16px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <div style={{ fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', fontWeight: 700 }}>Total Previsto</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{fmt(totalPrev)}</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', fontWeight: 700 }}>Total Realizado</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{fmt(totalReal)}</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#555', paddingTop: 6, borderTop: '1px solid #ddd' }}>
              <span>Diferença</span>
              <span style={{ color: diff > 0 ? '#c62828' : '#2e7d32', fontWeight: 700 }}>{diff >= 0 ? '+' : ''}{fmt(diff)}</span>
            </div>
          </div>
        )}
      </>}

      {modal && (
        <Modal title="Nova Despesa" onClose={() => setModal(false)}>
          <Select label="Categoria" value={form.cat} onChange={e => setForm({...form, cat: e.target.value})}
            options={[...CATS.map(c => ({value:c,label:c})), {value:'nova',label:'+ Nova categoria...'}]} />
          {form.cat === 'nova' && <Input label="Nome da categoria" value={form.nova||''} onChange={e=>setForm({...form,nova:e.target.value})} placeholder="Ex: Seguro, Frete..." />}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Input label="Previsto (R$)" type="number" value={form.prev||''} onChange={e=>setForm({...form,prev:e.target.value})} placeholder="0,00" />
            <Input label="Realizado (R$)" type="number" value={form.real||''} onChange={e=>setForm({...form,real:e.target.value})} placeholder="0,00" />
          </div>
          <ModalBtns onCancel={() => setModal(false)} onSave={save} />
        </Modal>
      )}
    </div>
  );
}

export default Orcamento;
