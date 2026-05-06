// ─── ORÇAMENTO ───────────────────────────────────────────────────────────────
import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { PageHeader, Section, Input, Select, Modal, ModalBtns, Empty, Btn } from '../components/layout/UI';

const CATS = ['Hotel','Combustível','Pedágio','Alimentação','Outros'];
const DISTANCES = [
  { km: '165 km', tempo: '1h 45min' },
  { km: '348 km', tempo: '4h 10min' },
  { km: '570 km', tempo: '6h 20min' },
];

function fmt(v) { return 'R$ ' + (v||0).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }

const INP = {
  background: '#000', border: '1px solid #222', color: '#fff',
  padding: '6px 8px', fontFamily: 'Space Mono,monospace', fontSize: 12,
  outline: 'none', width: '100%', boxSizing: 'border-box',
};

export function Orcamento() {
  const {
    shows, budgets, addBudgetItem, updateBudgetItem, deleteBudgetItem, loadBudget,
    comprovantes, addComprovante, loadComprovantesForShow,
  } = useApp();
  const { user } = useAuth();
  const isSecondary = user?.perfil === 'secundario';

  const [sel, setSel] = useState('');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ cat: 'Hotel', prev: '', nova: '' });
  const [dist, setDist] = useState(null);
  const [loadingDist, setLoadingDist] = useState(false);
  const [dias, setDias] = useState(3);
  const [realEdits, setRealEdits] = useState({});
  const [loadingBudget, setLoadingBudget] = useState(false);
  const [uploadingFor, setUploadingFor] = useState({});

  const show = sel ? shows.find(s => String(s.id) === sel) : null;
  const items = show ? (budgets[show.id] || []) : [];

  // Agrupar items por categoria mantendo ordem de inserção
  const groupedMap = {};
  const groupOrder = [];
  for (const item of items) {
    if (!groupedMap[item.cat]) { groupedMap[item.cat] = []; groupOrder.push(item.cat); }
    groupedMap[item.cat].push(item);
  }
  const grouped = groupOrder.map(cat => ({ cat, items: groupedMap[cat] }));

  const totalPrev = items.reduce((a, i) => a + (i.prev || 0), 0);
  const totalReal = items.reduce((a, i) => a + (i.real || 0), 0);
  const diff = totalReal - totalPrev;

  // Carrega orçamento e comprovantes ao selecionar show
  useEffect(() => {
    if (!sel) return;
    setLoadingBudget(true);
    setRealEdits({});
    loadBudget(sel)
      .then(rawItems => { if (rawItems.length > 0) loadComprovantesForShow(rawItems.map(i => i.id)); })
      .finally(() => setLoadingBudget(false));
  }, [sel]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleShowSelect = (id) => { setSel(id); setDist(null); };

  const calcDist = () => {
    setLoadingDist(true);
    setTimeout(() => {
      const idx = shows.findIndex(s => String(s.id) === sel);
      setDist(DISTANCES[idx] || { km: '—', tempo: '—' });
      setLoadingDist(false);
    }, 1200);
  };

  const saveModal = () => {
    if (!show) return;
    const cat = form.cat === 'nova' ? form.nova || 'Outro' : form.cat;
    addBudgetItem(show.id, { cat, prev: parseFloat(form.prev) || 0, real: 0 });
    setModal(false); setForm({ cat: 'Hotel', prev: '', nova: '' });
  };

  const saveReal = async (item) => {
    const val = parseFloat(realEdits[item.id]) ?? item.real ?? 0;
    await updateBudgetItem(show.id, item.id, { prev: item.prev, real: val });
    setRealEdits(prev => { const n = { ...prev }; delete n[item.id]; return n; });
  };

  const addLancamento = (cat) => {
    addBudgetItem(show.id, { cat, prev: 0, real: 0 });
  };

  const deleteGroup = async (catItems) => {
    if (!window.confirm(`Excluir todos os lançamentos de "${catItems[0].cat}"?`)) return;
    for (const item of catItems) await deleteBudgetItem(show.id, item.id);
  };

  const handleComprovante = async (item, file) => {
    if (!file) return;
    setUploadingFor(prev => ({ ...prev, [item.id]: true }));
    await addComprovante(item.id, file, show.id, item.cat);
    setUploadingFor(prev => ({ ...prev, [item.id]: false }));
  };

  const renderDespesas = () => {
    if (loadingBudget) {
      return (
        <div style={{ textAlign: 'center', padding: '20px 0', color: '#555', fontSize: 10, letterSpacing: 3, textTransform: 'uppercase' }}>
          Carregando despesas...
        </div>
      );
    }
    if (grouped.length === 0) {
      return <Empty text="Nenhuma despesa cadastrada para este show" />;
    }

    return grouped.map(({ cat, items: catItems }) => {
      const groupPrev = catItems.reduce((a, i) => a + (i.prev || 0), 0);
      const groupReal = catItems.reduce((a, i) => a + (i.real || 0), 0);
      const groupOver = groupReal > groupPrev && groupPrev > 0;

      return (
        <div key={cat} style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', marginBottom: 8 }}>

          {/* Cabeçalho da categoria */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderBottom: '1px solid #111' }}>
            <div style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: '#888', fontWeight: 700 }}>{cat}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {!isSecondary && (
                <span style={{ fontSize: 9, color: '#555' }}>Prev: {fmt(groupPrev)}</span>
              )}
              {!isSecondary && (
                <button onClick={() => addLancamento(cat)} style={{
                  fontSize: 9, padding: '3px 8px', border: '1px solid #4caf50',
                  background: 'transparent', color: '#4caf50', fontFamily: 'Space Mono,monospace',
                  cursor: 'pointer', letterSpacing: 1,
                }}>+ Lançamento</button>
              )}
              {!isSecondary && (
                <button onClick={() => deleteGroup(catItems)} style={{ background: 'transparent', border: 'none', color: '#555', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0 }}>🗑️</button>
              )}
            </div>
          </div>

          {/* Lista de lançamentos */}
          <div style={{ padding: '8px 12px' }}>
            {catItems.map((item, idx) => {
              const realVal = realEdits[item.id] !== undefined ? realEdits[item.id] : String(item.real || 0);
              const realFloat = parseFloat(realVal) || 0;
              const inputColor = item.prev > 0 ? (realFloat > item.prev ? '#f44336' : '#4caf50') : '#4caf50';
              const comps = comprovantes[item.id] || [];
              const isLast = idx === catItems.length - 1;

              return (
                <div key={item.id} style={{ marginBottom: isLast ? 0 : 10, paddingBottom: isLast ? 0 : 10, borderBottom: isLast ? 'none' : '1px solid #111' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: '#444', flexShrink: 0, width: 18 }}>#{idx + 1}</span>
                    <input
                      type="number"
                      value={realVal}
                      onChange={e => setRealEdits(prev => ({ ...prev, [item.id]: e.target.value }))}
                      onBlur={() => saveReal(item)}
                      placeholder="0,00"
                      style={{ ...INP, flex: 1, color: inputColor, fontWeight: 700, fontSize: 13, border: 'none', borderBottom: '1px solid #333', background: 'transparent', padding: '4px 0' }}
                    />
                    <label style={{ cursor: 'pointer', flexShrink: 0 }}>
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        capture="environment"
                        style={{ display: 'none' }}
                        onChange={e => handleComprovante(item, e.target.files[0])}
                      />
                      <span style={{
                        fontSize: 8, letterSpacing: 1, padding: '5px 7px', border: '1px solid #444',
                        color: uploadingFor[item.id] ? '#888' : '#aaa', fontFamily: 'Space Mono,monospace',
                        whiteSpace: 'nowrap', display: 'block',
                      }}>
                        {uploadingFor[item.id] ? '...' : '📎'}
                      </span>
                    </label>
                    {!isSecondary && (
                      <button onClick={() => deleteBudgetItem(show.id, item.id)} style={{ background: 'transparent', border: 'none', color: '#555', cursor: 'pointer', fontSize: 13, lineHeight: 1, padding: 0, flexShrink: 0 }}>🗑️</button>
                    )}
                  </div>

                  {/* Comprovantes do lançamento */}
                  {comps.length > 0 && (
                    <div style={{ marginTop: 6, marginLeft: 24, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {comps.map(c => (
                        /\.(jpg|jpeg|png|gif|webp)$/i.test(c.url) ? (
                          <a key={c.id} href={c.url} target="_blank" rel="noopener noreferrer">
                            <img src={c.url} alt="comprovante" style={{ width: 56, height: 56, objectFit: 'cover', border: '1px solid #333', display: 'block' }} />
                          </a>
                        ) : (
                          <a key={c.id} href={c.url} target="_blank" rel="noopener noreferrer"
                            style={{ fontSize: 8, color: '#4caf50', letterSpacing: 1, padding: '4px 6px', border: '1px solid #1a2a1a', background: '#050f05', display: 'block', textDecoration: 'none' }}>
                            📄 {c.fileName.replace(/^\d+_/, '')}
                          </a>
                        )
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Total realizado do grupo */}
          <div style={{ padding: '8px 12px', borderTop: '1px solid #111', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#555', letterSpacing: 1, textTransform: 'uppercase' }}>Total Realizado</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: groupOver ? '#f44336' : '#4caf50' }}>{fmt(groupReal)}</span>
          </div>
        </div>
      );
    });
  };

  return (
    <div>
      <PageHeader label="Módulo" title="Orçamento" />

      <Section title="Selecionar Show">
        <select value={sel} onChange={e => handleShowSelect(e.target.value)}
          style={{ width: '100%', background: '#000', border: '1px solid #333', color: '#fff', padding: '10px', fontFamily: 'Space Mono,monospace', fontSize: 12, outline: 'none' }}>
          <option value="">Selecione um show...</option>
          {shows.map(s => <option key={s.id} value={s.id}>{s.client}</option>)}
        </select>
      </Section>

      {!show && (
        <div style={{ textAlign: 'center', padding: '32px 0', color: '#333', fontSize: 10, letterSpacing: 3, textTransform: 'uppercase' }}>
          Selecione um show
        </div>
      )}

      {show && <>
        <Section title="Informações da Viagem">
          <div style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', padding: 12 }}>
            {[
              ['Origem', 'São José dos Campos, SP'],
              ['Destino', `${show.city || '—'}, ${show.state || '—'}`],
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

        <Section title="Despesas" action={!isSecondary && !loadingBudget && <Btn size="sm" onClick={() => setModal(true)}>+ Add</Btn>}>
          {renderDespesas()}
        </Section>

        {!loadingBudget && items.length > 0 && (
          <div style={{ background: '#fff', color: '#000', padding: '14px 16px', margin: '14px 16px 0' }}>
            {!isSecondary && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', fontWeight: 700 }}>Total Previsto</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{fmt(totalPrev)}</div>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: isSecondary ? 0 : 6 }}>
              <div style={{ fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', fontWeight: 700 }}>Total Realizado</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{fmt(totalReal)}</div>
            </div>
            {!isSecondary && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#555', paddingTop: 6, borderTop: '1px solid #ddd' }}>
                <span>Diferença</span>
                <span style={{ color: diff > 0 ? '#c62828' : '#2e7d32', fontWeight: 700 }}>{diff >= 0 ? '+' : ''}{fmt(diff)}</span>
              </div>
            )}
          </div>
        )}
      </>}

      {modal && !isSecondary && (
        <Modal title="Nova Categoria de Despesa" onClose={() => setModal(false)}>
          <Select label="Categoria" value={form.cat} onChange={e => setForm({...form, cat: e.target.value})}
            options={[...CATS.map(c => ({value:c,label:c})), {value:'nova',label:'+ Nova categoria...'}]} />
          {form.cat === 'nova' && (
            <Input label="Nome da categoria" value={form.nova||''} onChange={e=>setForm({...form,nova:e.target.value})} placeholder="Ex: Seguro, Frete..." />
          )}
          <Input label="Previsto (R$)" type="number" value={form.prev||''} onChange={e=>setForm({...form,prev:e.target.value})} placeholder="0,00" />
          <ModalBtns onCancel={() => setModal(false)} onSave={saveModal} />
        </Modal>
      )}
    </div>
  );
}

export default Orcamento;
