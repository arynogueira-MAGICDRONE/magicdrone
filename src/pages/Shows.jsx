import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { PageHeader, Btn, Input, Select, StatusPill, Modal, ModalBtns, Empty, Section } from '../components/layout/UI';

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const DAYS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

function pad(n) { return n < 10 ? '0' + n : n; }
function fmtDate(str) { if (!str) return '—'; const [y,m,d] = str.split('-'); return `${d}/${m}/${y}`; }

export default function Shows() {
  const { isMaster } = useAuth();
  const { shows, addShow, dronesUsedOnDate } = useApp();
  const TOTAL_DRONES = 125;

  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [conflict, setConflict] = useState(null);

  const [form, setForm] = useState({ date: '', status: 'neg', client: '', drones: '', city: '', state: '', test: '' });

  const visible = isMaster() ? shows : shows.filter(s => s.status !== 'neg');

  const changeMonth = (dir) => {
    let m = calMonth + dir, y = calYear;
    if (m > 11) { m = 0; y++; }
    if (m < 0) { m = 11; y--; }
    setCalMonth(m); setCalYear(y);
  };

  const renderCal = () => {
    const first = new Date(calYear, calMonth, 1).getDay();
    const total = new Date(calYear, calMonth + 1, 0).getDate();
    const prevTotal = new Date(calYear, calMonth, 0).getDate();
    const cells = [];

    for (let i = 0; i < first; i++)
      cells.push({ day: prevTotal - first + 1 + i, cur: false, date: null });

    for (let d = 1; d <= total; d++) {
      const date = `${calYear}-${pad(calMonth + 1)}-${pad(d)}`;
      const show = visible.find(s => s.date === date);
      cells.push({ day: d, cur: true, date, show,
        isToday: today.getFullYear() === calYear && today.getMonth() === calMonth && today.getDate() === d });
    }

    const rem = 7 - (cells.length % 7);
    if (rem < 7) for (let e = 1; e <= rem; e++) cells.push({ day: e, cur: false, date: null });

    return cells;
  };

  const checkConflict = (date) => {
    if (!date) { setConflict(null); return; }
    const used = dronesUsedOnDate(date);
    if (used > 0) setConflict({ used, available: TOTAL_DRONES - used });
    else setConflict(null);
  };

  const handleSave = () => {
    if (!form.date || !form.client || !form.drones || !form.city || !form.state) return;
    addShow({ ...form, drones: parseInt(form.drones) });
    setShowModal(false);
    setForm({ date: '', status: 'neg', client: '', drones: '', city: '', state: '', test: '' });
    setConflict(null);
  };

  const statusColor = { conf: '#4caf50', neg: '#ff9800', exec: '#555' };
  const listShows = selectedDate ? visible.filter(s => s.date === selectedDate) : [...visible].sort((a,b) => a.date.localeCompare(b.date));

  return (
    <div>
      <PageHeader
        label="Módulo"
        title="Agenda de Shows"
        action={isMaster() && <Btn onClick={() => setShowModal(true)}>+ Novo</Btn>}
      />

      {isMaster() && (
        <div style={{ margin: '10px 16px 0', background: '#1a0f00', border: '1px solid #ff9800', padding: '7px 12px', fontSize: 9, color: '#ff9800', letterSpacing: 2, textTransform: 'uppercase' }}>
          Shows em negociação visíveis apenas para Master
        </div>
      )}

      {/* Calendar */}
      <div style={{ padding: '14px 16px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <button onClick={() => changeMonth(-1)} style={{ background: 'transparent', border: '1px solid #333', color: '#fff', padding: '4px 10px', cursor: 'pointer', fontFamily: 'Space Mono, monospace' }}>←</button>
          <span style={{ fontSize: 11, letterSpacing: 4, textTransform: 'uppercase', fontWeight: 700 }}>{MONTHS[calMonth]} {calYear}</span>
          <button onClick={() => changeMonth(1)} style={{ background: 'transparent', border: '1px solid #333', color: '#fff', padding: '4px 10px', cursor: 'pointer', fontFamily: 'Space Mono, monospace' }}>→</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 2 }}>
          {DAYS.map(d => <div key={d} style={{ fontSize: 8, letterSpacing: 1, color: '#555', textAlign: 'center', padding: '4px 0', textTransform: 'uppercase' }}>{d}</div>)}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
          {renderCal().map((cell, i) => (
            <div key={i} onClick={() => cell.date && setSelectedDate(selectedDate === cell.date ? null : cell.date)}
              style={{
                aspectRatio: '1', display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', fontSize: 11, cursor: cell.date ? 'pointer' : 'default',
                border: `1px solid ${selectedDate === cell.date ? '#fff' : cell.isToday ? '#555' : cell.show ? '#222' : 'transparent'}`,
                background: cell.show ? '#0a0a0a' : 'transparent',
                color: cell.cur ? '#fff' : '#333',
              }}>
              {cell.day}
              {cell.show && (
                <div style={{ width: 4, height: 4, borderRadius: '50%', marginTop: 2, background: statusColor[cell.show.status] || '#888' }} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* List */}
      <Section title={selectedDate ? `Shows em ${fmtDate(selectedDate)}` : 'Todos os Shows'}
        action={selectedDate && <Btn size="sm" variant="ghost" onClick={() => setSelectedDate(null)}>Ver todos</Btn>}>
        {listShows.length === 0 ? <Empty text="Nenhum show" /> : listShows.map(s => (
          <div key={s.id} style={{
            background: '#0a0a0a', border: '1px solid #1a1a1a',
            borderLeft: `3px solid ${statusColor[s.status]}`,
            padding: '12px 14px', marginBottom: 6,
          }}>
            <div style={{ fontSize: 9, letterSpacing: 2, color: '#666', marginBottom: 3 }}>
              {fmtDate(s.date)} · Ensaio: {fmtDate(s.test)}
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>{s.client}</div>
            <div style={{ fontSize: 10, color: '#888' }}>{s.city}, {s.state}</div>
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <StatusPill status={s.status} />
              <span style={{ fontSize: 8, letterSpacing: 2, padding: '2px 8px', border: '1px solid #444', color: '#aaa', textTransform: 'uppercase' }}>{s.drones} drones</span>
            </div>
          </div>
        ))}
      </Section>

      {showModal && (
        <Modal title="Novo Show" onClose={() => { setShowModal(false); setConflict(null); }}>
          {conflict && (
            <div style={{ background: '#1a0f00', border: '1px solid #ff9800', padding: '10px 12px', marginBottom: 12 }}>
              <div style={{ fontSize: 9, letterSpacing: 2, color: '#ff9800', textTransform: 'uppercase', marginBottom: 4 }}>Conflito de Data</div>
              <div style={{ fontSize: 11, color: '#ffb74d' }}>
                Já há {conflict.used} drones agendados. Disponíveis: {conflict.available} de {TOTAL_DRONES}.
              </div>
            </div>
          )}
          <Input label="Data do Show" type="date" value={form.date} onChange={e => { setForm({...form, date: e.target.value}); checkConflict(e.target.value); }} />
          <Select label="Status" value={form.status} onChange={e => setForm({...form, status: e.target.value})}
            options={[{value:'neg',label:'Negociando'},{value:'conf',label:'Confirmado'},{value:'exec',label:'Executado'}]} />
          <Input label="Cliente" value={form.client} onChange={e => setForm({...form, client: e.target.value})} placeholder="Nome do cliente" />
          <Input label="Quantidade de Drones" type="number" value={form.drones} onChange={e => setForm({...form, drones: e.target.value})} placeholder="200" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Input label="Cidade" value={form.city} onChange={e => setForm({...form, city: e.target.value})} placeholder="São Paulo" />
            <Input label="Estado" value={form.state} onChange={e => setForm({...form, state: e.target.value.toUpperCase()})} placeholder="SP" maxLength={2} />
          </div>
          <Input label="Data Teste (Ensaio)" type="date" value={form.test} onChange={e => setForm({...form, test: e.target.value})} />
          <ModalBtns onCancel={() => { setShowModal(false); setConflict(null); }} onSave={handleSave} />
        </Modal>
      )}
    </div>
  );
}
