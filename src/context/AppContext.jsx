import React, { createContext, useContext, useState } from 'react';

const AppContext = createContext(null);

const initialDrones = [
  { id: 1, serial: 'MD-2024-0001', status: 'ok' },
  { id: 2, serial: 'MD-2024-0002', status: 'ok' },
  { id: 3, serial: 'MD-2024-0003', status: 'manut' },
  { id: 4, serial: 'MD-2024-0047', status: 'bad' },
];

const initialShows = [
  { id: 1, date: '2026-05-15', status: 'conf', client: 'Festival Aurora SP', drones: 200, city: 'São Paulo', state: 'SP', test: '2026-05-13' },
  { id: 2, date: '2026-05-28', status: 'neg',  client: 'Réveillon RJ',        drones: 150, city: 'Rio de Janeiro', state: 'RJ', test: '2026-05-26' },
  { id: 3, date: '2026-06-12', status: 'conf', client: 'Expo Tech Sul',        drones: 100, city: 'Curitiba', state: 'PR', test: '2026-06-10' },
];

const initialMembers = [
  { id: 1, name: 'Ricardo Costa', cpf: '123.456.789-00', rg: '12.345.678-9', email: 'ricardo@magicdrone.com', tel: '(12) 99999-0001', sarpas: 'BR-2024-001', perms: { inventario: true, agenda: true, checklist: true, equipe: false, orcamento: false, documentacao: true, manual: true } },
  { id: 2, name: 'Ana Lima',      cpf: '987.654.321-00', rg: '98.765.432-1', email: 'ana@magicdrone.com',     tel: '(12) 99999-0002', sarpas: 'BR-2024-002', perms: { inventario: false, agenda: false, checklist: true, equipe: false, orcamento: false, documentacao: false, manual: true } },
  { id: 3, name: 'Marcos Silva',  cpf: '111.222.333-44', rg: '11.222.333-4', email: 'marcos@magicdrone.com',  tel: '(12) 99999-0003', sarpas: '',            perms: { inventario: true, agenda: false, checklist: true, equipe: false, orcamento: false, documentacao: false, manual: true } },
];

const initialScaling = { 1: [], 2: [], 3: [] };

const initialBudgets = {
  1: [{ id: 1, cat: 'Hotel',       prev: 4800, real: 4800 }, { id: 2, cat: 'Combustível', prev: 320, real: 290 }, { id: 3, cat: 'Pedágio', prev: 180, real: 195 }],
  2: [],
  3: [{ id: 1, cat: 'Hotel',       prev: 2400, real: 0 },    { id: 2, cat: 'Combustível', prev: 900, real: 0 }],
};

const initialDocs = {
  1: [{ id: 1, name: 'Autorização ANAC', file: 'anac_aurora.pdf', type: 'pdf', size: '245 KB', date: '10/04/2026' }],
  2: [],
  3: [{ id: 1, name: 'Autorização DECEA', file: 'decea_cwb.pdf', type: 'pdf', size: '512 KB', date: '20/03/2026' }],
};

const initialInventory = {
  batSean: 240,
  batMagic: 180,
  rtk: [],
  ap: [],
  servidor: [],
  computador: [],
  quantities: { rede: 12, energia: 8, radio: 4, star: 2, tripes: 6 },
};

const initialManuals = [
  { id: 1, name: 'Operação de Voo',  icon: '🚁', files: [{ id: 1, name: 'Manual de Operação Padrão', file: 'manual_operacao.pdf', type: 'pdf', size: '2.1 MB', date: '10/01/2026' }] },
  { id: 2, name: 'Segurança',        icon: '🛡️', files: [{ id: 1, name: 'Protocolo de Emergência',   file: 'emergencia.pdf',    type: 'pdf', size: '1.5 MB', date: '05/02/2026' }] },
  { id: 3, name: 'Manutenção',       icon: '🔧', files: [{ id: 1, name: 'Guia de Manutenção',        file: 'manutencao.pdf',    type: 'pdf', size: '3.2 MB', date: '20/02/2026' }] },
  { id: 4, name: 'Regulamentação',   icon: '📋', files: [{ id: 1, name: 'Normas ANAC e DECEA',       file: 'normas.pdf',        type: 'pdf', size: '4.5 MB', date: '01/03/2026' }] },
  { id: 5, name: 'Software',         icon: '💻', files: [{ id: 1, name: 'Manual do Software de Voo', file: 'software.pdf',      type: 'pdf', size: '5.1 MB', date: '10/03/2026' }] },
];

