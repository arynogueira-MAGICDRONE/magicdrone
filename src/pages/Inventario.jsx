import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { useApp } from '../context/AppContext';
import { PageHeader, Btn, Input, Select, Modal, ModalBtns, Section, StatusPill, Empty } from '../components/layout/UI';

function pad(n) { return n < 10 ? '0' + n : n; }

export default function Inventario() {
  const { drones, addDrone, updateDroneStatus, importDrones, deleteDrone, deleteDrones, inventory, updateInventory, addSerialItem, deleteSerialItem } = useApp();

  const [filter, setFilter] = useState('todos');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [droneNotes, setDroneNotes] = useState({});
  const fileRef = useRef();

  const filtered = drones
    .filter(d => filter === 'todos' || d.status === filter)
    .filter(d => !search || d.serial.toLowerCase().includes(search.toLowerCase()));

  const okCount = drones.filter(d => d.status === 'ok').length;
  const badCount = drones.filter(d => d.status === 'bad').length;
  const mautCount = drones.filter(d => d.status === 'manut').length;

  const cycleStatus = (drone) => {
    const order = ['ok', 'manut', 'bad'];
    const next = order[(order.indexOf(drone.status) + 1) % 3];
    updateDroneStatus(drone.id, next);
    if (next === 'ok') setDroneNotes(prev => { const n = {...prev}; delete n[drone.id]; return n; });
  };

  const setDroneNote = (id, field, val) =>
    setDroneNotes(prev => ({ ...prev, [id]: { ...(prev[id] || {}), [field]: val } }));

  const handleDelete = (drone) => {
    if (window.confirm(`Deseja excluir o drone ${drone.serial}?`)) {
      deleteDrone(drone.id);
      setSelected(prev => { const n = new Set(prev); n.delete(drone.id); return n; });
    }
  };

  const handleDeleteSelected = async () => {
    if (selected.size === 0) return;
    if (!window.confirm(`Deseja excluir ${selected.size} drone(s) selecionado(s)?`)) return;
    const ids = Array.from(selected);
    await deleteDrones(ids);
    setSelected(new Set());
  };

  const allFilteredSelected = filtered.length > 0 && filtered.every(d => selected.has(d.id));
  const toggleAll = (checked) => {
    if (checked) setSelected(prev => new Set([...prev, ...filtered.map(d => d.id)]));
    else setSelected(prev => { const n = new Set(prev); filtered.forEach(d => n.delete(d.id)); return n; });
  };
  const toggleOne = (id) => {
    setSelected(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
      const serials = rows
        .map(row => String(row[0] || '').trim())
        .filter(v => v && !/^(serial|número|number|sn|drone)$/i.test(v));
      if (serials.length === 0) {
        alert('Nenhum serial encontrado. Verifique se o arquivo tem os seriais na primeira coluna.');
        e.target.value = '';
        return;
      }
      await importDrones(serials);
      alert(`${serials.length} drone(s) importado(s) com sucesso.`);
    } catch (err) {
      alert('Erro ao ler o arquivo. Certifique-se de que é um .xlsx ou .csv válido.');
    }
    e.target.value = '';
  };

  const saveDrone = () => {
    if (!form.serial?.trim()) return;
    addDrone({ serial: form.serial.trim(), status: form.status || 'ok' });
    setModal(null); setForm({});
  };

  const saveBat = () => {
    updateInventory({ batSean: parseInt(form.batSean) || 0, batMagic: parseInt(form.batMagic) || 0 });
    setModal(null); setForm({});
  };

  const saveSerial = (type) => {
    const val = type === 'computador'
      ? `${form.pcModel || 'HP'} — ${form.serial || ''}`
      : form.serial?.trim();
    if (!val) return;
    addSerialItem(type, val);
    setModal(null); setForm({});
  };

  const saveQty = (key) => {
    const qty = parseInt(form.qty) || 0;
    updateInventory({ quantities: { ...inventory.quantities, [key]: qty } });
    setModal(null); setForm({});
  };

  const qtyItems = [
    { key: 'rede',    label: 'Cabos de Rede' },
    { key: 'energia', label: 'Cabos de Energia' },
    { key: 'radio',   label: 'Kit Rádio' },
    { key: 'star',    label: 'Starlink' },
    { key: 'tripes',  label: 'Tripés' },
  ];

  const serialItems = [
    { key: 'rtk',       label: 'RTK' },
    { key: 'ap',        label: 'AP (Access Point)' },
    { key: 'servidor',  label: 'Servidor' },
    { key: 'computador',label: 'Computador' },
  ];

  const filterBtns = ['todos', 'ok', 'bad', 'manut'];
  const filterLabels = { todos: 'Todos', ok: 'Bom', bad: 'Ruim', manut: 'Manut.' };

  const INP = { background: '#000', border: '1px solid #222', color: '#fff', padding: '7px 10px', fontFamily: 'Space Mono,monospace', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' };

  return (
    <div>
      <PageHeader label="Módulo" title="Inventário" />

      {/* Drones */}
      <Section title="Drones" action={<Btn size="sm" onClick={() => { setForm({ status: 'ok' }); setModal('drone'); }}>+ Add</Btn>}>
        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, marginBottom: 10 }}>
          {[['ok','#4caf50',okCount,'Bons'],['bad','#f44336',badCount,'Ruins'],['manut','#ff9800',mautCount,'Manut.']].map(([k,c,n,l]) => (
            <div key={k} style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', padding: '8px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: c }}>{n}</div>
              <div style={{ fontSize: 8, letterSpacing: 2, color: '#aaa', textTransform: 'uppercase', marginTop: 2 }}>{l}</div>
            </div>
          ))}
        </div>

        {/* Import */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
          <button onClick={() => fileRef.current.click()} style={{
            flex: 1, padding: '7px', fontFamily: 'Space Mono,monospace', fontSize: 11,
            letterSpacing: 2, textTransform: 'uppercase', cursor: 'pointer',
            border: '1px solid #fff', background: 'transparent', color: '#fff',
          }}>↑ Importar Excel / CSV</button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={handleImport} />
        </div>
        <div style={{ fontSize: 11, color: '#888', letterSpacing: 1, marginBottom: 8 }}>Seriais na primeira coluna (A) — sem cabeçalho obrigatório</div>

        {/* Search */}
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por serial..."
          style={{ ...INP, marginBottom: 8 }}
        />

        {/* Filters */}
        <div style={{ display: 'flex', gap: 5, marginBottom: 8 }}>
          {filterBtns.map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              fontSize: 8, letterSpacing: 2, padding: '4px 8px', textTransform: 'uppercase',
              fontFamily: 'Space Mono,monospace', cursor: 'pointer',
              border: `1px solid ${filter === f ? '#fff' : '#333'}`,
              background: filter === f ? '#111' : 'transparent',
              color: filter === f ? '#fff' : '#666',
            }}>{filterLabels[f]}</button>
          ))}
          <span style={{ fontSize: 8, color: '#888', letterSpacing: 1, alignSelf: 'center', marginLeft: 4 }}>
            {filtered.length}/{drones.length}
          </span>
        </div>

        {/* Select all + bulk delete */}
        {filtered.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <input type="checkbox" checked={allFilteredSelected} onChange={e => toggleAll(e.target.checked)}
              style={{ accentColor: '#fff', cursor: 'pointer' }} />
            <span style={{ fontSize: 12, color: '#aaa' }}>Selecionar todos ({filtered.length})</span>
            {selected.size > 0 && (
              <button onClick={handleDeleteSelected} style={{
                marginLeft: 'auto', fontSize: 8, letterSpacing: 2, padding: '4px 10px',
                border: '1px solid #f44336', background: 'transparent', color: '#f44336',
                fontFamily: 'Space Mono,monospace', cursor: 'pointer', textTransform: 'uppercase',
              }}>Excluir {selected.size} selecionado(s)</button>
            )}
          </div>
        )}

        {/* List */}
        <div style={{ maxHeight: 300, overflowY: 'auto' }}>
          {filtered.length === 0 ? <Empty text="Nenhum drone" /> : filtered.map(d => (
            <div key={d.id} style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', padding: '10px 12px', marginBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={selected.has(d.id)} onChange={() => toggleOne(d.id)}
                  style={{ accentColor: '#fff', cursor: 'pointer', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: 1 }}>{d.serial}</div>
                </div>
                <div onClick={() => cycleStatus(d)} style={{ cursor: 'pointer' }}>
                  <StatusPill status={d.status} />
                </div>
                <button onClick={() => handleDelete(d)} style={{
                  background: 'transparent', border: 'none', color: '#aaa', cursor: 'pointer',
                  fontSize: 15, padding: '0 2px', lineHeight: 1,
                }} title={`Excluir ${d.serial}`}>🗑️</button>
              </div>
              {(d.status === 'bad' || d.status === 'manut') && (
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #1a1a1a' }}>
                  <textarea
                    value={droneNotes[d.id]?.obs || ''}
                    onChange={e => setDroneNote(d.id, 'obs', e.target.value)}
                    placeholder="Observação (problema, dano, etc.)..."
                    rows={2}
                    style={{ width: '100%', background: '#000', border: '1px solid #222', color: '#fff', padding: '6px 8px', fontFamily: 'Space Mono,monospace', fontSize: 12, outline: 'none', resize: 'none', boxSizing: 'border-box', marginBottom: 6 }}
                  />
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      style={{ display: 'none' }}
                      onChange={e => { const f = e.target.files[0]; if (f) setDroneNote(d.id, 'photoName', f.name); }}
                    />
                    <span style={{ fontSize: 8, letterSpacing: 2, padding: '4px 10px', border: '1px solid #444', color: '#aaa', textTransform: 'uppercase', fontFamily: 'Space Mono,monospace' }}>
                      Foto
                    </span>
                    {droneNotes[d.id]?.photoName && (
                      <span style={{ fontSize: 11, color: '#4caf50' }}>{droneNotes[d.id].photoName}</span>
                    )}
                  </label>
                </div>
              )}
            </div>
          ))}
        </div>
      </Section>

      {/* Baterias */}
      <Section title="Baterias" action={<Btn size="sm" variant="ghost" onClick={() => { setForm({ batSean: inventory.batSean, batMagic: inventory.batMagic }); setModal('bat'); }}>Editar</Btn>}>
        {[['Sean', inventory.batSean], ['Magic', inventory.batMagic]].map(([name, qty]) => (
          <div key={name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#0a0a0a', border: '1px solid #1a1a1a', padding: '10px 14px', marginBottom: 4 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{name}</div>
              <div style={{ fontSize: 11, letterSpacing: 2, color: '#aaa', textTransform: 'uppercase' }}>Nome interno</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{qty}</div>
              <div style={{ fontSize: 8, color: '#aaa', letterSpacing: 1 }}>unidades</div>
            </div>
          </div>
        ))}
      </Section>

      {/* Serial Items */}
      <Section title="Serial Numbers">
        {serialItems.map(({ key, label }) => (
          <div key={key}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#0a0a0a', border: '1px solid #1a1a1a', padding: '9px 12px', marginBottom: 4 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{label}</div>
                <div style={{ fontSize: 11, color: '#aaa', marginTop: 1, letterSpacing: 1 }}>{inventory[key]?.length || 0} cadastrado(s)</div>
              </div>
              <Btn size="sm" variant="ghost" onClick={() => { setForm({ pcModel: 'HP' }); setModal(key); }}>+ Add</Btn>
            </div>
            {(inventory[key] || []).map(item => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 10px', background: '#050505', border: '1px solid #111', marginBottom: 2, marginLeft: 8 }}>
                <span style={{ fontSize: 13 }}>{item.value}</span>
                <span onClick={() => deleteSerialItem(key, item.id)} style={{ fontSize: 12, color: '#f44336', cursor: 'pointer', padding: '0 4px' }}>✕</span>
              </div>
            ))}
          </div>
        ))}
      </Section>

      {/* Quantities */}
      <Section title="Quantidades">
        {qtyItems.map(({ key, label }) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#0a0a0a', border: '1px solid #1a1a1a', padding: '9px 12px', marginBottom: 4 }}>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{label}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{inventory.quantities[key]}</div>
                <div style={{ fontSize: 8, color: '#aaa', letterSpacing: 1 }}>un</div>
              </div>
              <Btn size="sm" variant="ghost" onClick={() => { setForm({ qty: inventory.quantities[key] }); setModal(`qty-${key}`); }}>Editar</Btn>
            </div>
          </div>
        ))}
      </Section>

      {/* Modals */}
      {modal === 'drone' && (
        <Modal title="Adicionar Drone" onClose={() => setModal(null)}>
          <Input label="Serial Number" value={form.serial || ''} onChange={e => setForm({...form, serial: e.target.value})} placeholder="MD-2024-XXXX" />
          <Select label="Status" value={form.status || 'ok'} onChange={e => setForm({...form, status: e.target.value})}
            options={[{value:'ok',label:'Bom'},{value:'manut',label:'Manutenção'},{value:'bad',label:'Ruim'}]} />
          <ModalBtns onCancel={() => setModal(null)} onSave={saveDrone} />
        </Modal>
      )}

      {modal === 'bat' && (
        <Modal title="Editar Baterias" onClose={() => setModal(null)}>
          <Input label="Sean — Quantidade" type="number" value={form.batSean ?? ''} onChange={e => setForm({...form, batSean: e.target.value})} />
          <Input label="Magic — Quantidade" type="number" value={form.batMagic ?? ''} onChange={e => setForm({...form, batMagic: e.target.value})} />
          <ModalBtns onCancel={() => setModal(null)} onSave={saveBat} />
        </Modal>
      )}

      {['rtk','ap','servidor'].includes(modal) && (
        <Modal title={`Adicionar ${serialItems.find(i=>i.key===modal)?.label}`} onClose={() => setModal(null)}>
          <Input label="Serial Number" value={form.serial || ''} onChange={e => setForm({...form, serial: e.target.value})} placeholder="SN-2024-XXXX" />
          <ModalBtns onCancel={() => setModal(null)} onSave={() => saveSerial(modal)} />
        </Modal>
      )}

      {modal === 'computador' && (
        <Modal title="Adicionar Computador" onClose={() => setModal(null)}>
          <Select label="Modelo" value={form.pcModel || 'HP'} onChange={e => setForm({...form, pcModel: e.target.value})} options={['HP','Dell']} />
          <Input label="Serial Number" value={form.serial || ''} onChange={e => setForm({...form, serial: e.target.value})} placeholder="PC-2024-XXXX" />
          <ModalBtns onCancel={() => setModal(null)} onSave={() => saveSerial('computador')} />
        </Modal>
      )}

      {modal?.startsWith('qty-') && (
        <Modal title={`Editar ${qtyItems.find(i=>`qty-${i.key}`===modal)?.label}`} onClose={() => setModal(null)}>
          <Input label="Quantidade" type="number" value={form.qty ?? ''} onChange={e => setForm({...form, qty: e.target.value})} />
          <ModalBtns onCancel={() => setModal(null)} onSave={() => saveQty(modal.replace('qty-',''))} />
        </Modal>
      )}
    </div>
  );
}
