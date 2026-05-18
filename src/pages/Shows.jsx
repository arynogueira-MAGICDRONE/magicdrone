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
function fmtTestDates(str) {
  if (!str) return '—';
  return str.split(',').map(d => fmtDate(d.trim())).filter(Boolean).join(', ');
}

const EMPTY_FORM = {
  client: '', date: '', drones: '', status: 'neg',
  testDates: [''],
  valor: '',
  cep: '', rua: '', numero: '', complemento: '', bairro: '', city: '', state: '',
};
const INP = { background: '#000', border: '1px solid #222', color: '#fff', padding: '9px 10px', fontFamily: 'Space Mono,monospace', fontSize: 16, outline: 'none', boxSizing: 'border-box' };
const LBL = { fontSize: 14, letterSpacing: 2, color: '#aaa', textTransform: 'uppercase', display: 'block', marginBottom: 4 };
const HDIV = { marginTop: 14, paddingTop: 12, borderTop: '1px solid #1a1a1a' };
const SECTTITLE = { fontSize: 14, letterSpacing: 2, color: '#bbb', textTransform: 'uppercase', marginBottom: 10 };

export default function Shows() {
  const { isMaster } = useAuth();
  const { shows, addShow, updateShow, deleteShow, dronesUsedOnDate, members, scaleToShow, scaling, loadScaling, clearScalingForShow } = useApp();
  const TOTAL_DRONES = 125;

  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [shareText, setShareText] = useState(null);
  const [copied, setCopied] = useState(false);
  const [conflict, setConflict] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [cepLoading, setCepLoading] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState(new Set());
  const [memberRoles, setMemberRoles] = useState({});

  const visible = isMaster() ? shows : shows.filter(s => s.status === 'conf');

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

  const buscarCep = async () => {
    const cep = form.cep.replace(/\D/g, '');
    if (cep.length !== 8) { alert('CEP inválido. Informe 8 dígitos.'); return; }
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await res.json();
      if (data.erro) { alert('CEP não encontrado.'); }
      else setForm(f => ({ ...f, rua: data.logradouro || '', bairro: data.bairro || '', city: data.localidade || '', state: data.uf || '' }));
    } catch { alert('Erro ao buscar CEP. Verifique sua conexão.'); }
    setCepLoading(false);
  };

  const openNew = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setSelectedMembers(new Set());
    setMemberRoles({});
    setConflict(null);
    setShowModal(true);
  };

  const openEdit = async (show) => {
    const testDates = show.test ? show.test.split(',').map(d => d.trim()).filter(Boolean) : [''];
    setEditingId(show.id);
    setForm({
      client: show.client, date: show.date, drones: show.drones, status: show.status,
      testDates: testDates.length ? testDates : [''],
      valor: show.valor || '',
      cep: '', rua: '', numero: '', complemento: '', bairro: '',
      city: show.city || '', state: show.state || '',
    });
    setConflict(null);
    setDetail(null);

    const scalingItems = await loadScaling(show.id);
    if (scalingItems.length > 0) {
      setSelectedMembers(new Set(scalingItems.map(s => s.membro_id)));
      const roles = {};
      scalingItems.forEach(s => { roles[s.membro_id] = s.funcao || ''; });
      setMemberRoles(roles);
    } else {
      setSelectedMembers(new Set());
      setMemberRoles({});
    }

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
    if (!form.client || !form.date || !form.drones) return;
    const testStr = form.testDates.filter(Boolean).join(',');
    const showData = {
      client:      form.client,
      date:        form.date,
      drones:      parseInt(form.drones),
      status:      form.status,
      city:        form.city        || '',
      state:       form.state       || '',
      test:        testStr,
      valor:       parseFloat(form.valor) || null,
      cep:         form.cep         || '',
      rua:         form.rua         || '',
      numero:      form.numero      || '',
      complemento: form.complemento || '',
      bairro:      form.bairro      || '',
    };
    if (editingId) {
      await updateShow(editingId, showData);
      await clearScalingForShow(editingId);
      for (const memberId of selectedMembers)
        await scaleToShow(editingId, memberId, memberRoles[memberId] || '');
      closeModal();
    } else {
      const created = await addShow(showData);
      if (created?.id) {
        for (const memberId of selectedMembers)
          await scaleToShow(created.id, memberId, memberRoles[memberId] || '');
        closeModal();
      } else {
        alert('Erro ao salvar o show. Verifique os dados e tente novamente.');
      }
    }
  };

  const handleDeleteShow = async (show) => {
    if (!window.confirm(`Deseja excluir o show ${show.client}? Esta ação não pode ser desfeita.`)) return;
    await deleteShow(show.id);
    setDetail(null);
  };

  const openDetail = async (s) => {
    setDetail(s);
    if (!scaling[s.id]) await loadScaling(s.id);
  };

  const generateShareText = (show) => {
    const scaled = scaling[show.id] || [];
    let text = `MAGICDRONE — Equipe Escalada\nShow: ${show.client}\nData: ${fmtDate(show.date)}\n─────────────────────\n`;
    scaled.forEach((sc, i) => {
      const m = members.find(m => m.id === sc.memberId);
      if (!m) return;
      text += `${i + 1}. ${m.name}${sc.role ? ` — ${sc.role}` : ''}\n`;
      if (m.tel) text += `   Tel: ${m.tel}\n`;
      if (m.cpf) text += `   CPF: ${m.cpf}\n`;
      if (m.rg)  text += `   RG: ${m.rg}\n`;
    });
    setShareText(text.trim());
    setCopied(false);
  };

  const copyText = () => {
    navigator.clipboard.writeText(shareText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const setTestDate = (i, val) => {
    const next = [...form.testDates];
    next[i] = val;
    setForm({ ...form, testDates: next });
  };

  const listShows = selectedDate
    ? visible.filter(s => s.date === selectedDate)
    : [...visible].sort((a, b) => a.date.localeCompare(b.date));

  const ADDBTN = { fontSize: 14, letterSpacing: 2, padding: '6px 10px', border: '1px solid #444', background: 'transparent', color: '#aaa', fontFamily: 'Space Mono,monospace', cursor: 'pointer', textTransform: 'uppercase' };

  return (
    <div>
      <PageHeader
        label="Módulo"
        title="Agenda de Shows"
        action={isMaster() && <Btn onClick={openNew}>+ Novo</Btn>}
      />

      {/* Calendário */}
      <div style={{ padding: '14px 16px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <button onClick={() => changeMonth(-1)} style={{ background: 'transparent', border: '1px solid #333', color: '#fff', padding: '4px 10px', cursor: 'pointer', fontFamily: 'Space Mono, monospace' }}>←</button>
          <span style={{ fontSize: 14, letterSpacing: 4, textTransform: 'uppercase', fontWeight: 700 }}>{MONTHS[calMonth]} {calYear}</span>
          <button onClick={() => changeMonth(1)} style={{ background: 'transparent', border: '1px solid #333', color: '#fff', padding: '4px 10px', cursor: 'pointer', fontFamily: 'Space Mono, monospace' }}>→</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 2 }}>
          {DAYS.map(d => <div key={d} style={{ fontSize: 14, letterSpacing: 1, color: '#bbb', textAlign: 'center', padding: '4px 0', textTransform: 'uppercase' }}>{d}</div>)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
          {renderCal().map((cell, i) => (
            <div key={i} onClick={() => cell.date && setSelectedDate(selectedDate === cell.date ? null : cell.date)}
              style={{
                aspectRatio: '1', display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', fontSize: 14, cursor: cell.date ? 'pointer' : 'default',
                border: `1px solid ${selectedDate === cell.date ? '#fff' : cell.isToday ? '#555' : cell.show ? '#222' : 'transparent'}`,
                background: cell.show ? '#0a0a0a' : 'transparent',
                color: cell.cur ? '#fff' : '#333',
              }}>
              {cell.day}
              {cell.show && <div style={{ width: 4, height: 4, borderRadius: '50%', marginTop: 2, background: STATUS_COLOR[cell.show.status] || '#888' }} />}
            </div>
          ))}
        </div>
      </div>

      {/* Lista */}
      <Section
        title={selectedDate ? `Shows em ${fmtDate(selectedDate)}` : 'Todos os Shows'}
        action={selectedDate && <Btn size="sm" variant="ghost" onClick={() => setSelectedDate(null)}>Ver todos</Btn>}>
        {listShows.length === 0 ? <Empty text="Nenhum show" /> : listShows.map(s => (
          <div key={s.id} onClick={() => openDetail(s)} style={{
            background: '#0a0a0a', border: '1px solid #1a1a1a',
            borderLeft: `3px solid ${STATUS_COLOR[s.status] || '#888'}`,
            padding: '12px 14px', marginBottom: 6, cursor: 'pointer',
          }}>
            <div style={{ fontSize: 14, letterSpacing: 1, color: '#bbb', marginBottom: 3 }}>
              {fmtDate(s.date)} {s.test ? `· Teste: ${fmtTestDates(s.test)}` : ''}
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 2 }}>{s.client}</div>
            {(s.city || s.state) && <div style={{ fontSize: 14, color: '#aaa' }}>{[s.city, s.state].filter(Boolean).join(', ')}</div>}
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <StatusPill status={s.status} />
              <span style={{ fontSize: 14, letterSpacing: 2, padding: '2px 8px', border: '1px solid #444', color: '#aaa', textTransform: 'uppercase' }}>{s.drones} drones</span>
            </div>
          </div>
        ))}
      </Section>

      {/* Modal Detalhes */}
      {detail && (
        <Modal title="Detalhes do Show" onClose={() => setDetail(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 14 }}>
            {[
              ['Cliente', detail.client],
              ['Data', fmtDate(detail.date)],
              ['Teste(s)', fmtTestDates(detail.test)],
              ['Local', [detail.city, detail.state].filter(Boolean).join(', ') || '—'],
              ['Drones', detail.drones],
            ].map(([l, v]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, borderBottom: '1px solid #1a1a1a', padding: '8px 0' }}>
                <span style={{ color: '#aaa' }}>{l}</span>
                <span>{v || '—'}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 14, padding: '8px 0' }}>
              <span style={{ color: '#aaa' }}>Status</span>
              <StatusPill status={detail.status} />
            </div>
          </div>
          {(scaling[detail.id]?.length > 0) && (
            <button onClick={() => generateShareText(detail)} style={{
              width: '100%', marginBottom: 8, background: 'transparent', border: '1px solid #333',
              color: '#888', fontFamily: 'Space Mono, monospace', fontSize: 14, letterSpacing: 2,
              textTransform: 'uppercase', padding: '10px 0', cursor: 'pointer',
            }}>Gerar Texto para Compartilhar</button>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn full variant="ghost" onClick={() => setDetail(null)}>Fechar</Btn>
            {isMaster() && <Btn full variant="outline" onClick={() => openEdit(detail)}>Editar</Btn>}
          </div>
          {isMaster() && (
            <div style={{ marginTop: 8 }}>
              <Btn full variant="danger" onClick={() => handleDeleteShow(detail)}>Excluir Show</Btn>
            </div>
          )}
        </Modal>
      )}

      {/* Modal Compartilhar */}
      {shareText !== null && (
        <Modal title="Texto para Compartilhar" onClose={() => setShareText(null)}>
          <div style={{ background: '#000', border: '1px solid #222', padding: 12, fontSize: 14, lineHeight: 1.9, whiteSpace: 'pre-wrap', color: '#ccc', maxHeight: 320, overflowY: 'auto', marginBottom: 12 }}>
            {shareText}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn full variant="ghost" onClick={() => setShareText(null)}>Fechar</Btn>
            <Btn full variant={copied ? 'success' : 'outline'} onClick={copyText}>{copied ? 'Copiado!' : 'Copiar Texto'}</Btn>
          </div>
        </Modal>
      )}

      {/* Modal Novo/Editar */}
      {showModal && (
        <Modal title={editingId ? 'Editar Show' : 'Novo Show'} onClose={closeModal}>
          {conflict && (
            <div style={{ background: '#1a0f00', border: '1px solid #ff9800', padding: '10px 12px', marginBottom: 12 }}>
              <div style={{ fontSize: 14, letterSpacing: 2, color: '#ff9800', textTransform: 'uppercase', marginBottom: 4 }}>Conflito de Data</div>
              <div style={{ fontSize: 14, color: '#ffb74d' }}>Já há {conflict.used} drones agendados. Disponíveis: {conflict.available} de {TOTAL_DRONES}.</div>
            </div>
          )}

          {/* ── GRUPO 1: Obrigatórios ── */}
          <div style={SECTTITLE}>Obrigatórios</div>

          <Input label="Nome do Cliente" value={form.client} onChange={e => setForm({ ...form, client: e.target.value })} placeholder="Nome do cliente" />
          <Input label="Data do Show" type="date" value={form.date} onChange={e => { setForm({ ...form, date: e.target.value }); checkConflict(e.target.value); }} />

          {/* Datas de Teste */}
          <div style={{ marginBottom: 10 }}>
            <label style={LBL}>Data(s) de Teste</label>
            {form.testDates.map((d, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                <input type="date" value={d} onChange={e => setTestDate(i, e.target.value)}
                  style={{ ...INP, flex: 1 }}
                  onFocus={e => e.target.style.borderColor='#fff'} onBlur={e => e.target.style.borderColor='#222'} />
                {form.testDates.length > 1 && (
                  <button onClick={() => setForm({ ...form, testDates: form.testDates.filter((_, j) => j !== i) })}
                    style={{ background: 'transparent', border: '1px solid #333', color: '#f44336', padding: '0 10px', cursor: 'pointer', fontSize: 14 }}>✕</button>
                )}
              </div>
            ))}
            <button onClick={() => setForm({ ...form, testDates: [...form.testDates, ''] })} style={ADDBTN}>+ Data</button>
          </div>

          <Input label="Quantidade de Drones" type="number" value={form.drones} onChange={e => setForm({ ...form, drones: e.target.value })} placeholder="200" />
          <Select label="Status" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} options={STATUS_OPTS} />

          {/* ── GRUPO 2: Opcionais ── */}
          <div style={HDIV}>
            <div style={SECTTITLE}>Opcional</div>

            <Input label="Valor do Show (R$)" type="number" value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value })} placeholder="0,00" />

            {/* CEP */}
            <div style={{ marginBottom: 10 }}>
              <label style={LBL}>CEP</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input value={form.cep} onChange={e => setForm({ ...form, cep: e.target.value })} placeholder="00000-000"
                  style={{ ...INP, flex: 1 }}
                  onFocus={e => e.target.style.borderColor='#fff'} onBlur={e => e.target.style.borderColor='#222'} />
                <button onClick={buscarCep} disabled={cepLoading}
                  style={{ padding: '10px 14px', border: '1px solid #555', background: 'transparent', color: '#aaa', fontFamily: 'Space Mono,monospace', fontSize: 14, letterSpacing: 2, cursor: cepLoading ? 'wait' : 'pointer', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                  {cepLoading ? '...' : 'Buscar'}
                </button>
              </div>
            </div>

            <div style={{ marginBottom: 10 }}>
              <label style={LBL}>Rua / Logradouro</label>
              <input value={form.rua} onChange={e => setForm({ ...form, rua: e.target.value })} placeholder="Rua, Av..."
                style={{ ...INP, width: '100%' }}
                onFocus={e => e.target.style.borderColor='#fff'} onBlur={e => e.target.style.borderColor='#222'} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
              <div>
                <label style={LBL}>Número</label>
                <input value={form.numero} onChange={e => setForm({ ...form, numero: e.target.value })} placeholder="123"
                  style={{ ...INP, width: '100%' }}
                  onFocus={e => e.target.style.borderColor='#fff'} onBlur={e => e.target.style.borderColor='#222'} />
              </div>
              <div>
                <label style={LBL}>Complemento</label>
                <input value={form.complemento} onChange={e => setForm({ ...form, complemento: e.target.value })} placeholder="Apto, Sala..."
                  style={{ ...INP, width: '100%' }}
                  onFocus={e => e.target.style.borderColor='#fff'} onBlur={e => e.target.style.borderColor='#222'} />
              </div>
            </div>

            <div style={{ marginBottom: 10 }}>
              <label style={LBL}>Bairro</label>
              <input value={form.bairro} onChange={e => setForm({ ...form, bairro: e.target.value })} placeholder="Bairro"
                style={{ ...INP, width: '100%' }}
                onFocus={e => e.target.style.borderColor='#fff'} onBlur={e => e.target.style.borderColor='#222'} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 72px', gap: 8 }}>
              <Input label="Cidade" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} placeholder="São Paulo" />
              <Input label="UF" value={form.state} onChange={e => setForm({ ...form, state: e.target.value.toUpperCase() })} placeholder="SP" maxLength={2} />
            </div>
          </div>

          {/* Escalar Equipe */}
          {members.length > 0 && (
            <div style={HDIV}>
              <div style={SECTTITLE}>Escalar Equipe</div>
              {members.map(m => (
                <div key={m.id} style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: selectedMembers.has(m.id) ? 4 : 0 }}>
                    <input type="checkbox" checked={selectedMembers.has(m.id)} onChange={() => toggleMember(m.id)}
                      style={{ accentColor: '#fff', cursor: 'pointer', flexShrink: 0 }} />
                    <span style={{ fontSize: 16 }}>{m.name}</span>
                  </div>
                  {selectedMembers.has(m.id) && (
                    <input value={memberRoles[m.id] || ''} onChange={e => setMemberRoles(prev => ({ ...prev, [m.id]: e.target.value }))}
                      placeholder="Função (ex: Piloto)"
                      style={{ ...INP, width: 'calc(100% - 24px)', marginLeft: 24 }}
                      onFocus={e => e.target.style.borderColor='#fff'} onBlur={e => e.target.style.borderColor='#222'} />
                  )}
                </div>
              ))}
            </div>
          )}

          <div style={{ marginTop: 14 }}>
            <ModalBtns onCancel={closeModal} onSave={handleSave} saveLabel={editingId ? 'Salvar' : 'Cadastrar'} />
          </div>
        </Modal>
      )}
    </div>
  );
}
