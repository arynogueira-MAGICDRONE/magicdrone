import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { PageHeader, Btn, Input, Select, StatusPill, Modal, ModalBtns, Empty, Section } from '../components/layout/UI';

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const DAYS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const STATUS_OPTS = [
  { value: 'neg',       label: 'Negociando' },
  { value: 'conf',      label: 'Confirmado' },
  { value: 'exec',      label: 'Executado' },
  { value: 'cancelado', label: 'Cancelado' },
];
const STATUS_COLOR = { conf: '#4caf50', neg: '#ff9800', exec: '#555', cancelado: '#f44336' };

function pad(n) { return n < 10 ? '0' + n : n; }
function fmtDate(str) { if (!str) return '—'; const [y,m,d] = str.split('-'); return `${d}/${m}/${y}`; }

const EMPTY_FORM = { date: '', status: 'neg', client: '', drones: '', city: '', state: '', test: '' };

export default function Shows() {
  const { isMaster } = useAuth();
  const { shows, addShow, updateShow, dronesUsedOnDate, members, scaleToShow } = useApp();
  const TOTAL_DRONES = 125;

  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [conflict, setConflict] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [selectedMembers, setSelectedMembers] = useState(new Set());
  const [memberRoles, setMemberRoles] = useState({});

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
    const used = dronesUsedOnDate(date, editingId);
    if (used > 0) setConflict({ used, available: TOTAL_DRONES - used });
    else setConflict(null);
  };

  const openNew = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setSelectedMembers(new Set());
    setMemberRoles({});
    setConflict(null);
    setShowModal(true);
  };

  const openEdit = (show) => {
    setEditingId(show.id);
    setForm({ date: show.date, status: show.status, client: show.client, drones: show.drones, city: show.city, state: show.state, test: show.test || '' });
    setSelectedMembers(new Set());
    setMemberRoles({});
    setConflict(null);
    setDetail(null);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
    setConflict(null);
    setSelectedMembers(new Set());
    setMemberRoles({});
  };

  const toggleMember = (id) => {
    setSelectedMembers(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    if (!form.date || !form.client || !form.drones || !form.city || !form.state) return;
    const showData = { ...form, drones: parseInt(form.drones) };

    if (editingId) {
      await updateShow(editingId, showData);
      for (const memberId of selectedMembers)
        await scaleToShow(editingId, memberId, memberRoles[memberId] || '');
    } else {
      const created = await addShow(showData);
      if (created?.id)
        for (const memberId of selectedMembers)
          await scaleToShow(created.id, memberId, memberRoles[memberId] || '');
    }

    closeModal();
  };

  const listShows = selectedDate
    ? visible.filter(s => s.date === selectedDate)
    : [...visible].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div>
      <PageHeader
        label="Módulo"
        title="Agenda de Shows"
        action={isMaster() && <Btn onClick={openNew}>+ Novo</Btn>}
      />

      {isMaster() && (
        <div style={{ margin: '10px 16px 0', background: '#1a0f00', border: '1px solid #ff9800', padding: '7px 12px', fontSize: 9, color: '#ff9800', letterSpacing: 2, textTransform: 'uppercase' }}>
          Shows em negociação visíveis apenas para Master
        </div>
      )}

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
                <div style={{ width: 4, height: 4, borderRadius: '50%', marginTop: 2, background: STATUS_COLOR[cell.show.status] || '#888' }} />
              )}
            </div>
          ))}
        </div>
      </div>

      <Section
        title={selectedDate ? `Shows em ${fmtDate(selectedDate)}` : 'Todos os Shows'}
        action={selectedDate && <Btn size="sm" variant="ghost" onClick={() => setSelectedDate(null)}>Ver todos</Btn>}>
        {listShows.length === 0 ? <Empty text="Nenhum show" /> : listShows.map(s => (
          <div key={s.id} onClick={() => setDetail(s)} style={{
            background: '#0a0a0a', border: '1px solid #1a1a1a',
            borderLeft: `3px solid ${STATUS_COLOR[s.status] || '#888'}`,
            padding: '12px 14px', marginBottom: 6, cursor: 'pointer',
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

      {detail && (
        <Modal title="Detalhes do Show" onClose={() => setDetail(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginBottom: 14 }}>
            {[
              ['Cliente', detail.client],
              ['Data', fmtDate(detail.date)],
              ['Ensaio', fmtDate(detail.test)],
              ['Local', `${detail.city}, ${detail.state}`],
              ['Drones', detail.drones],
            ].map(([l, v]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, borderBottom: '1px solid #1a1a1a', padding: '8px 0' }}>
                <span style={{ color: '#666' }}>{l}</span>
                <span>{v || '—'}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, padding: '8px 0' }}>
              <span style={{ color: '#666' }}>Status</span>
              <StatusPill status={detail.status} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn full variant="ghost" onClick={() => setDetail(null)}>Fechar</Btn>
            {isMaster() && <Btn full variant="outline" onClick={() => openEdit(detail)}>Editar</Btn>}
          </div>
        </Modal>
      )}

      {showModal && (
        <Modal title={editingId ? 'Editar Show' : 'Novo Show'} onClose={closeModal}>
          {conflict && (
            <div style={{ background: '#1a0f00', border: '1px solid #ff9800', padding: '10px 12px', marginBottom: 12 }}>
              <div style={{ fontSize: 9, letterSpacing: 2, color: '#ff9800', textTransform: 'uppercase', marginBottom: 4 }}>Conflito de Data</div>
              <div style={{ fontSize: 11, color: '#ffb74d' }}>
                Já há {conflict.used} drones agendados. Disponíveis: {conflict.available} de {TOTAL_DRONES}.
              </div>
            </div>
          )}
          <Input label="Data do Show" type="date" value={form.date} onChange={e => { setForm({ ...form, date: e.target.value }); checkConflict(e.target.value); }} />
          <Select label="Status" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} options={STATUS_OPTS} />
          <Input label="Cliente" value={form.client} onChange={e => setForm({ ...form, client: e.target.value })} placeholder="Nome do cliente" />
          <Input label="Quantidade de Drones" type="number" value={form.drones} onChange={e => setForm({ ...form, drones: e.target.value })} placeholder="200" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Input label="Cidade" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} placeholder="São Paulo" />
            <Input label="Estado" value={form.state} onChange={e => setForm({ ...form, state: e.target.value.toUpperCase() })} placeholder="SP" maxLength={2} />
          </div>
          <Input label="Data Teste (Ensaio)" type="date" value={form.test} onChange={e => setForm({ ...form, test: e.target.value })} />

          {members.length > 0 && (
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #222' }}>
              <div style={{ fontSize: 9, letterSpacing: 3, color: '#666', textTransform: 'uppercase', marginBottom: 8 }}>Escalar Equipe</div>
              {members.map(m => (
                <div key={m.id} style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: selectedMembers.has(m.id) ? 4 : 0 }}>
                    <input type="checkbox" checked={selectedMembers.has(m.id)} onChange={() => toggleMember(m.id)}
                      style={{ accentColor: '#fff', cursor: 'pointer', flexShrink: 0 }} />
                    <span style={{ fontSize: 12 }}>{m.name}</span>
                  </div>
                  {selectedMembers.has(m.id) && (
                    <input
                      value={memberRoles[m.id] || ''}
                      onChange={e => setMemberRoles(prev => ({ ...prev, [m.id]: e.target.value }))}
                      placeholder="Função (ex: Piloto)"
                      style={{ background: '#000', border: '1px solid #333', color: '#fff', padding: '6px 10px', fontFamily: 'Space Mono, monospace', fontSize: 11, outline: 'none', width: 'calc(100% - 24px)', marginLeft: 24 }}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          <ModalBtns onCancel={closeModal} onSave={handleSave} saveLabel={editingId ? 'Salvar' : 'Cadastrar'} />
        </Modal>
      )}
    </div>
  );
}
