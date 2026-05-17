// ─── ORÇAMENTO ───────────────────────────────────────────────────────────────
import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { PageHeader, Section, Input, Select, Modal, ModalBtns, Empty, Btn } from '../components/layout/UI';

const CATS = ['Hotel','Combustível','Pedágio','Fogos de Artifício','Design','Autorizações','Imposto','Comissão','Outros'];
const SECONDARY_CATS = ['Combustível', 'Pedágio', 'Hotel', 'Fogos de Artifício'];
const DISTANCES = [
  { km: '165 km', tempo: '1h 45min' },
  { km: '348 km', tempo: '4h 10min' },
  { km: '570 km', tempo: '6h 20min' },
];

const PER_MEMBER_PREFIXES = ['Diária - ', 'Meia Diária - ', 'Alimentação - '];
const isPerMemberCat = (cat) => cat && PER_MEMBER_PREFIXES.some(pfx => cat.startsWith(pfx));

function fmt(v) { return 'R$ ' + (v||0).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
const pf = v => parseFloat(String(v || 0).replace(',', '.')) || 0;
const qi = v => parseInt(v) || 0;

const INP = {
  background: '#000', border: '1px solid #222', color: '#fff',
  padding: '8px 10px', fontFamily: 'Space Mono,monospace', fontSize: 16,
  outline: 'none', width: '100%', boxSizing: 'border-box',
};

const INP_SM = {
  background: '#000', border: '1px solid #222', color: '#fff',
  padding: '6px 8px', fontFamily: 'Space Mono,monospace', fontSize: 14,
  outline: 'none', flex: 1, minWidth: 0, boxSizing: 'border-box',
};

const SEL_SM = {
  background: '#000', border: '1px solid #333', color: '#fff',
  padding: '6px 8px', fontFamily: 'Space Mono,monospace', fontSize: 13, outline: 'none',
};

const ROW_LABEL = { fontSize: 13, color: '#aaa', minWidth: 100, flexShrink: 0 };

const emptyDiaria  = (memberId, name) => ({ memberId, name, diariaVal: '', diariaQty: '', meiaVal: '', meiaQty: '' });
const emptyAlim    = (memberId, name) => ({ memberId, name, cafeVal: '', cafeQty: '', almocoVal: '', almocoQty: '', jantarVal: '', jantarQty: '' });

export function Orcamento() {
  const {
    shows, budgets, addBudgetItem, updateBudgetItem, deleteBudgetItem, loadBudget,
    comprovantes, addComprovante, loadComprovantesForShow,
    scaling, loadScaling, members,
  } = useApp();
  const { user } = useAuth();
  const isSecondary = user?.perfil === 'secundario';

  const [sel, setSel]               = useState('');
  const [modal, setModal]           = useState(false);
  const [form, setForm]             = useState({ cat: 'Hotel', prev: '', nova: '' });
  const [dist, setDist]             = useState(null);
  const [loadingDist, setLoadingDist] = useState(false);
  const [dias, setDias]             = useState(3);
  const [realEdits, setRealEdits]   = useState({});
  const [loadingBudget, setLoadingBudget] = useState(false);
  const [uploadingFor, setUploadingFor]   = useState({});

  // Per-member diárias
  const [diariaMembers, setDiariaMembers] = useState([]);
  const [diariaAddSel, setDiariaAddSel]   = useState('');
  const diariaRef = useRef([]);
  useEffect(() => { diariaRef.current = diariaMembers; }, [diariaMembers]);

  // Per-member alimentação
  const [alimMembers, setAlimMembers] = useState([]);
  const [alimAddSel, setAlimAddSel]   = useState('');
  const alimRef = useRef([]);
  useEffect(() => { alimRef.current = alimMembers; }, [alimMembers]);

  const show  = sel ? shows.find(s => String(s.id) === sel) : null;
  const items = show ? (budgets[show.id] || []) : [];

  // Group budget items — exclude per-member categories
  const groupedMap = {};
  const groupOrder = [];
  for (const item of items) {
    if (isPerMemberCat(item.cat)) continue;
    if (!groupedMap[item.cat]) { groupedMap[item.cat] = []; groupOrder.push(item.cat); }
    groupedMap[item.cat].push(item);
  }
  const grouped = groupOrder.map(cat => ({ cat, items: groupedMap[cat] }));

  const totalPrev = items.reduce((a, i) => a + (i.prev || 0), 0);
  const totalReal = items.reduce((a, i) => a + (i.real || 0), 0);
  const diff = totalReal - totalPrev;

  // Scaled members for current show
  const scaledMemberIds  = show ? (scaling[show.id] || []).map(sc => sc.memberId) : [];
  const scaledMembers    = members.filter(m => scaledMemberIds.includes(m.id));
  const availDiaria = scaledMembers.filter(m => !diariaMembers.some(d => d.memberId === m.id));
  const availAlim   = scaledMembers.filter(m => !alimMembers.some(a  => a.memberId  === m.id));

  // Computed totals
  const diariaTotalAll = diariaMembers.reduce((acc, m) => acc + pf(m.diariaVal)*qi(m.diariaQty) + pf(m.meiaVal)*qi(m.meiaQty), 0);
  const alimTotalAll   = alimMembers.reduce((acc, m) => acc + pf(m.cafeVal)*qi(m.cafeQty) + pf(m.almocoVal)*qi(m.almocoQty) + pf(m.jantarVal)*qi(m.jantarQty), 0);

  // ── Load on show select ──────────────────────────────────────────
  useEffect(() => {
    if (!sel) return;
    setLoadingBudget(true);
    setRealEdits({});
    setDiariaMembers([]);
    setAlimMembers([]);
    setDiariaAddSel('');
    setAlimAddSel('');
    Promise.all([loadBudget(sel), loadScaling(sel)])
      .then(([rawItems]) => {
        if (rawItems.length > 0) loadComprovantesForShow(rawItems.map(i => i.id));
        populatePerMemberState(rawItems);
      })
      .finally(() => setLoadingBudget(false));
  }, [sel]); // eslint-disable-line react-hooks/exhaustive-deps

  function populatePerMemberState(rawItems) {
    // Diárias
    const diariaResult = [];
    const seenD = new Set();
    for (const item of rawItems) {
      if (!item.cat?.startsWith('Diária - ')) continue;
      const name = item.cat.slice(9);
      if (seenD.has(name)) continue;
      seenD.add(name);
      const member   = members.find(m => m.name === name);
      const meiaItem = rawItems.find(i => i.cat === `Meia Diária - ${name}`);
      diariaResult.push({
        memberId:  member?.id || name,
        name,
        diariaVal: item.prev > 0     ? String(item.prev)     : '',
        diariaQty: item.prev > 0     ? '1'                   : '',
        meiaVal:   meiaItem?.prev > 0 ? String(meiaItem.prev) : '',
        meiaQty:   meiaItem?.prev > 0 ? '1'                   : '',
      });
    }
    setDiariaMembers(diariaResult);

    // Alimentação
    const alimResult = [];
    const seenA = new Set();
    for (const item of rawItems) {
      if (!item.cat?.startsWith('Alimentação - ')) continue;
      const name = item.cat.slice(14);
      if (seenA.has(name)) continue;
      seenA.add(name);
      const member = members.find(m => m.name === name);
      alimResult.push(emptyAlim(member?.id || name, name));
    }
    setAlimMembers(alimResult);
  }

  // ── Diárias helpers ──────────────────────────────────────────────
  const updateDiaria = (idx, field, value) =>
    setDiariaMembers(prev => prev.map((m, i) => i === idx ? { ...m, [field]: value } : m));

  const saveDiariaLine = async (m) => {
    if (!show || !m) return;
    const diariaTotal = pf(m.diariaVal) * qi(m.diariaQty);
    const meiaTotal   = pf(m.meiaVal)   * qi(m.meiaQty);
    const cur = budgets[show.id] || [];
    const di  = cur.find(i => i.cat === `Diária - ${m.name}`);
    const mi  = cur.find(i => i.cat === `Meia Diária - ${m.name}`);
    if (di) await updateBudgetItem(show.id, di.id, { prev: diariaTotal, real: di.real });
    else    await addBudgetItem(show.id, { cat: `Diária - ${m.name}`, prev: diariaTotal, real: 0 });
    if (mi) await updateBudgetItem(show.id, mi.id, { prev: meiaTotal, real: mi.real });
    else    await addBudgetItem(show.id, { cat: `Meia Diária - ${m.name}`, prev: meiaTotal, real: 0 });
  };

  const addDiariaMember = async () => {
    if (!diariaAddSel || !show) return;
    const member = members.find(m => m.id === diariaAddSel);
    if (!member) return;
    await Promise.all([
      addBudgetItem(show.id, { cat: `Diária - ${member.name}`,      prev: 0, real: 0 }),
      addBudgetItem(show.id, { cat: `Meia Diária - ${member.name}`, prev: 0, real: 0 }),
    ]);
    setDiariaMembers(prev => [...prev, emptyDiaria(member.id, member.name)]);
    setDiariaAddSel('');
  };

  const removeDiariaMember = async (memberId) => {
    if (!show) return;
    const m   = diariaMembers.find(x => x.memberId === memberId);
    if (!m) return;
    const cur = budgets[show.id] || [];
    const di  = cur.find(i => i.cat === `Diária - ${m.name}`);
    const mi  = cur.find(i => i.cat === `Meia Diária - ${m.name}`);
    if (di) await deleteBudgetItem(show.id, di.id);
    if (mi) await deleteBudgetItem(show.id, mi.id);
    setDiariaMembers(prev => prev.filter(x => x.memberId !== memberId));
  };

  // ── Alimentação helpers ──────────────────────────────────────────
  const updateAlim = (idx, field, value) =>
    setAlimMembers(prev => prev.map((m, i) => i === idx ? { ...m, [field]: value } : m));

  const saveAlimLine = async (m) => {
    if (!show || !m) return;
    const total = pf(m.cafeVal)*qi(m.cafeQty) + pf(m.almocoVal)*qi(m.almocoQty) + pf(m.jantarVal)*qi(m.jantarQty);
    const cur  = budgets[show.id] || [];
    const ai   = cur.find(i => i.cat === `Alimentação - ${m.name}`);
    if (ai) await updateBudgetItem(show.id, ai.id, { prev: total, real: ai.real });
    else    await addBudgetItem(show.id, { cat: `Alimentação - ${m.name}`, prev: total, real: 0 });
  };

  const addAlimMember = async () => {
    if (!alimAddSel || !show) return;
    const member = members.find(m => m.id === alimAddSel);
    if (!member) return;
    await addBudgetItem(show.id, { cat: `Alimentação - ${member.name}`, prev: 0, real: 0 });
    setAlimMembers(prev => [...prev, emptyAlim(member.id, member.name)]);
    setAlimAddSel('');
  };

  const removeAlimMember = async (memberId) => {
    if (!show) return;
    const m  = alimMembers.find(x => x.memberId === memberId);
    if (!m) return;
    const ai = (budgets[show.id] || []).find(i => i.cat === `Alimentação - ${m.name}`);
    if (ai) await deleteBudgetItem(show.id, ai.id);
    setAlimMembers(prev => prev.filter(x => x.memberId !== memberId));
  };

  // ── Existing helpers ─────────────────────────────────────────────
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

  const addLancamento = (cat) => { addBudgetItem(show.id, { cat, prev: 0, real: 0 }); };

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

  // ── Add-member action bar ────────────────────────────────────────
  function AddMemberBar({ options, selVal, onSelChange, onAdd, label }) {
    return options.length > 0 ? (
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <select value={selVal} onChange={e => onSelChange(e.target.value)} style={SEL_SM}>
          <option value="">Membro...</option>
          {options.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <button onClick={onAdd} disabled={!selVal} style={{
          padding: '6px 12px', background: 'transparent', border: '1px solid #fff',
          color: selVal ? '#fff' : '#555', fontFamily: 'Space Mono,monospace', fontSize: 13,
          cursor: selVal ? 'pointer' : 'not-allowed', textTransform: 'uppercase', letterSpacing: 1, whiteSpace: 'nowrap',
        }}>{label}</button>
      </div>
    ) : null;
  }

  // ── Empty state message ──────────────────────────────────────────
  function EmptyMemberSection({ scaledCount }) {
    return (
      <div style={{ fontSize: 13, color: '#555', padding: '12px 0', textAlign: 'center', letterSpacing: 1 }}>
        {scaledCount === 0 ? 'Nenhum membro escalado para este show' : 'Use o seletor acima para adicionar um membro'}
      </div>
    );
  }

  // ── Renderiza Despesas genéricas ─────────────────────────────────
  const renderDespesas = () => {
    if (loadingBudget) return (
      <div style={{ textAlign: 'center', padding: '20px 0', color: '#aaa', fontSize: 14, letterSpacing: 3, textTransform: 'uppercase' }}>
        Carregando despesas...
      </div>
    );
    const displayedGroups = isSecondary ? grouped.filter(g => SECONDARY_CATS.includes(g.cat)) : grouped;
    if (displayedGroups.length === 0) return <Empty text="Nenhuma despesa cadastrada" />;

    return displayedGroups.map(({ cat, items: catItems }) => {
      const groupPrev = catItems.reduce((a, i) => a + (i.prev || 0), 0);
      const groupReal = catItems.reduce((a, i) => a + (i.real || 0), 0);
      const groupOver = groupReal > groupPrev && groupPrev > 0;
      return (
        <div key={cat} style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderBottom: '1px solid #111' }}>
            <div style={{ fontSize: 14, letterSpacing: 1, textTransform: 'uppercase', color: '#bbb', fontWeight: 700 }}>{cat}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {!isSecondary && <span style={{ fontSize: 14, color: '#aaa' }}>Prev: {fmt(groupPrev)}</span>}
              {!isSecondary && (
                <button onClick={() => addLancamento(cat)} style={{ fontSize: 14, padding: '4px 8px', border: '1px solid #4caf50', background: 'transparent', color: '#4caf50', fontFamily: 'Space Mono,monospace', cursor: 'pointer', letterSpacing: 1 }}>+ Lançamento</button>
              )}
              {!isSecondary && (
                <button onClick={() => deleteGroup(catItems)} style={{ background: 'transparent', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0 }}>🗑️</button>
              )}
            </div>
          </div>
          <div style={{ padding: '8px 12px' }}>
            {catItems.map((item, idx) => {
              const realVal   = realEdits[item.id] !== undefined ? realEdits[item.id] : String(item.real || 0);
              const realFloat = parseFloat(realVal) || 0;
              const inputColor = item.prev > 0 ? (realFloat > item.prev ? '#f44336' : '#4caf50') : '#4caf50';
              const comps = comprovantes[item.id] || [];
              const isLast = idx === catItems.length - 1;
              return (
                <div key={item.id} style={{ marginBottom: isLast ? 0 : 10, paddingBottom: isLast ? 0 : 10, borderBottom: isLast ? 'none' : '1px solid #111' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 14, color: '#888', flexShrink: 0, width: 18 }}>#{idx + 1}</span>
                    <input type="number" value={realVal}
                      onChange={e => setRealEdits(prev => ({ ...prev, [item.id]: e.target.value }))}
                      onBlur={() => saveReal(item)} placeholder="0,00"
                      style={{ ...INP, flex: 1, color: inputColor, fontWeight: 700, fontSize: 14, border: 'none', borderBottom: '1px solid #333', background: 'transparent', padding: '4px 0' }}
                    />
                    <label style={{ cursor: 'pointer', flexShrink: 0 }}>
                      <input type="file" accept="image/*,application/pdf" capture="environment" style={{ display: 'none' }}
                        onChange={e => handleComprovante(item, e.target.files[0])} />
                      <span style={{ fontSize: 14, padding: '6px 7px', border: '1px solid #444', color: uploadingFor[item.id] ? '#888' : '#aaa', fontFamily: 'Space Mono,monospace', whiteSpace: 'nowrap', display: 'block' }}>
                        {uploadingFor[item.id] ? '...' : '📎'}
                      </span>
                    </label>
                    {!isSecondary && (
                      <button onClick={() => deleteBudgetItem(show.id, item.id)} style={{ background: 'transparent', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0, flexShrink: 0 }}>🗑️</button>
                    )}
                  </div>
                  {comps.length > 0 && (
                    <div style={{ marginTop: 6, marginLeft: 24, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {comps.map(c => (
                        /\.(jpg|jpeg|png|gif|webp)$/i.test(c.url) ? (
                          <a key={c.id} href={c.url} target="_blank" rel="noopener noreferrer">
                            <img src={c.url} alt="comprovante" style={{ width: 56, height: 56, objectFit: 'cover', border: '1px solid #333', display: 'block' }} />
                          </a>
                        ) : (
                          <a key={c.id} href={c.url} target="_blank" rel="noopener noreferrer"
                            style={{ fontSize: 14, color: '#4caf50', padding: '4px 6px', border: '1px solid #1a2a1a', background: '#050f05', display: 'block', textDecoration: 'none' }}>
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
          <div style={{ padding: '8px 12px', borderTop: '1px solid #111', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 14, color: '#bbb', letterSpacing: 1, textTransform: 'uppercase' }}>Total Realizado</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: groupOver ? '#f44336' : '#4caf50' }}>{fmt(groupReal)}</span>
          </div>
        </div>
      );
    });
  };

  // ── Render ───────────────────────────────────────────────────────
  return (
    <div>
      <PageHeader label="Módulo" title="Orçamento" />

      <Section title="Selecionar Show">
        <select value={sel} onChange={e => handleShowSelect(e.target.value)}
          style={{ width: '100%', background: '#000', border: '1px solid #333', color: '#fff', padding: '10px', fontFamily: 'Space Mono,monospace', fontSize: 16, outline: 'none' }}>
          <option value="">Selecione um show...</option>
          {shows.map(s => <option key={s.id} value={s.id}>{s.client}</option>)}
        </select>
      </Section>

      {!show && (
        <div style={{ textAlign: 'center', padding: '32px 0', color: '#333', fontSize: 14, letterSpacing: 3, textTransform: 'uppercase' }}>
          Selecione um show
        </div>
      )}

      {show && <>

        {/* ── Viagem ── */}
        <Section title="Informações da Viagem">
          <div style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', padding: 12 }}>
            {[['Origem', 'São José dos Campos, SP'], ['Destino', `${show.city || '—'}, ${show.state || '—'}`]].map(([l, v]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #111', fontSize: 16 }}>
                <span style={{ color: '#aaa', fontSize: 14 }}>{l}</span><span>{v}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid #111' }}>
              <span style={{ color: '#aaa', fontSize: 14 }}>Distância</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16 }}>{dist ? dist.km : '—'}</span>
                <button onClick={calcDist} disabled={loadingDist} style={{ fontSize: 14, letterSpacing: 2, padding: '4px 8px', border: '1px solid #fff', background: 'transparent', color: '#fff', fontFamily: 'Space Mono,monospace', cursor: 'pointer', textTransform: 'uppercase' }}>
                  {loadingDist ? '...' : 'Calcular'}
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #111', fontSize: 16 }}>
              <span style={{ color: '#aaa', fontSize: 14 }}>Tempo estimado</span><span>{dist ? dist.tempo : '—'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0' }}>
              <span style={{ color: '#aaa', fontSize: 14 }}>Dias de viagem</span>
              <input type="number" value={dias} onChange={e => setDias(e.target.value)} min={1}
                style={{ background: '#000', border: '1px solid #333', color: '#fff', padding: '4px 8px', fontFamily: 'Space Mono,monospace', fontSize: 16, width: 60, outline: 'none', textAlign: 'right' }} />
            </div>
          </div>
        </Section>

        {/* ── DIÁRIAS ── */}
        {!isSecondary && (
          <Section
            title={`Diárias${diariaTotalAll > 0 ? '  —  ' + fmt(diariaTotalAll) : ''}`}
            action={
              <AddMemberBar
                options={availDiaria} selVal={diariaAddSel}
                onSelChange={setDiariaAddSel} onAdd={addDiariaMember}
                label="+ Membro"
              />
            }
          >
            {diariaMembers.length === 0
              ? <EmptyMemberSection scaledCount={scaledMembers.length} />
              : diariaMembers.map((m, idx) => {
                  const dt    = pf(m.diariaVal) * qi(m.diariaQty);
                  const mt    = pf(m.meiaVal)   * qi(m.meiaQty);
                  const total = dt + mt;
                  return (
                    <div key={m.memberId} style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', padding: '12px 14px', marginBottom: 8 }}>
                      {/* Card header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <div style={{ fontSize: 15, fontWeight: 700 }}>{m.name}</div>
                        <button onClick={() => removeDiariaMember(m.memberId)}
                          style={{ background: 'transparent', border: 'none', color: '#f44336', cursor: 'pointer', fontSize: 16 }}>🗑️</button>
                      </div>

                      {/* Diária */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <span style={ROW_LABEL}>Diária</span>
                        <input type="number" value={m.diariaVal}
                          onChange={e => updateDiaria(idx, 'diariaVal', e.target.value)}
                          onBlur={() => saveDiariaLine(diariaRef.current[idx])}
                          placeholder="R$ unit." style={{ ...INP_SM, maxWidth: 110 }} />
                        <span style={{ fontSize: 14, color: '#555' }}>×</span>
                        <input type="number" value={m.diariaQty}
                          onChange={e => updateDiaria(idx, 'diariaQty', e.target.value)}
                          onBlur={() => saveDiariaLine(diariaRef.current[idx])}
                          placeholder="Qtd" style={{ ...INP_SM, maxWidth: 70 }} />
                        <span style={{ fontSize: 14, color: '#4caf50', marginLeft: 'auto', minWidth: 90, textAlign: 'right' }}>{fmt(dt)}</span>
                      </div>

                      {/* Meia Diária */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                        <span style={ROW_LABEL}>Meia Diária</span>
                        <input type="number" value={m.meiaVal}
                          onChange={e => updateDiaria(idx, 'meiaVal', e.target.value)}
                          onBlur={() => saveDiariaLine(diariaRef.current[idx])}
                          placeholder="R$ unit." style={{ ...INP_SM, maxWidth: 110 }} />
                        <span style={{ fontSize: 14, color: '#555' }}>×</span>
                        <input type="number" value={m.meiaQty}
                          onChange={e => updateDiaria(idx, 'meiaQty', e.target.value)}
                          onBlur={() => saveDiariaLine(diariaRef.current[idx])}
                          placeholder="Qtd" style={{ ...INP_SM, maxWidth: 70 }} />
                        <span style={{ fontSize: 14, color: '#4caf50', marginLeft: 'auto', minWidth: 90, textAlign: 'right' }}>{fmt(mt)}</span>
                      </div>

                      {/* Member total */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #222', paddingTop: 8 }}>
                        <span style={{ fontSize: 13, color: '#aaa', textTransform: 'uppercase', letterSpacing: 1 }}>Total</span>
                        <span style={{ fontSize: 15, fontWeight: 700, color: total > 0 ? '#fff' : '#555' }}>{fmt(total)}</span>
                      </div>
                    </div>
                  );
                })
            }

            {diariaMembers.length > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#111', border: '1px solid #222', marginTop: 4 }}>
                <span style={{ fontSize: 14, color: '#bbb', textTransform: 'uppercase', letterSpacing: 1 }}>Total Geral Diárias</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: '#4caf50' }}>{fmt(diariaTotalAll)}</span>
              </div>
            )}
          </Section>
        )}

        {/* ── ALIMENTAÇÃO ── */}
        {!isSecondary && (
          <Section
            title={`Alimentação${alimTotalAll > 0 ? '  —  ' + fmt(alimTotalAll) : ''}`}
            action={
              <AddMemberBar
                options={availAlim} selVal={alimAddSel}
                onSelChange={setAlimAddSel} onAdd={addAlimMember}
                label="+ Membro"
              />
            }
          >
            {alimMembers.length === 0
              ? <EmptyMemberSection scaledCount={scaledMembers.length} />
              : alimMembers.map((m, idx) => {
                  const ct    = pf(m.cafeVal)   * qi(m.cafeQty);
                  const at    = pf(m.almocoVal) * qi(m.almocoQty);
                  const jt    = pf(m.jantarVal) * qi(m.jantarQty);
                  const total = ct + at + jt;

                  const AlimRow = ({ label, valField, qtyField, lineTotal }) => (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span style={ROW_LABEL}>{label}</span>
                      <input type="number" value={m[valField]}
                        onChange={e => updateAlim(idx, valField, e.target.value)}
                        onBlur={() => saveAlimLine(alimRef.current[idx])}
                        placeholder="R$ unit." style={{ ...INP_SM, maxWidth: 110 }} />
                      <span style={{ fontSize: 14, color: '#555' }}>×</span>
                      <input type="number" value={m[qtyField]}
                        onChange={e => updateAlim(idx, qtyField, e.target.value)}
                        onBlur={() => saveAlimLine(alimRef.current[idx])}
                        placeholder="Qtd" style={{ ...INP_SM, maxWidth: 70 }} />
                      <span style={{ fontSize: 14, color: '#4caf50', marginLeft: 'auto', minWidth: 90, textAlign: 'right' }}>{fmt(lineTotal)}</span>
                    </div>
                  );

                  return (
                    <div key={m.memberId} style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', padding: '12px 14px', marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <div style={{ fontSize: 15, fontWeight: 700 }}>{m.name}</div>
                        <button onClick={() => removeAlimMember(m.memberId)}
                          style={{ background: 'transparent', border: 'none', color: '#f44336', cursor: 'pointer', fontSize: 16 }}>🗑️</button>
                      </div>
                      <AlimRow label="Café da Manhã" valField="cafeVal"   qtyField="cafeQty"   lineTotal={ct} />
                      <AlimRow label="Almoço"        valField="almocoVal" qtyField="almocoQty" lineTotal={at} />
                      <AlimRow label="Jantar"        valField="jantarVal" qtyField="jantarQty" lineTotal={jt} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #222', paddingTop: 8, marginTop: 4 }}>
                        <span style={{ fontSize: 13, color: '#aaa', textTransform: 'uppercase', letterSpacing: 1 }}>Total</span>
                        <span style={{ fontSize: 15, fontWeight: 700, color: total > 0 ? '#fff' : '#555' }}>{fmt(total)}</span>
                      </div>
                    </div>
                  );
                })
            }

            {alimMembers.length > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#111', border: '1px solid #222', marginTop: 4 }}>
                <span style={{ fontSize: 14, color: '#bbb', textTransform: 'uppercase', letterSpacing: 1 }}>Total Geral Alimentação</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: '#4caf50' }}>{fmt(alimTotalAll)}</span>
              </div>
            )}
          </Section>
        )}

        {/* ── DESPESAS ── */}
        <Section title="Despesas" action={!isSecondary && !loadingBudget && <Btn size="sm" onClick={() => setModal(true)}>+ Add</Btn>}>
          {renderDespesas()}
        </Section>

        {/* ── TOTAIS ── */}
        {!loadingBudget && items.length > 0 && (
          <div style={{ background: '#fff', color: '#000', padding: '14px 16px', margin: '14px 16px 0' }}>
            {!isSecondary && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ fontSize: 14, letterSpacing: 3, textTransform: 'uppercase', fontWeight: 700 }}>Total Previsto</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{fmt(totalPrev)}</div>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: isSecondary ? 0 : 6 }}>
              <div style={{ fontSize: 14, letterSpacing: 3, textTransform: 'uppercase', fontWeight: 700 }}>Total Realizado</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{fmt(totalReal)}</div>
            </div>
            {!isSecondary && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#aaa', paddingTop: 6, borderTop: '1px solid #ddd' }}>
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
