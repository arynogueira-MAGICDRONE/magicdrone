// ─── ORÇAMENTO ───────────────────────────────────────────────────────────────
import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../supabase';
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

function memberDefaults(name) {
  const isWellington = name?.toLowerCase().includes('wellington');
  return {
    diaria: isWellington ? '480'   : '315',
    meia:   isWellington ? '240'   : '157.50',
    cafe:   '30', almoco: '60', jantar: '60',
  };
}

function fmt(v) { return 'R$ ' + (v||0).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
function fmtDate(str) { if (!str) return '—'; const [y,m,d] = str.split('-'); return `${d}/${m}/${y}`; }
const pf = v => parseFloat(String(v || 0).replace(',', '.')) || 0;
const qi = v => parseInt(v) || 0;

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

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

const emptyDiaria = (memberId, name) => ({ memberId, name, diariaVal: '', diariaQty: '', meiaVal: '', meiaQty: '' });
const emptyAlim   = (memberId, name) => ({ memberId, name, cafeVal: '', cafeQty: '', almocoVal: '', almocoQty: '', jantarVal: '', jantarQty: '' });

const ADIANT_STATUS = {
  solicitado: { label: 'Solicitado', color: '#ff9800' },
  aprovado:   { label: 'Aprovado',   color: '#2196f3' },
  pago:       { label: 'Pago',       color: '#4caf50' },
};

// ─── PDF helper via window.open ───────────────────────────────────────────────
function printHtml(htmlContent, title) {
  const win = window.open('', '_blank');
  if (!win) { alert('Permita pop-ups para gerar o PDF.'); return; }
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>${title}</title>
    <style>
      body { font-family: Arial, sans-serif; font-size: 13px; color: #000; background: #fff; padding: 24px; }
      h1 { font-size: 16px; text-align: center; margin-bottom: 4px; }
      h2 { font-size: 13px; text-align: center; margin-bottom: 16px; color: #333; }
      table { width: 100%; border-collapse: collapse; margin: 12px 0; }
      th { background: #ddd; font-weight: bold; border: 1px solid #999; padding: 7px 10px; text-align: left; }
      td { border: 1px solid #bbb; padding: 6px 10px; }
      .total-row td { font-weight: bold; background: #f0f0f0; }
      .saldo-row td { font-weight: bold; background: #e8f5e9; }
      .neg td { background: #fce4ec; }
      .comp-sim { color: #2e7d32; font-weight: bold; }
      .comp-nao { color: #c62828; font-weight: bold; }
      .img-section { margin: 12px 0; }
      .img-section img { max-width: 320px; max-height: 320px; display: block; margin: 8px 0; border: 1px solid #ccc; }
      @media print { body { padding: 0; } }
    </style>
  </head><body>${htmlContent}
    <script>setTimeout(function(){ window.print(); }, 400);</script>
  </body></html>`);
  win.document.close();
}

export function Orcamento() {
  const {
    shows, budgets, addBudgetItem, updateBudgetItem, deleteBudgetItem, loadBudget,
    comprovantes, addComprovante, loadComprovantesForShow,
    scaling, loadScaling, members,
  } = useApp();
  const { user } = useAuth();
  const isSecondary = user?.perfil === 'secundario';
  const canApprove  = user?.perfil === 'master' || user?.perfil === 'administrativo';

  // ── Existing state ───────────────────────────────────────────────
  const [sel, setSel]               = useState('');
  const [modal, setModal]           = useState(false);
  const [form, setForm]             = useState({ cat: 'Hotel', prev: '', nova: '' });
  const [dist, setDist]             = useState(null);
  const [loadingDist, setLoadingDist] = useState(false);
  const [dias, setDias]             = useState(3);
  const [realEdits, setRealEdits]   = useState({});
  const [loadingBudget, setLoadingBudget] = useState(false);
  const [uploadingFor, setUploadingFor]   = useState({});

  // ── Per-member diárias ───────────────────────────────────────────
  const [diariaMembers, setDiariaMembers] = useState([]);
  const [diariaAddSel, setDiariaAddSel]   = useState('');
  const diariaRef = useRef([]);
  useEffect(() => { diariaRef.current = diariaMembers; }, [diariaMembers]);

  // ── Per-member alimentação ───────────────────────────────────────
  const [alimMembers, setAlimMembers] = useState([]);
  const [alimAddSel, setAlimAddSel]   = useState('');
  const alimRef = useRef([]);
  useEffect(() => { alimRef.current = alimMembers; }, [alimMembers]);

  // ── Combustível calc state ───────────────────────────────────────
  const [showFuelCalc, setShowFuelCalc] = useState(false);
  const [fuelCalc, setFuelCalc] = useState({
    origem: 'São José dos Campos, SP', destino: '',
    consumo: '10', preco: '6.50', nveiculos: '1',
    distancia: null, calculando: false, erro: null,
  });

  // ── Adiantamento state ───────────────────────────────────────────
  const [adiantMap, setAdiantMap]     = useState({});  // { [itemId]: {valor, status, numero} }
  const [adiantEdits, setAdiantEdits] = useState({});  // { [itemId]: string }

  // ── Report state ─────────────────────────────────────────────────
  const [reportModal, setReportModal] = useState(false);

  // ── Diária/Alimentação save state ────────────────────────────────
  const [savingDiariaAlim, setSavingDiariaAlim] = useState(false);
  const [savedDiariaAlim,  setSavedDiariaAlim]  = useState(false);

  // ── Derived ──────────────────────────────────────────────────────
  const show  = sel ? shows.find(s => String(s.id) === sel) : null;
  const items = show ? (budgets[show.id] || []) : [];

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
  const diff      = totalReal - totalPrev;

  const scaledMemberIds = show ? (scaling[show.id] || []).map(sc => sc.memberId) : [];
  const scaledMembers   = members.filter(m => scaledMemberIds.includes(m.id));
  const availDiaria = scaledMembers.filter(m => !diariaMembers.some(d => d.memberId === m.id));
  const availAlim   = scaledMembers.filter(m => !alimMembers.some(a  => a.memberId  === m.id));

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
    setAdiantMap({});
    setAdiantEdits({});
    setShowFuelCalc(false);
    setFuelCalc(f => ({ ...f, distancia: null, erro: null, destino: '' }));
    Promise.all([loadBudget(sel), loadScaling(sel)])
      .then(([rawItems, rawScaling]) => {
        if (rawItems.length > 0) {
          loadComprovantesForShow(rawItems.map(i => i.id));
          loadAdiantamentos(rawItems.map(i => i.id));
        }
        populatePerMemberState(rawItems, rawScaling);
      })
      .finally(() => setLoadingBudget(false));
  }, [sel]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Adiantamento helpers ─────────────────────────────────────────
  async function loadAdiantamentos(itemIds) {
    if (!itemIds.length) return;
    const { data } = await supabase
      .from('orcamento')
      .select('id, adiantamento, status_adiantamento, numero_lancamento, visivel_secundario')
      .in('id', itemIds);
    if (data) {
      const map = {};
      data.forEach(i => {
        map[i.id] = {
          valor:    i.adiantamento         || 0,
          status:   i.status_adiantamento  || null,
          numero:   i.numero_lancamento    || null,
          visivel:  i.visivel_secundario   === true,
        };
      });
      setAdiantMap(map);
    }
  }

  async function toggleVisibilidade(itemId) {
    if (!canApprove) return;
    const current = adiantMap[itemId]?.visivel === true;
    const next    = !current;
    const { error } = await supabase.from('orcamento')
      .update({ visivel_secundario: next })
      .eq('id', itemId);
    if (!error) setAdiantMap(prev => ({ ...prev, [itemId]: { ...prev[itemId], visivel: next } }));
  }

  async function requestAdiantamento(itemId) {
    const val = pf(adiantEdits[itemId] !== undefined ? adiantEdits[itemId] : adiantMap[itemId]?.valor);
    if (!val) { alert('Informe o valor do adiantamento.'); return; }
    const { error } = await supabase.from('orcamento')
      .update({ adiantamento: val, status_adiantamento: 'solicitado' })
      .eq('id', itemId);
    if (error) { alert('Erro: ' + error.message); return; }
    setAdiantMap(prev => ({ ...prev, [itemId]: { ...prev[itemId], valor: val, status: 'solicitado' } }));
    setAdiantEdits(prev => { const n = { ...prev }; delete n[itemId]; return n; });
  }

  async function cycleAdiantStatus(itemId) {
    if (!canApprove) return;
    const cycle = { solicitado: 'aprovado', aprovado: 'pago', pago: 'solicitado' };
    const current = adiantMap[itemId]?.status || 'solicitado';
    const next    = cycle[current];
    const { error } = await supabase.from('orcamento')
      .update({ status_adiantamento: next })
      .eq('id', itemId);
    if (!error) setAdiantMap(prev => ({ ...prev, [itemId]: { ...prev[itemId], status: next } }));
  }

  // ── Per-member helpers ────────────────────────────────────────────
  function populatePerMemberState(rawItems, rawScaling) {
    const scaledIds = new Set((rawScaling || []).map(s => s.membro_id));

    const diariaResult = [];
    const seenD = new Set();
    for (const item of rawItems) {
      if (!item.categoria?.startsWith('Diária - ')) continue;
      const name = item.categoria.slice(9);
      if (seenD.has(name)) continue;
      seenD.add(name);
      const member = members.find(m => m.name === name);
      if (member && !scaledIds.has(member.id)) continue;
      const meiaItem = rawItems.find(i => i.categoria === `Meia Diária - ${name}`);
      const def = memberDefaults(name);
      diariaResult.push({
        memberId: member?.id || name, name,
        diariaVal: item.previsto > 0 ? String(item.previsto) : def.diaria,
        diariaQty: item.previsto > 0 ? '1' : '',
        meiaVal:   meiaItem?.previsto > 0 ? String(meiaItem.previsto) : def.meia,
        meiaQty:   meiaItem?.previsto > 0 ? '1' : '',
      });
    }
    setDiariaMembers(diariaResult);

    const alimResult = [];
    const seenA = new Set();
    for (const item of rawItems) {
      if (!item.categoria?.startsWith('Alimentação - ')) continue;
      const name = item.categoria.slice(14);
      if (seenA.has(name)) continue;
      seenA.add(name);
      const member = members.find(m => m.name === name);
      if (member && !scaledIds.has(member.id)) continue;
      const def = memberDefaults(name);
      alimResult.push({
        memberId: member?.id || name, name,
        cafeVal: def.cafe, cafeQty: '', almocoVal: def.almoco, almocoQty: '', jantarVal: def.jantar, jantarQty: '',
      });
    }
    setAlimMembers(alimResult);
  }

  const updateDiaria = (idx, field, value) =>
    setDiariaMembers(prev => prev.map((m, i) => i === idx ? { ...m, [field]: value } : m));

  const saveDiariaLine = async (m) => {
    if (!show || !m) return;
    const dt = pf(m.diariaVal) * qi(m.diariaQty);
    const mt = pf(m.meiaVal)   * qi(m.meiaQty);
    const cur = budgets[show.id] || [];
    const di  = cur.find(i => i.cat === `Diária - ${m.name}`);
    const mi  = cur.find(i => i.cat === `Meia Diária - ${m.name}`);
    if (di) await updateBudgetItem(show.id, di.id, { prev: dt, real: di.real });
    else    await addBudgetItem(show.id, { cat: `Diária - ${m.name}`, prev: dt, real: 0 });
    if (mi) await updateBudgetItem(show.id, mi.id, { prev: mt, real: mi.real });
    else    await addBudgetItem(show.id, { cat: `Meia Diária - ${m.name}`, prev: mt, real: 0 });
  };

  const addDiariaMember = async () => {
    if (!diariaAddSel || !show) return;
    const member = scaledMembers.find(m => m.id === diariaAddSel);
    if (!member) return;
    const def = memberDefaults(member.name);
    await Promise.all([
      addBudgetItem(show.id, { cat: `Diária - ${member.name}`,      prev: 0, real: 0 }),
      addBudgetItem(show.id, { cat: `Meia Diária - ${member.name}`, prev: 0, real: 0 }),
    ]);
    setDiariaMembers(prev => [...prev, {
      memberId: member.id, name: member.name,
      diariaVal: def.diaria, diariaQty: '',
      meiaVal:   def.meia,   meiaQty:   '',
    }]);
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

  const updateAlim = (idx, field, value) =>
    setAlimMembers(prev => prev.map((m, i) => i === idx ? { ...m, [field]: value } : m));

  const saveAlimLine = async (m) => {
    if (!show || !m) return;
    const total = pf(m.cafeVal)*qi(m.cafeQty) + pf(m.almocoVal)*qi(m.almocoQty) + pf(m.jantarVal)*qi(m.jantarQty);
    const cur = budgets[show.id] || [];
    const ai  = cur.find(i => i.cat === `Alimentação - ${m.name}`);
    if (ai) await updateBudgetItem(show.id, ai.id, { prev: total, real: ai.real });
    else    await addBudgetItem(show.id, { cat: `Alimentação - ${m.name}`, prev: total, real: 0 });
  };

  const addAlimMember = async () => {
    if (!alimAddSel || !show) return;
    const member = scaledMembers.find(m => m.id === alimAddSel);
    if (!member) return;
    const def = memberDefaults(member.name);
    await addBudgetItem(show.id, { cat: `Alimentação - ${member.name}`, prev: 0, real: 0 });
    setAlimMembers(prev => [...prev, {
      memberId: member.id, name: member.name,
      cafeVal: def.cafe, cafeQty: '', almocoVal: def.almoco, almocoQty: '', jantarVal: def.jantar, jantarQty: '',
    }]);
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

  const saveAllDiariaAlim = async () => {
    if (!show) return;
    setSavingDiariaAlim(true);
    await Promise.all([
      ...diariaRef.current.map(m => saveDiariaLine(m)),
      ...alimRef.current.map(m => saveAlimLine(m)),
    ]);
    setSavingDiariaAlim(false);
    setSavedDiariaAlim(true);
    setTimeout(() => setSavedDiariaAlim(false), 2500);
  };

  const availDiariaMembers = scaledMembers.filter(m => !diariaMembers.some(d => d.memberId === m.id));
  const availAlimMembers   = scaledMembers.filter(m => !alimMembers.some(a  => a.memberId  === m.id));

  // ── Existing misc helpers ────────────────────────────────────────
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

  // ── Combustível helpers ──────────────────────────────────────────
  async function calcularDistancia() {
    const { origem, destino } = fuelCalc;
    if (!origem.trim() || !destino.trim()) {
      setFuelCalc(f => ({ ...f, erro: 'Informe origem e destino.' }));
      return;
    }
    setFuelCalc(f => ({ ...f, calculando: true, erro: null, distancia: null }));
    let distKm = null;

    // Tenta OpenRouteService se houver chave configurada
    const orsKey = import.meta.env.VITE_ORS_KEY;
    if (orsKey) {
      try {
        const [gO, gD] = await Promise.all([
          fetch(`https://api.openrouteservice.org/geocode/search?api_key=${orsKey}&text=${encodeURIComponent(origem)}&size=1`).then(r => r.json()),
          fetch(`https://api.openrouteservice.org/geocode/search?api_key=${orsKey}&text=${encodeURIComponent(destino)}&size=1`).then(r => r.json()),
        ]);
        if (gO.features?.length && gD.features?.length) {
          const [lonO, latO] = gO.features[0].geometry.coordinates;
          const [lonD, latD] = gD.features[0].geometry.coordinates;
          const route = await fetch('https://api.openrouteservice.org/v2/directions/driving-car', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': orsKey },
            body: JSON.stringify({ coordinates: [[lonO, latO], [lonD, latD]] }),
          }).then(r => r.json());
          if (route.routes?.[0]?.summary?.distance) distKm = route.routes[0].summary.distance / 1000;
        }
      } catch { /* cai no fallback */ }
    }

    // Fallback: Nominatim + Haversine + 30%
    if (!distKm) {
      try {
        const geocode = async (q) => {
          const data = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`,
            { headers: { 'User-Agent': 'MagicDrone/1.0' } }
          ).then(r => r.json());
          if (!data.length) throw new Error(`"${q}" não encontrado. Tente com cidade e estado.`);
          return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
        };
        const [orig, dest] = await Promise.all([geocode(origem), geocode(destino)]);
        distKm = haversine(orig.lat, orig.lon, dest.lat, dest.lon) * 1.30;
      } catch (e) {
        setFuelCalc(f => ({ ...f, calculando: false, erro: e.message || 'Não foi possível calcular.' }));
        return;
      }
    }

    setFuelCalc(f => ({ ...f, distancia: Math.round(distKm), calculando: false }));
  }

  async function usarValorCombustivel(valor) {
    if (!show || !valor) return;
    const cur  = budgets[show.id] || [];
    const item = cur.find(i => i.cat === 'Combustível');
    if (item) await updateBudgetItem(show.id, item.id, { prev: valor, real: item.real || 0 });
    else      await addBudgetItem(show.id, { cat: 'Combustível', prev: valor, real: 0 });
  }

  // ── Report helpers ──────────────────────────────────────────────
  // Merge pending realEdits into items so reports always have latest values
  function getItemsForReport() {
    return items.map(i => ({
      ...i,
      real: realEdits[i.id] !== undefined ? (parseFloat(realEdits[i.id]) || 0) : (i.real || 0),
    }));
  }

  // Show '—' for zero / null realized values in PDF display
  function fmtOrDash(v) { return (!v || v === 0) ? '—' : fmt(v); }

  // ── Reports ──────────────────────────────────────────────────────
  async function getPrevShowBalance() {
    if (!show) return 0;
    const clientShows = shows
      .filter(s => s.client === show.client && String(s.id) !== String(show.id))
      .sort((a, b) => b.date.localeCompare(a.date));
    if (!clientShows.length) return 0;
    const { data } = await supabase.from('orcamento')
      .select('adiantamento, realizado')
      .eq('show_id', clientShows[0].id);
    if (!data) return 0;
    const totalAdiant = data.reduce((a, i) => a + (i.adiantamento || 0), 0);
    const totalReal   = data.reduce((a, i) => a + (i.realizado   || 0), 0);
    return totalAdiant - totalReal;
  }

  async function handleReportA(format) {
    const adiantItems = items.filter(i => adiantMap[i.id]?.valor > 0);
    if (!adiantItems.length) { alert('Nenhum adiantamento solicitado para este show.'); return; }
    const prevBalance = await getPrevShowBalance();
    const total = adiantItems.reduce((a, i) => a + (adiantMap[i.id]?.valor || 0), 0);
    const grandTotal = total + prevBalance;

    if (format === 'excel') {
      const rows = [
        ['SOLICITAÇÃO DE ADIANTAMENTO'],
        [`SHOW: ${show.client}    DATA: ${fmtDate(show.date)}`],
        [''],
        ['DESPESA', 'VALOR (R$)'],
        ...adiantItems.map(i => [i.cat, adiantMap[i.id]?.valor || 0]),
        [''],
        [`Diferença show anterior`, prevBalance],
        ['TOTAL', grandTotal],
      ];
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws['!cols'] = [{ wch: 40 }, { wch: 16 }];
      XLSX.utils.book_append_sheet(wb, ws, 'Adiantamento');
      XLSX.writeFile(wb, `adiantamento-${show.client}-${show.date}.xlsx`);
    } else {
      const rows = adiantItems.map(i => `<tr><td>${i.cat}</td><td style="text-align:right">${fmt(adiantMap[i.id]?.valor || 0)}</td></tr>`).join('');
      printHtml(`
        <h1>SOLICITAÇÃO DE ADIANTAMENTO</h1>
        <h2>SHOW: ${show.client} &nbsp;&nbsp; DATA: ${fmtDate(show.date)}</h2>
        <table>
          <thead><tr><th>Despesa</th><th>Valor</th></tr></thead>
          <tbody>
            ${rows}
            <tr><td>Diferença show anterior</td><td style="text-align:right">${fmt(prevBalance)}</td></tr>
          </tbody>
          <tfoot class="total-row"><tr><td><b>TOTAL</b></td><td style="text-align:right"><b>${fmt(grandTotal)}</b></td></tr></tfoot>
        </table>
      `, 'Adiantamento de Despesas');
    }
  }

  function handleReportB(format) {
    const rItems = getItemsForReport();
    if (!rItems.length) { alert('Sem despesas para este show.'); return; }
    const totPrev = rItems.reduce((a, i) => a + (i.prev || 0), 0);
    const totReal = rItems.reduce((a, i) => a + (i.real || 0), 0);
    const saldo   = totReal - totPrev;

    if (format === 'excel') {
      const rows = [
        ['ADIANTAMENTO X REALIZADO'],
        [`${show.client} — ${fmtDate(show.date)}`],
        [''],
        ['DESPESA', 'PREVISTO (R$)', 'REALIZADO (R$)'],
        ...rItems.map(i => [i.cat, i.prev || 0, i.real || 0]),
        [''],
        ['TOTAL', totPrev, totReal],
        ['SALDO', '', saldo],
      ];
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws['!cols'] = [{ wch: 40 }, { wch: 16 }, { wch: 16 }];
      XLSX.utils.book_append_sheet(wb, ws, 'Adiant x Realizado');
      XLSX.writeFile(wb, `adiant-vs-realizado-${show.client}-${show.date}.xlsx`);
    } else {
      const rows = rItems.map(i =>
        `<tr><td>${i.cat}</td><td style="text-align:right">${fmt(i.prev||0)}</td><td style="text-align:right">${fmtOrDash(i.real)}</td></tr>`
      ).join('');
      const saldoClass = saldo < 0 ? 'neg' : 'saldo-row';
      printHtml(`
        <h1>ADIANTAMENTO X REALIZADO</h1>
        <h2>${show.client} — ${fmtDate(show.date)}</h2>
        <table>
          <thead><tr><th>Despesa</th><th>Previsto</th><th>Realizado</th></tr></thead>
          <tbody>${rows}</tbody>
          <tfoot>
            <tr class="total-row"><td><b>TOTAL</b></td><td style="text-align:right"><b>${fmt(totPrev)}</b></td><td style="text-align:right"><b>${fmt(totReal)}</b></td></tr>
            <tr class="${saldoClass}"><td><b>SALDO</b></td><td></td><td style="text-align:right"><b>${fmt(saldo)}</b></td></tr>
          </tfoot>
        </table>
      `, 'Adiantamento vs Realizado');
    }
  }

  function handleReportC(format) {
    const rItems = getItemsForReport();
    if (!rItems.length) { alert('Sem despesas para este show.'); return; }
    const valorVenda  = show.valor || 0;
    const totDespesas = rItems.reduce((a, i) => a + (i.real || 0), 0);
    const resultado   = valorVenda - totDespesas;
    const margem      = valorVenda > 0 ? (resultado / valorVenda * 100).toFixed(1) : '—';

    // Group by category
    const catMap = {};
    rItems.forEach(i => { catMap[i.cat] = (catMap[i.cat] || 0) + (i.real || 0); });

    if (format === 'excel') {
      const rows = [
        ['RELATÓRIO FINAL'],
        [`${show.client} — ${fmtDate(show.date)}`],
        [''],
        ['Valor de Venda', valorVenda],
        [''],
        ['CATEGORIA', 'REALIZADO (R$)'],
        ...Object.entries(catMap).map(([cat, val]) => [cat, val || 0]),
        [''],
        ['Total Despesas', totDespesas],
        ['Resultado (Lucro)', resultado],
        ['Margem %', margem + '%'],
      ];
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws['!cols'] = [{ wch: 40 }, { wch: 16 }];
      XLSX.utils.book_append_sheet(wb, ws, 'Relatório Final');
      XLSX.writeFile(wb, `relatorio-final-${show.client}-${show.date}.xlsx`);
    } else {
      const rows = Object.entries(catMap).map(([cat, val]) =>
        `<tr><td>${cat}</td><td style="text-align:right">${fmtOrDash(val)}</td></tr>`
      ).join('');
      printHtml(`
        <h1>RELATÓRIO FINAL</h1>
        <h2>${show.client} — ${fmtDate(show.date)}</h2>
        <table style="margin-bottom:8px">
          <tr><td><b>Valor de Venda</b></td><td style="text-align:right"><b>${fmt(valorVenda)}</b></td></tr>
        </table>
        <table>
          <thead><tr><th>Categoria</th><th>Realizado</th></tr></thead>
          <tbody>${rows}</tbody>
          <tfoot>
            <tr class="total-row"><td><b>Total Despesas</b></td><td style="text-align:right"><b>${fmt(totDespesas)}</b></td></tr>
            <tr class="${resultado >= 0 ? 'saldo-row' : 'neg'}">
              <td><b>Resultado (Lucro)</b></td>
              <td style="text-align:right"><b>${fmt(resultado)}</b></td>
            </tr>
            <tr><td>Margem</td><td style="text-align:right">${margem}%</td></tr>
          </tfoot>
        </table>
      `, 'Relatório Final');
    }
  }

  function handleReportD(format) {
    const rItems = getItemsForReport();
    if (!rItems.length) { alert('Sem despesas para este show.'); return; }
    const totPrev = rItems.reduce((a, i) => a + (i.prev || 0), 0);
    const totReal = rItems.reduce((a, i) => a + (i.real || 0), 0);

    if (format === 'excel') {
      const rows = [
        ['TOTAL DE DESPESAS'],
        [`${show.client} — ${fmtDate(show.date)}`],
        [''],
        ['Nº', 'Despesa', 'Previsto (R$)', 'Realizado (R$)', 'Comprovante'],
        ...rItems.map((i, idx) => [
          adiantMap[i.id]?.numero || (idx + 1),
          i.cat,
          i.prev || 0,
          i.real || 0,
          (comprovantes[i.id]?.length > 0) ? 'Sim ✓' : 'Não ✗',
        ]),
        [''],
        ['', 'TOTAL', totPrev, totReal, ''],
      ];
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws['!cols'] = [{ wch: 6 }, { wch: 40 }, { wch: 16 }, { wch: 16 }, { wch: 14 }];
      XLSX.utils.book_append_sheet(wb, ws, 'Total Despesas');
      XLSX.writeFile(wb, `total-despesas-${show.client}-${show.date}.xlsx`);
    } else {
      const rows = rItems.map((i, idx) => {
        const compsAll  = comprovantes[i.id] || [];
        const imgComps  = compsAll.filter(c => /\.(jpg|jpeg|png|gif|webp)$/i.test(c.url));
        const pdfComps  = compsAll.filter(c => /\.pdf$/i.test(c.url));
        const otherComp = compsAll.filter(c => !/\.(jpg|jpeg|png|gif|webp|pdf)$/i.test(c.url));
        const hasComp   = compsAll.length > 0;
        const num       = adiantMap[i.id]?.numero || (idx + 1);

        const compCell = hasComp
          ? `<span class="comp-sim">Sim ✓</span>`
          : `<span class="comp-nao">Não ✗</span>`;

        const compSection = hasComp ? `<tr><td colspan="5" style="padding:8px 10px;background:#fafafa;">
          ${imgComps.map(c => `<img src="${c.url}" alt="comprovante Nº ${num}" style="max-width:300px;max-height:300px;display:block;margin:6px 0;border:1px solid #ccc;">`).join('')}
          ${pdfComps.map((c, pi) => `<div style="margin:5px 0;padding:8px 10px;border:1px solid #999;background:#fff;font-size:12px;">
            📄 Comprovante Nº ${num}.${pi + 1} — Arquivo PDF:
            <a href="${c.url}" target="_blank" style="color:#1565c0;">${(c.fileName || '').replace(/^\d+_/, '') || 'arquivo.pdf'}</a>
          </div>`).join('')}
          ${otherComp.map(c => `<div style="margin:5px 0;padding:8px 10px;border:1px solid #999;background:#fff;font-size:12px;">
            📎 <a href="${c.url}" target="_blank" style="color:#1565c0;">${(c.fileName || '').replace(/^\d+_/, '') || 'arquivo'}</a>
          </div>`).join('')}
        </td></tr>` : '';

        return `<tr>
          <td>${num}</td>
          <td>${i.cat}</td>
          <td style="text-align:right">${fmt(i.prev||0)}</td>
          <td style="text-align:right">${fmtOrDash(i.real)}</td>
          <td style="text-align:center">${compCell}</td>
        </tr>${compSection}`;
      }).join('');

      printHtml(`
        <h1>TOTAL DE DESPESAS</h1>
        <h2>${show.client} — ${fmtDate(show.date)}</h2>
        <table>
          <thead><tr><th>Nº</th><th>Despesa</th><th>Previsto</th><th>Realizado</th><th>Comprovante</th></tr></thead>
          <tbody>${rows}</tbody>
          <tfoot class="total-row">
            <tr><td></td><td><b>TOTAL</b></td><td style="text-align:right"><b>${fmt(totPrev)}</b></td><td style="text-align:right"><b>${fmt(totReal)}</b></td><td></td></tr>
          </tfoot>
        </table>
      `, 'Total de Despesas');
    }
  }

  // ── renderDespesas ───────────────────────────────────────────────
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

      // Fuel total for Combustível preview
      const fuelDistTotal = (cat === 'Combustível' && fuelCalc.distancia)
        ? fuelCalc.distancia * 2 * 1.15 / (pf(fuelCalc.consumo) || 10) * (pf(fuelCalc.preco) || 6.50) * (qi(fuelCalc.nveiculos) || 1)
        : 0;

      return (
        <div key={cat} style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', marginBottom: 8 }}>
          {/* Category header */}
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

          {/* ── Combustível: cálculo automático ── */}
          {cat === 'Combustível' && !isSecondary && (
            <div style={{ borderBottom: '1px solid #111', background: '#050505' }}>
              <button onClick={() => setShowFuelCalc(v => !v)} style={{
                width: '100%', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8,
                background: 'transparent', border: 'none', color: '#aaa', cursor: 'pointer',
                fontFamily: 'Space Mono,monospace', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1,
              }}>
                <span>⛽</span>
                <span>Calcular combustível automaticamente</span>
                <span style={{ marginLeft: 'auto' }}>{showFuelCalc ? '▲' : '▼'}</span>
              </button>

              {showFuelCalc && (
                <div style={{ padding: '0 12px 12px' }}>
                  {/* Origem / Destino */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
                    {[['Origem', 'origem', 'São José dos Campos, SP'], ['Destino', 'destino', 'São Paulo, SP']].map(([lbl, fld, ph]) => (
                      <div key={fld}>
                        <div style={{ fontSize: 12, color: '#888', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 1 }}>{lbl}</div>
                        <input value={fuelCalc[fld]}
                          onChange={e => setFuelCalc(f => ({ ...f, [fld]: e.target.value }))}
                          placeholder={ph}
                          style={{ ...INP, fontSize: 13 }}
                          onFocus={e => e.target.style.borderColor = '#fff'}
                          onBlur={e => e.target.style.borderColor = '#222'}
                        />
                      </div>
                    ))}
                  </div>

                  <button onClick={calcularDistancia} disabled={fuelCalc.calculando} style={{
                    width: '100%', padding: '8px', marginBottom: 8, background: 'transparent',
                    border: `1px solid ${fuelCalc.calculando ? '#444' : '#fff'}`,
                    color: fuelCalc.calculando ? '#555' : '#fff',
                    fontFamily: 'Space Mono,monospace', fontSize: 13, letterSpacing: 1,
                    textTransform: 'uppercase', cursor: fuelCalc.calculando ? 'wait' : 'pointer',
                  }}>
                    {fuelCalc.calculando ? 'Calculando...' : '📍 Calcular Distância'}
                  </button>

                  {fuelCalc.erro && (
                    <div style={{ fontSize: 13, color: '#f44336', marginBottom: 8 }}>{fuelCalc.erro}</div>
                  )}
                  {fuelCalc.distancia && (
                    <div style={{ fontSize: 13, color: '#4caf50', marginBottom: 10, padding: '6px 10px', border: '1px solid #1a2a1a', background: '#050f05' }}>
                      Distância calculada: <b>{fuelCalc.distancia} km</b>
                      <span style={{ color: '#888', marginLeft: 8 }}>(rota estimada)</span>
                    </div>
                  )}

                  {/* Consumo / Preço / Veículos */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 8 }}>
                    {[['Consumo (km/l)', 'consumo'], ['Preço (R$/L)', 'preco'], ['Nº Veículos', 'nveiculos']].map(([lbl, fld]) => (
                      <div key={fld}>
                        <div style={{ fontSize: 12, color: '#888', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 1 }}>{lbl}</div>
                        <input type="number" value={fuelCalc[fld]}
                          onChange={e => setFuelCalc(f => ({ ...f, [fld]: e.target.value }))}
                          style={{ ...INP, fontSize: 13 }}
                          onFocus={e => e.target.style.borderColor = '#fff'}
                          onBlur={e => e.target.style.borderColor = '#222'}
                        />
                      </div>
                    ))}
                  </div>

                  {/* Resultado */}
                  {fuelCalc.distancia ? (
                    <div style={{ background: '#0a0a0a', border: '1px solid #222', padding: '10px 12px' }}>
                      <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>
                        {fuelCalc.distancia} km × 2 (ida+volta) × 1,15 (margem) ÷ {fuelCalc.consumo} km/l × R$ {fuelCalc.preco}/L × {fuelCalc.nveiculos} veíc.
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>{fmt(fuelDistTotal)}</span>
                        <button
                          onClick={() => usarValorCombustivel(Math.round(fuelDistTotal * 100) / 100)}
                          style={{ padding: '7px 14px', background: '#fff', color: '#000', border: 'none', fontFamily: 'Space Mono,monospace', fontSize: 12, cursor: 'pointer', letterSpacing: 1, textTransform: 'uppercase', fontWeight: 700 }}>
                          Usar Este Valor
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: 13, color: '#555', textAlign: 'center', padding: '6px 0' }}>
                      Calcule a distância para ver o valor estimado
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Pedágio: link Mapeia ── */}
          {cat === 'Pedágio' && !isSecondary && (
            <div style={{ padding: '10px 12px', borderBottom: '1px solid #111', background: '#050505', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, color: '#888' }}>
                Consulte o valor dos pedágios no site e informe o valor abaixo
              </span>
              <button
                onClick={() => window.open('https://www.mapeia.com.br/', '_blank')}
                style={{ padding: '7px 12px', background: 'transparent', border: '1px solid #ff9800', color: '#ff9800', fontFamily: 'Space Mono,monospace', fontSize: 13, cursor: 'pointer', letterSpacing: 1, textTransform: 'uppercase', whiteSpace: 'nowrap', flexShrink: 0 }}>
                🛣️ Consultar Pedágios
              </button>
            </div>
          )}

          {/* Items */}
          <div style={{ padding: '8px 12px' }}>
            {catItems.map((item, idx) => {
              const realVal    = realEdits[item.id] !== undefined ? realEdits[item.id] : String(item.real || 0);
              const realFloat  = parseFloat(realVal) || 0;
              const inputColor = item.prev > 0 ? (realFloat > item.prev ? '#f44336' : '#4caf50') : '#4caf50';
              const comps      = comprovantes[item.id] || [];
              const isLast     = idx === catItems.length - 1;
              const adiantInfo = adiantMap[item.id];
              const adiantVal  = adiantEdits[item.id] !== undefined ? adiantEdits[item.id] : String(adiantInfo?.valor || '');

              return (
                <div key={item.id} style={{ marginBottom: isLast ? 0 : 12, paddingBottom: isLast ? 0 : 12, borderBottom: isLast ? 'none' : '1px solid #111' }}>
                  {/* Realizado row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 14, color: '#888', flexShrink: 0, width: 18 }}>
                      #{adiantInfo?.numero || (idx + 1)}
                    </span>
                    <input type="number" value={realVal}
                      onChange={e => setRealEdits(prev => ({ ...prev, [item.id]: e.target.value }))}
                      onBlur={() => saveReal(item)} placeholder="Realizado R$"
                      style={{ ...INP, flex: 1, color: inputColor, fontWeight: 700, fontSize: 14, border: 'none', borderBottom: '1px solid #333', background: 'transparent', padding: '4px 0' }}
                    />
                    <label style={{ cursor: 'pointer', flexShrink: 0 }}>
                      <input type="file" accept="image/*,application/pdf" capture="environment" style={{ display: 'none' }}
                        onChange={e => handleComprovante(item, e.target.files[0])} />
                      <span style={{ fontSize: 14, padding: '6px 7px', border: '1px solid #444', color: uploadingFor[item.id] ? '#888' : '#aaa', fontFamily: 'Space Mono,monospace', whiteSpace: 'nowrap', display: 'block' }}>
                        {uploadingFor[item.id] ? '...' : (comps.length > 0 ? '📎✓' : '📎')}
                      </span>
                    </label>
                    {!isSecondary && (
                      <button onClick={() => deleteBudgetItem(show.id, item.id)} style={{ background: 'transparent', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0, flexShrink: 0 }}>🗑️</button>
                    )}
                  </div>

                  {/* Visível para equipe toggle */}
                  {canApprove && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, paddingLeft: 26 }}>
                      <span style={{ fontSize: 12, color: '#555', minWidth: 90, flexShrink: 0 }}>Visível equipe</span>
                      <div onClick={() => toggleVisibilidade(item.id)} style={{
                        width: 32, height: 18, borderRadius: 9,
                        background: adiantMap[item.id]?.visivel === true ? '#4caf50' : '#222',
                        position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0,
                      }}>
                        <div style={{
                          position: 'absolute', width: 14, height: 14, background: '#fff',
                          borderRadius: '50%', top: 2,
                          left: adiantMap[item.id]?.visivel === true ? 16 : 2,
                          transition: 'left 0.2s',
                        }}/>
                      </div>
                      <span style={{ fontSize: 12, color: adiantMap[item.id]?.visivel === true ? '#4caf50' : '#555' }}>
                        {adiantMap[item.id]?.visivel === true ? 'Sim' : 'Não'}
                      </span>
                    </div>
                  )}

                  {/* Adiantamento row */}
                  {!isSecondary && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, paddingLeft: 26 }}>
                      <span style={{ fontSize: 12, color: '#666', minWidth: 90, flexShrink: 0 }}>Adiantamento</span>
                      <input type="number" value={adiantVal}
                        onChange={e => setAdiantEdits(prev => ({ ...prev, [item.id]: e.target.value }))}
                        placeholder="R$ 0,00"
                        style={{ ...INP_SM, maxWidth: 110, fontSize: 13 }} />
                      <button onClick={() => requestAdiantamento(item.id)} style={{
                        padding: '5px 10px', background: 'transparent', border: '1px solid #aaa',
                        color: '#aaa', fontFamily: 'Space Mono,monospace', fontSize: 12,
                        cursor: 'pointer', letterSpacing: 1, textTransform: 'uppercase', whiteSpace: 'nowrap',
                      }}>Solicitar</button>
                      {adiantInfo?.status && (
                        <span
                          onClick={() => cycleAdiantStatus(item.id)}
                          title={canApprove ? 'Clique para avançar status' : ''}
                          style={{
                            fontSize: 12, padding: '3px 8px', letterSpacing: 1,
                            border: `1px solid ${ADIANT_STATUS[adiantInfo.status]?.color || '#888'}`,
                            color: ADIANT_STATUS[adiantInfo.status]?.color || '#888',
                            textTransform: 'uppercase',
                            cursor: canApprove ? 'pointer' : 'default',
                            whiteSpace: 'nowrap',
                          }}>
                          {ADIANT_STATUS[adiantInfo.status]?.label || adiantInfo.status}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Comprovantes */}
                  {comps.length > 0 && (
                    <div style={{ marginTop: 6, marginLeft: 26, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {comps.map(c => (
                        /\.(jpg|jpeg|png|gif|webp)$/i.test(c.url) ? (
                          <a key={c.id} href={c.url} target="_blank" rel="noopener noreferrer">
                            <img src={c.url} alt="comprovante" style={{ width: 56, height: 56, objectFit: 'cover', border: '1px solid #333', display: 'block' }} />
                          </a>
                        ) : (
                          <a key={c.id} href={c.url} target="_blank" rel="noopener noreferrer"
                            style={{ fontSize: 13, color: '#4caf50', padding: '4px 6px', border: '1px solid #1a2a1a', background: '#050f05', display: 'block', textDecoration: 'none' }}>
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

          {/* Group total */}
          <div style={{ padding: '8px 12px', borderTop: '1px solid #111', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 14, color: '#bbb', letterSpacing: 1, textTransform: 'uppercase' }}>Total Realizado</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: groupOver ? '#f44336' : '#4caf50' }}>{fmt(groupReal)}</span>
          </div>
        </div>
      );
    });
  };

  // ── Add-member bar ────────────────────────────────────────────────
  function AddMemberBar({ options, selVal, onSelChange, onAdd }) {
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
        }}>+ Membro</button>
      </div>
    ) : null;
  }

  function EmptyMemberSection({ scaledCount }) {
    return (
      <div style={{ fontSize: 13, color: '#555', padding: '12px 0', textAlign: 'center', letterSpacing: 1 }}>
        {scaledCount === 0 ? 'Nenhum membro escalado para este show' : 'Use o seletor acima para adicionar um membro'}
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div>
      <PageHeader label="Módulo" title="Orçamento"
        action={show && !isSecondary && (
          <Btn size="sm" variant="outline" onClick={() => setReportModal(true)}>📊 Relatório</Btn>
        )}
      />

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
            action={<AddMemberBar options={availDiaria} selVal={diariaAddSel} onSelChange={setDiariaAddSel} onAdd={addDiariaMember} />}
          >
            {diariaMembers.length === 0 ? <EmptyMemberSection scaledCount={scaledMembers.length} />
              : diariaMembers.map((m, idx) => {
                const dt = pf(m.diariaVal)*qi(m.diariaQty), mt = pf(m.meiaVal)*qi(m.meiaQty), total = dt + mt;
                const diItem = (budgets[show.id] || []).find(i => i.cat === `Diária - ${m.name}`);
                const miItem = (budgets[show.id] || []).find(i => i.cat === `Meia Diária - ${m.name}`);
                return (
                  <div key={m.memberId} style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', padding: '12px 14px', marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <div style={{ fontSize: 15, fontWeight: 700 }}>{m.name}</div>
                      <button onClick={() => removeDiariaMember(m.memberId)} style={{ background: 'transparent', border: 'none', color: '#f44336', cursor: 'pointer', fontSize: 16 }}>🗑️</button>
                    </div>
                    {[['Diária', 'diariaVal', 'diariaQty', dt], ['Meia Diária', 'meiaVal', 'meiaQty', mt]].map(([label, vf, qf, lineTotal]) => (
                      <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <span style={ROW_LABEL}>{label}</span>
                        <input type="number" value={m[vf]} onChange={e => updateDiaria(idx, vf, e.target.value)} onBlur={() => saveDiariaLine(diariaRef.current[idx])} placeholder="R$ unit." style={{ ...INP_SM, maxWidth: 110 }} />
                        <span style={{ fontSize: 14, color: '#555' }}>×</span>
                        <input type="number" value={m[qf]} onChange={e => updateDiaria(idx, qf, e.target.value)} onBlur={() => saveDiariaLine(diariaRef.current[idx])} placeholder="Qtd" style={{ ...INP_SM, maxWidth: 70 }} />
                        <span style={{ fontSize: 14, color: '#4caf50', marginLeft: 'auto', minWidth: 90, textAlign: 'right' }}>{fmt(lineTotal)}</span>
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #222', paddingTop: 8 }}>
                      <span style={{ fontSize: 13, color: '#aaa', textTransform: 'uppercase', letterSpacing: 1 }}>Total</span>
                      <span style={{ fontSize: 15, fontWeight: 700, color: total > 0 ? '#fff' : '#555' }}>{fmt(total)}</span>
                    </div>
                    {canApprove && [diItem, miItem].filter(Boolean).map(itm => (
                      <div key={itm.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, paddingTop: 6, borderTop: '1px solid #111' }}>
                        <span style={{ fontSize: 12, color: '#555', minWidth: 90, flexShrink: 0 }}>
                          {itm.cat.replace(` - ${m.name}`, '')} visível
                        </span>
                        <div onClick={() => toggleVisibilidade(itm.id)} style={{
                          width: 32, height: 18, borderRadius: 9,
                          background: adiantMap[itm.id]?.visivel === true ? '#4caf50' : '#222',
                          position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0,
                        }}>
                          <div style={{
                            position: 'absolute', width: 14, height: 14, background: '#fff',
                            borderRadius: '50%', top: 2,
                            left: adiantMap[itm.id]?.visivel === true ? 16 : 2,
                            transition: 'left 0.2s',
                          }}/>
                        </div>
                        <span style={{ fontSize: 12, color: adiantMap[itm.id]?.visivel === true ? '#4caf50' : '#555' }}>
                          {adiantMap[itm.id]?.visivel === true ? 'Sim' : 'Não'}
                        </span>
                      </div>
                    ))}
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
            action={<AddMemberBar options={availAlim} selVal={alimAddSel} onSelChange={setAlimAddSel} onAdd={addAlimMember} />}
          >
            {alimMembers.length === 0 ? <EmptyMemberSection scaledCount={scaledMembers.length} />
              : alimMembers.map((m, idx) => {
                const ct = pf(m.cafeVal)*qi(m.cafeQty), at = pf(m.almocoVal)*qi(m.almocoQty), jt = pf(m.jantarVal)*qi(m.jantarQty), total = ct + at + jt;
                const aiItem = (budgets[show.id] || []).find(i => i.cat === `Alimentação - ${m.name}`);
                return (
                  <div key={m.memberId} style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', padding: '12px 14px', marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <div style={{ fontSize: 15, fontWeight: 700 }}>{m.name}</div>
                      <button onClick={() => removeAlimMember(m.memberId)} style={{ background: 'transparent', border: 'none', color: '#f44336', cursor: 'pointer', fontSize: 16 }}>🗑️</button>
                    </div>
                    {[['Café da Manhã','cafeVal','cafeQty',ct],['Almoço','almocoVal','almocoQty',at],['Jantar','jantarVal','jantarQty',jt]].map(([label, vf, qf, lineTotal]) => (
                      <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <span style={ROW_LABEL}>{label}</span>
                        <input type="number" value={m[vf]} onChange={e => updateAlim(idx, vf, e.target.value)} onBlur={() => saveAlimLine(alimRef.current[idx])} placeholder="R$ unit." style={{ ...INP_SM, maxWidth: 110 }} />
                        <span style={{ fontSize: 14, color: '#555' }}>×</span>
                        <input type="number" value={m[qf]} onChange={e => updateAlim(idx, qf, e.target.value)} onBlur={() => saveAlimLine(alimRef.current[idx])} placeholder="Qtd" style={{ ...INP_SM, maxWidth: 70 }} />
                        <span style={{ fontSize: 14, color: '#4caf50', marginLeft: 'auto', minWidth: 90, textAlign: 'right' }}>{fmt(lineTotal)}</span>
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #222', paddingTop: 8, marginTop: 4 }}>
                      <span style={{ fontSize: 13, color: '#aaa', textTransform: 'uppercase', letterSpacing: 1 }}>Total</span>
                      <span style={{ fontSize: 15, fontWeight: 700, color: total > 0 ? '#fff' : '#555' }}>{fmt(total)}</span>
                    </div>
                    {canApprove && aiItem && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, paddingTop: 6, borderTop: '1px solid #111' }}>
                        <span style={{ fontSize: 12, color: '#555', minWidth: 90, flexShrink: 0 }}>Alimentação visível</span>
                        <div onClick={() => toggleVisibilidade(aiItem.id)} style={{
                          width: 32, height: 18, borderRadius: 9,
                          background: adiantMap[aiItem.id]?.visivel === true ? '#4caf50' : '#222',
                          position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0,
                        }}>
                          <div style={{
                            position: 'absolute', width: 14, height: 14, background: '#fff',
                            borderRadius: '50%', top: 2,
                            left: adiantMap[aiItem.id]?.visivel === true ? 16 : 2,
                            transition: 'left 0.2s',
                          }}/>
                        </div>
                        <span style={{ fontSize: 12, color: adiantMap[aiItem.id]?.visivel === true ? '#4caf50' : '#555' }}>
                          {adiantMap[aiItem.id]?.visivel === true ? 'Sim' : 'Não'}
                        </span>
                      </div>
                    )}
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

        {/* ── BOTÃO SALVAR DIÁRIAS E ALIMENTAÇÃO ── */}
        {!isSecondary && (diariaMembers.length > 0 || alimMembers.length > 0) && (
          <div style={{ padding: '0 16px 14px' }}>
            <button
              onClick={saveAllDiariaAlim}
              disabled={savingDiariaAlim}
              style={{
                width: '100%', padding: '14px 0',
                background: savedDiariaAlim ? '#4caf50' : '#fff',
                color: '#000', border: 'none',
                fontFamily: 'Space Mono,monospace', fontSize: 14,
                cursor: savingDiariaAlim ? 'wait' : 'pointer',
                letterSpacing: 2, textTransform: 'uppercase', fontWeight: 700,
                transition: 'all 0.3s',
              }}
            >
              {savingDiariaAlim ? 'Salvando...' : savedDiariaAlim ? '✓ Salvo com sucesso!' : '💾 Salvar Diárias e Alimentação'}
            </button>
          </div>
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

      {/* ── Modal Add Despesa ── */}
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

      {/* ── Modal Relatórios ── */}
      {reportModal && show && (
        <Modal title="Gerar Relatório" onClose={() => setReportModal(false)}>
          <div style={{ fontSize: 13, color: '#888', marginBottom: 14 }}>
            {show.client} — {fmtDate(show.date)}
          </div>

          {[
            { key: 'A', label: 'Adiantamento de Despesas',  onExcel: () => handleReportA('excel'), onPdf: () => handleReportA('pdf') },
            { key: 'B', label: 'Adiantamento vs Realizado', onExcel: () => handleReportB('excel'), onPdf: () => handleReportB('pdf') },
            { key: 'C', label: 'Relatório Final',            onExcel: () => handleReportC('excel'), onPdf: () => handleReportC('pdf') },
            { key: 'D', label: 'Total de Despesas',          onExcel: () => handleReportD('excel'), onPdf: () => handleReportD('pdf') },
          ].map(r => (
            <div key={r.key} style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', padding: '10px 12px', marginBottom: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
                <span style={{ color: '#4caf50', marginRight: 8 }}>{r.key}.</span>{r.label}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { r.onExcel(); }} style={{
                  flex: 1, padding: '7px 0', background: 'transparent', border: '1px solid #4caf50',
                  color: '#4caf50', fontFamily: 'Space Mono,monospace', fontSize: 13, cursor: 'pointer',
                  letterSpacing: 1, textTransform: 'uppercase',
                }}>↓ Excel</button>
                <button onClick={() => { r.onPdf(); }} style={{
                  flex: 1, padding: '7px 0', background: 'transparent', border: '1px solid #2196f3',
                  color: '#2196f3', fontFamily: 'Space Mono,monospace', fontSize: 13, cursor: 'pointer',
                  letterSpacing: 1, textTransform: 'uppercase',
                }}>🖨 PDF</button>
              </div>
            </div>
          ))}

          <div style={{ marginTop: 8 }}>
            <Btn full variant="ghost" onClick={() => setReportModal(false)}>Fechar</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default Orcamento;
