import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../supabase';

const AppContext = createContext(null);

function getFileType(name) {
  const ext = (name || '').split('.').pop().toLowerCase();
  if (ext === 'pdf') return 'pdf';
  if (['jpg','jpeg','png','gif','webp'].includes(ext)) return 'img';
  if (['doc','docx'].includes(ext)) return 'word';
  if (['xls','xlsx'].includes(ext)) return 'excel';
  return 'other';
}
function formatFileSize(bytes) {
  return bytes > 1048576 ? (bytes / 1048576).toFixed(1) + ' MB' : (bytes / 1024).toFixed(0) + ' KB';
}
function todayFmt() {
  const d = new Date();
  const p = n => n < 10 ? '0' + n : n;
  return `${p(d.getDate())}/${p(d.getMonth()+1)}/${d.getFullYear()}`;
}

export function AppProvider({ children }) {
  const [drones, setDrones] = useState([]);
  const [shows, setShows] = useState([]);
  const [members, setMembers] = useState([]);
  const [scaling, setScaling] = useState({});
  const [budgets, setBudgets] = useState({});
  const [comprovantes, setComprovantes] = useState({});
  const [docs, setDocs] = useState({});
  const [adminDocs, setAdminDocs] = useState([]);
  const [inventory, setInventory] = useState({
    batSean: 0, batMagic: 0, rtk: [], ap: [], servidor: [], computador: [],
    quantities: { rede: 0, energia: 0, radio: 0, star: 0, tripes: 0 }
  });
  const [manuals, setManuals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([
      loadShows(),
      loadDrones(),
      loadMembers(),
      loadManuals(),
      loadAdminDocs(),
    ]);
    setLoading(false);
  };

  // ─── SHOWS ───────────────────────────────────────
  const loadShows = async () => {
    const { data } = await supabase.from('shows').select('*').order('data');
    if (data) setShows(data.map(s => ({
      id: s.id, date: s.data, status: s.status, client: s.cliente,
      drones: s.drones, city: s.cidade, state: s.estado, test: s.data_teste, valor: s.valor || null
    })));
  };

  const addShow = async (show) => {
    const insertData = {
      data: show.date,
      status: show.status,
      cliente: show.client,
      drones: parseInt(show.drones) || 0,
      cidade: show.city || '',
      estado: show.state || '',
      data_teste: show.test || null,
      valor: show.valor || null,
    };
    const { data, error } = await supabase.from('shows').insert(insertData).select().single();
    if (error) {
      alert('Erro Supabase: ' + error.message + ' | Código: ' + error.code);
      return null;
    }
    if (data) {
      setShows(prev => [...prev, {
        id: data.id, date: data.data, status: data.status, client: data.cliente,
        drones: data.drones, city: data.cidade, state: data.estado, test: data.data_teste, valor: data.valor
      }]);
      return data;
    }
    return null;
  };

  const deleteShow = async (id) => {
    await supabase.from('shows').delete().eq('id', id);
    setShows(prev => prev.filter(s => s.id !== id));
  };

  const updateShow = async (id, show) => {
    await supabase.from('shows').update({
      data: show.date, status: show.status, cliente: show.client,
      drones: show.drones, cidade: show.city, estado: show.state,
      data_teste: show.test, valor: show.valor || null
    }).eq('id', id);
    setShows(prev => prev.map(s => s.id === id ? { ...s, ...show } : s));
  };

  const dronesUsedOnDate = (date, excludeId = null) =>
    shows.filter(s => s.date === date && s.id !== excludeId).reduce((acc, s) => acc + s.drones, 0);

  // ─── DRONES ──────────────────────────────────────
  const loadDrones = async () => {
    const { data } = await supabase.from('drones').select('*').order('created_at');
    if (data) setDrones(data.map(d => ({ id: d.id, serial: d.serial, status: d.status })));
  };

  const addDrone = async (drone) => {
    const { data } = await supabase.from('drones').insert({ serial: drone.serial, status: drone.status }).select().single();
    if (data) setDrones(prev => [...prev, { id: data.id, serial: data.serial, status: data.status }]);
  };

  const updateDroneStatus = async (id, status) => {
    await supabase.from('drones').update({ status }).eq('id', id);
    setDrones(prev => prev.map(d => d.id === id ? { ...d, status } : d));
  };

  const deleteDrone = async (id) => {
    await supabase.from('drones').delete().eq('id', id);
    setDrones(prev => prev.filter(d => d.id !== id));
  };

  const deleteDrones = async (ids) => {
    await supabase.from('drones').delete().in('id', ids);
    setDrones(prev => prev.filter(d => !ids.includes(d.id)));
  };

  const importDrones = async (serials) => {
    const rows = serials.map(serial => ({ serial, status: 'ok' }));
    const { data } = await supabase.from('drones').insert(rows).select();
    if (data) setDrones(prev => [...prev, ...data.map(d => ({ id: d.id, serial: d.serial, status: d.status }))]);
  };

  // ─── MEMBERS ─────────────────────────────────────
  const loadMembers = async () => {
    const { data } = await supabase.from('membros').select('*').order('created_at');
    if (data) setMembers(data.map(m => ({
      id: m.id, name: m.nome, cpf: m.cpf, rg: m.rg,
      email: m.email, tel: m.telefone, sarpas: m.sarpas, perms: m.permissoes
    })));
  };

  const addMember = async (member) => {
    const { data } = await supabase.from('membros').insert({
      nome: member.name, cpf: member.cpf, rg: member.rg,
      email: member.email, telefone: member.tel, sarpas: member.sarpas, permissoes: member.perms
    }).select().single();
    if (data) setMembers(prev => [...prev, {
      id: data.id, name: data.nome, cpf: data.cpf, rg: data.rg,
      email: data.email, tel: data.telefone, sarpas: data.sarpas, perms: data.permissoes
    }]);
  };

  const updateMember = async (id, member) => {
    await supabase.from('membros').update({
      nome: member.name, cpf: member.cpf, rg: member.rg,
      email: member.email, telefone: member.tel, sarpas: member.sarpas, permissoes: member.perms
    }).eq('id', id);
    setMembers(prev => prev.map(m => m.id === id ? { ...m, ...member } : m));
  };

  const updateMemberPerms = async (id, perms) => {
    await supabase.from('membros').update({ permissoes: perms }).eq('id', id);
    setMembers(prev => prev.map(m => m.id === id ? { ...m, perms } : m));
  };
const deleteMember = async (id) => {
  await supabase.from('membros').delete().eq('id', id);
  setMembers(prev => prev.filter(m => m.id !== id));
};

  // ─── SCALING ─────────────────────────────────────
  const loadScaling = async (showId) => {
    const { data } = await supabase.from('escalacao').select('*').eq('show_id', showId);
    if (data) setScaling(prev => ({ ...prev, [showId]: data.map(s => ({ id: s.id, memberId: s.membro_id, role: s.funcao })) }));
    return data || [];
  };

  const clearScalingForShow = async (showId) => {
    await supabase.from('escalacao').delete().eq('show_id', showId);
    setScaling(prev => ({ ...prev, [showId]: [] }));
  };

  const scaleToShow = async (showId, memberId, role) => {
    const { data } = await supabase.from('escalacao').insert({ show_id: showId, membro_id: memberId, funcao: role }).select().single();
    if (data) setScaling(prev => ({ ...prev, [showId]: [...(prev[showId] || []), { id: data.id, memberId, role }] }));
  };

  const removeFromShow = async (showId, idx) => {
    const item = scaling[showId]?.[idx];
    if (item?.id) await supabase.from('escalacao').delete().eq('id', item.id);
    setScaling(prev => ({ ...prev, [showId]: prev[showId].filter((_, i) => i !== idx) }));
  };

  const isMemberBusy = (memberId, excludeShowId) =>
    Object.entries(scaling).some(([showId, scaled]) =>
      showId !== String(excludeShowId) && scaled.some(s => s.memberId === memberId));

  // ─── BUDGET ──────────────────────────────────────
  const loadBudget = async (showId) => {
    const { data } = await supabase.from('orcamento').select('*').eq('show_id', showId);
    if (data) setBudgets(prev => ({ ...prev, [showId]: data.map(i => ({ id: i.id, cat: i.categoria, prev: i.previsto, real: i.realizado })) }));
    return data || [];
  };

  const loadComprovantesForShow = async (itemIds) => {
    if (!itemIds?.length) return;
    const { data } = await supabase.from('comprovantes').select('*').in('orcamento_id', itemIds);
    if (data) {
      const byItem = {};
      data.forEach(c => {
        if (!byItem[c.orcamento_id]) byItem[c.orcamento_id] = [];
        byItem[c.orcamento_id].push({ id: c.id, url: c.url, fileName: c.arquivo });
      });
      setComprovantes(prev => ({ ...prev, ...byItem }));
    }
  };

  // showId e categoriaNome são opcionais — quando passados, sincroniza com a tabela documentacao
  const addComprovante = async (orcamentoId, file, showId, categoriaNome) => {
    const fileName = `${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage.from('comprovantes').upload(fileName, file);
    if (uploadError) { alert('Erro no upload: ' + uploadError.message); return null; }
    const { data: { publicUrl } } = supabase.storage.from('comprovantes').getPublicUrl(fileName);
    const { data, error } = await supabase.from('comprovantes').insert({ orcamento_id: orcamentoId, url: publicUrl, arquivo: fileName }).select().single();
    if (error) { alert('Erro ao salvar comprovante: ' + error.message); return null; }
    if (data) {
      setComprovantes(prev => ({ ...prev, [orcamentoId]: [...(prev[orcamentoId] || []), { id: data.id, url: publicUrl, fileName }] }));
      // Sincroniza automaticamente com a tabela documentacao
      if (showId && categoriaNome) {
        const docName = `Comprovante - ${categoriaNome}`;
        const docRow = { show_id: showId, nome: docName, arquivo: publicUrl, tipo: getFileType(file.name), tamanho: formatFileSize(file.size), data: todayFmt() };
        const { data: docData } = await supabase.from('documentacao').insert(docRow).select().single();
        if (docData) {
          const mapped = { id: docData.id, name: docData.nome, file: docData.arquivo, type: docData.tipo, size: docData.tamanho, date: docData.data };
          setDocs(prev => ({ ...prev, [showId]: [...(prev[showId] || []), mapped] }));
        }
      }
      return data;
    }
    return null;
  };

  const loadAllBudgets = async () => {
    const { data } = await supabase.from('orcamento').select('*');
    if (data) {
      const byShow = {};
      data.forEach(i => {
        if (!byShow[i.show_id]) byShow[i.show_id] = [];
        byShow[i.show_id].push({ id: i.id, cat: i.categoria, prev: i.previsto, real: i.realizado });
      });
      setBudgets(prev => ({ ...prev, ...byShow }));
    }
  };

  const loadAllScaling = async () => {
    const { data } = await supabase.from('escalacao').select('*');
    if (data) {
      const byShow = {};
      data.forEach(s => {
        if (!byShow[s.show_id]) byShow[s.show_id] = [];
        byShow[s.show_id].push({ id: s.id, memberId: s.membro_id, role: s.funcao });
      });
      setScaling(prev => ({ ...prev, ...byShow }));
    }
  };

  const clearBudgetForShow = async (showId) => {
    await supabase.from('orcamento').delete().eq('show_id', showId);
    setBudgets(prev => ({ ...prev, [showId]: [] }));
  };

  const addBudgetItem = async (showId, item) => {
    const { data } = await supabase.from('orcamento').insert({ show_id: showId, categoria: item.cat, previsto: item.prev, realizado: item.real }).select().single();
    if (data) setBudgets(prev => ({ ...prev, [showId]: [...(prev[showId] || []), { id: data.id, cat: data.categoria, prev: data.previsto, real: data.realizado }] }));
  };

  const updateBudgetItem = async (showId, itemId, updates) => {
    const fields = {};
    if (updates.prev !== undefined) fields.previsto = updates.prev;
    if (updates.real !== undefined) fields.realizado = updates.real;
    await supabase.from('orcamento').update(fields).eq('id', itemId);
    setBudgets(prev => ({
      ...prev,
      [showId]: (prev[showId] || []).map(i => i.id === itemId ? { ...i, ...updates } : i)
    }));
  };

  const deleteBudgetItem = async (showId, itemId) => {
    await supabase.from('orcamento').delete().eq('id', itemId);
    setBudgets(prev => ({ ...prev, [showId]: prev[showId].filter(i => i.id !== itemId) }));
  };

  // ─── DOCS ────────────────────────────────────────
  const loadAdminDocs = async () => {
    const { data } = await supabase.from('documentacao').select('*').is('show_id', null);
    if (data) setAdminDocs(data.map(d => ({ id: d.id, name: d.nome, file: d.arquivo, type: d.tipo, size: d.tamanho, date: d.data })));
  };

  const loadDocs = async (showId) => {
    const { data } = await supabase.from('documentacao').select('*').eq('show_id', showId);
    if (data) setDocs(prev => ({ ...prev, [showId]: data.map(d => ({ id: d.id, name: d.nome, file: d.arquivo, type: d.tipo, size: d.tamanho, date: d.data })) }));
  };

  // showId = null para documentos administrativos; file (File object) opcional para upload ao Storage
  const addDoc = async (showId, doc, file) => {
    let fileUrl = doc.file || '';
    if (file) {
      const storageFileName = `${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage.from('comprovantes').upload(storageFileName, file);
      if (upErr) { alert('Erro no upload: ' + upErr.message); return null; }
      const { data: { publicUrl } } = supabase.storage.from('comprovantes').getPublicUrl(storageFileName);
      fileUrl = publicUrl;
    }
    const row = { nome: doc.name, arquivo: fileUrl, tipo: doc.type, tamanho: doc.size, data: doc.date };
    if (showId) row.show_id = showId;
    const { data } = await supabase.from('documentacao').insert(row).select().single();
    if (data) {
      const mapped = { id: data.id, name: data.nome, file: data.arquivo, type: data.tipo, size: data.tamanho, date: data.data };
      if (showId) setDocs(prev => ({ ...prev, [showId]: [...(prev[showId] || []), mapped] }));
      else setAdminDocs(prev => [...prev, mapped]);
      return data;
    }
    return null;
  };

  const deleteDoc = async (showId, docId) => {
    await supabase.from('documentacao').delete().eq('id', docId);
    if (showId) setDocs(prev => ({ ...prev, [showId]: prev[showId].filter(d => d.id !== docId) }));
    else setAdminDocs(prev => prev.filter(d => d.id !== docId));
  };

  // ─── INVENTORY ───────────────────────────────────
  const updateInventory = (data) => setInventory(prev => ({ ...prev, ...data }));
  const addSerialItem = async (type, value) => {
    await supabase.from('inventario').insert({ tipo: type, valor: value });
    setInventory(prev => ({ ...prev, [type]: [...(prev[type] || []), { id: Date.now(), value }] }));
  };
  const deleteSerialItem = async (type, id) => {
    await supabase.from('inventario').delete().eq('id', id);
    setInventory(prev => ({ ...prev, [type]: prev[type].filter(i => i.id !== id) }));
  };

  // ─── MANUALS ─────────────────────────────────────
  const loadManuals = async () => {
    const { data: topics } = await supabase.from('manuais_topicos').select('*, manuais_arquivos(*)').order('created_at');
    if (topics) setManuals(topics.map(t => ({
      id: t.id, name: t.nome, icon: t.icone,
      files: (t.manuais_arquivos || []).map(f => ({ id: f.id, name: f.nome, file: f.arquivo, type: f.tipo, size: f.tamanho, date: f.data }))
    })));
  };

  const addManualTopic = async (topic) => {
    const { data } = await supabase.from('manuais_topicos').insert({ nome: topic.name, icone: topic.icon }).select().single();
    if (data) setManuals(prev => [...prev, { id: data.id, name: data.nome, icon: data.icone, files: [] }]);
  };

  const addManualFile = async (topicId, file) => {
    const { data } = await supabase.from('manuais_arquivos').insert({ topico_id: topicId, nome: file.name, arquivo: file.file, tipo: file.type, tamanho: file.size, data: file.date }).select().single();
    if (data) setManuals(prev => prev.map(t => t.id === topicId ? { ...t, files: [...t.files, { id: data.id, name: data.nome, file: data.arquivo, type: data.tipo, size: data.tamanho, date: data.data }] } : t));
  };

  const deleteManualFile = async (topicId, fileId) => {
    await supabase.from('manuais_arquivos').delete().eq('id', fileId);
    setManuals(prev => prev.map(t => t.id === topicId ? { ...t, files: t.files.filter(f => f.id !== fileId) } : t));
  };

  if (loading) return (
    <div style={{ background: '#000', color: '#fff', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Space Mono, monospace', fontSize: 11, letterSpacing: 3 }}>
      CARREGANDO...
    </div>
  );

  return (
    <AppContext.Provider value={{
      drones, addDrone, updateDroneStatus, importDrones, deleteDrone, deleteDrones,
      shows, addShow, updateShow, deleteShow, dronesUsedOnDate,
      members, addMember, updateMember, updateMemberPerms, deleteMember,
      scaling, scaleToShow, removeFromShow, isMemberBusy, loadScaling, clearScalingForShow,
      budgets, addBudgetItem, updateBudgetItem, deleteBudgetItem, loadBudget, clearBudgetForShow,
      comprovantes, addComprovante, loadComprovantesForShow,
      adminDocs, loadAdminDocs,
      loadAllBudgets, loadAllScaling,
      docs, adminDocs, addDoc, deleteDoc, loadDocs, loadAdminDocs,
      inventory, updateInventory, addSerialItem, deleteSerialItem,
      manuals, addManualTopic, addManualFile, deleteManualFile,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}