export function AppProvider({ children }) {
  const [drones, setDrones] = useState(initialDrones);
  const [shows, setShows] = useState(initialShows);
  const [members, setMembers] = useState(initialMembers);
  const [scaling, setScaling] = useState(initialScaling);
  const [budgets, setBudgets] = useState(initialBudgets);
  const [docs, setDocs] = useState(initialDocs);
  const [inventory, setInventory] = useState(initialInventory);
  const [manuals, setManuals] = useState(initialManuals);

  // --- DRONES ---
  const addDrone = (drone) => setDrones(prev => [...prev, { ...drone, id: Date.now() }]);
  const updateDroneStatus = (id, status) => setDrones(prev => prev.map(d => d.id === id ? { ...d, status } : d));
  const importDrones = (serials) => {
    const newDrones = serials.map(serial => ({ id: Date.now() + Math.random(), serial, status: 'ok' }));
    setDrones(prev => [...prev, ...newDrones]);
  };

  // --- SHOWS ---
  const addShow = (show) => setShows(prev => [...prev, { ...show, id: Date.now() }]);
  const updateShow = (id, data) => setShows(prev => prev.map(s => s.id === id ? { ...s, ...data } : s));
  const dronesUsedOnDate = (date, excludeId = null) =>
    shows.filter(s => s.date === date && s.id !== excludeId).reduce((acc, s) => acc + s.drones, 0);

  // --- MEMBERS ---
  const addMember = (member) => setMembers(prev => [...prev, { ...member, id: Date.now() }]);
  const updateMemberPerms = (id, perms) => setMembers(prev => prev.map(m => m.id === id ? { ...m, perms } : m));

  // --- SCALING ---
  const scaleToShow = (showId, memberId, role) =>
    setScaling(prev => ({ ...prev, [showId]: [...(prev[showId] || []), { memberId, role }] }));
  const removeFromShow = (showId, idx) =>
    setScaling(prev => ({ ...prev, [showId]: prev[showId].filter((_, i) => i !== idx) }));
  const isMemberBusy = (memberId, excludeShowId) =>
    Object.entries(scaling).some(([showId, scaled]) =>
      parseInt(showId) !== excludeShowId && scaled.some(s => s.memberId === memberId));

  // --- BUDGET ---
  const addBudgetItem = (showId, item) =>
    setBudgets(prev => ({ ...prev, [showId]: [...(prev[showId] || []), { ...item, id: Date.now() }] }));
  const deleteBudgetItem = (showId, itemId) =>
    setBudgets(prev => ({ ...prev, [showId]: prev[showId].filter(i => i.id !== itemId) }));

  // --- DOCS ---
  const addDoc = (showId, doc) =>
    setDocs(prev => ({ ...prev, [showId]: [...(prev[showId] || []), { ...doc, id: Date.now() }] }));
  const deleteDoc = (showId, docId) =>
    setDocs(prev => ({ ...prev, [showId]: prev[showId].filter(d => d.id !== docId) }));

  // --- INVENTORY ---
  const updateInventory = (data) => setInventory(prev => ({ ...prev, ...data }));
  const addSerialItem = (type, value) =>
    setInventory(prev => ({ ...prev, [type]: [...prev[type], { id: Date.now(), value }] }));
  const deleteSerialItem = (type, id) =>
    setInventory(prev => ({ ...prev, [type]: prev[type].filter(i => i.id !== id) }));

  // --- MANUALS ---
  const addManualTopic = (topic) => setManuals(prev => [...prev, { ...topic, id: Date.now(), files: [] }]);
  const addManualFile = (topicId, file) =>
    setManuals(prev => prev.map(t => t.id === topicId ? { ...t, files: [...t.files, { ...file, id: Date.now() }] } : t));
  const deleteManualFile = (topicId, fileId) =>
    setManuals(prev => prev.map(t => t.id === topicId ? { ...t, files: t.files.filter(f => f.id !== fileId) } : t));

  return (
    <AppContext.Provider value={{
      drones, addDrone, updateDroneStatus, importDrones,
      shows, addShow, updateShow, dronesUsedOnDate,
      members, addMember, updateMemberPerms,
      scaling, scaleToShow, removeFromShow, isMemberBusy,
      budgets, addBudgetItem, deleteBudgetItem,
      docs, addDoc, deleteDoc,
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
