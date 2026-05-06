import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { PageHeader, Btn, Input, Select, Modal, ModalBtns, Empty } from '../components/layout/UI';

const STATUS_OPTS = [
  { value: 'orcamento',  label: 'Orçamento' },
  { value: 'negociando', label: 'Negociando' },
  { value: 'confirmado', label: 'Confirmado' },
];

const STATUS_COLOR = {
  orcamento:  '#ff9800',
  negociando: '#ffeb3b',
  confirmado: '#4caf50',
};

const STATUS_LABEL = {
  orcamento:  'Orçamento',
  negociando: 'Negociando',
  confirmado: 'Confirmado',
};

const emptyForm = () => ({
  empresa: '', telefone: '', contato: '', evento: '',
  data_evento: '', local: '', drones: '', valor: '', status: 'orcamento',
});

export default function CRM() {
  const { isMaster } = useAuth();
  const { addShow } = useApp();
  const navigate = useNavigate();

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | 'add' | 'detail'
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [detail, setDetail] = useState(null);
  const [converting, setConverting] = useState(false);

  useEffect(() => { loadEntries(); }, []);

  if (!isMaster()) return null;

  const loadEntries = async () => {
    setLoading(true);
    const { data } = await supabase.from('crm').select('*').order('created_at', { ascending: false });
    if (data) setEntries(data);
    setLoading(false);
  };

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm());
    setModal('add');
  };

  const openEdit = (entry) => {
    setEditingId(entry.id);
    setForm({
      empresa:     entry.empresa     || '',
      telefone:    entry.telefone    || '',
      contato:     entry.contato     || '',
      evento:      entry.evento      || '',
      data_evento: entry.data_evento || '',
      local:       entry.local       || '',
      drones:      entry.drones != null ? String(entry.drones) : '',
      valor:       entry.valor  != null ? String(entry.valor)  : '',
      status:      entry.status || 'orcamento',
    });
    setDetail(null);
    setModal('add');
  };

  const save = async () => {
    if (!form.empresa.trim())     { alert('Informe o nome da empresa.'); return; }
    if (!form.evento.trim())      { alert('Informe o nome do evento.'); return; }
    if (!form.data_evento)        { alert('Informe a data do evento.'); return; }

    const row = {
      empresa:     form.empresa.trim(),
      telefone:    form.telefone.trim(),
      contato:     form.contato.trim(),
      evento:      form.evento.trim(),
      data_evento: form.data_evento,
      local:       form.local.trim(),
      drones:      parseInt(form.drones)  || 0,
      valor:       parseFloat(form.valor) || 0,
      status:      form.status,
    };

    if (editingId) {
      const { data } = await supabase.from('crm').update(row).eq('id', editingId).select().single();
      if (data) setEntries(prev => prev.map(e => e.id === editingId ? data : e));
    } else {
      const { data } = await supabase.from('crm').insert(row).select().single();
      if (data) setEntries(prev => [data, ...prev]);
    }
    setModal(null);
    setEditingId(null);
  };

  const handleDelete = async (entry) => {
    if (!window.confirm(`Excluir "${entry.empresa}"?`)) return;
    await supabase.from('crm').delete().eq('id', entry.id);
    setEntries(prev => prev.filter(e => e.id !== entry.id));
    setDetail(null);
    setModal(null);
  };

  const convertToShow = async (entry) => {
    setConverting(true);
    await addShow({
      date:   entry.data_evento,
      status: 'neg',
      client: entry.empresa,
      drones: entry.drones || 0,
      city:   entry.local  || '',
      state:  '',
      test:   null,
      valor:  entry.valor  || null,
    });
    setConverting(false);
    setModal(null);
    setDetail(null);
    navigate('/shows');
  };

  const fmtDate = (str) => {
    if (!str) return '—';
    const [y, m, d] = str.split('-');
    return `${d}/${m}/${y}`;
  };

  const fmtVal = (v) =>
    v ? 'R$ ' + Number(v).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '—';

  const closeAdd = () => { setModal(null); setEditingId(null); };

  return (
    <div>
      <PageHeader label="Módulo" title="CRM" action={<Btn onClick={openAdd}>+ Novo Orçamento</Btn>} />

      {loading ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: '#555', fontSize: 10, letterSpacing: 3, textTransform: 'uppercase' }}>
          Carregando...
        </div>
      ) : entries.length === 0 ? (
        <div style={{ padding: '0 16px' }}>
          <Empty text="Nenhum orçamento cadastrado" />
        </div>
      ) : (
        <div style={{ padding: '14px 16px 0' }}>
          {entries.map(entry => {
            const color = STATUS_COLOR[entry.status] || '#888';
            return (
              <div key={entry.id}
                onClick={() => { setDetail(entry); setModal('detail'); }}
                style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', borderLeft: `3px solid ${color}`, padding: 12, marginBottom: 8, cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{entry.empresa}</div>
                  <span style={{ fontSize: 8, letterSpacing: 2, padding: '2px 8px', border: `1px solid ${color}`, color, textTransform: 'uppercase' }}>
                    {STATUS_LABEL[entry.status] || entry.status}
                  </span>
                </div>
                <div style={{ fontSize: 10, color: '#888', marginBottom: 6 }}>{entry.evento}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  <span style={{ fontSize: 9, color: '#555' }}>{fmtDate(entry.data_evento)}</span>
                  {entry.local  && <span style={{ fontSize: 9, color: '#555' }}>{entry.local}</span>}
                  {entry.drones > 0 && <span style={{ fontSize: 9, color: '#555' }}>{entry.drones} drones</span>}
                  {entry.valor  > 0 && <span style={{ fontSize: 9, color: '#555' }}>{fmtVal(entry.valor)}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: cadastro / edição */}
      {modal === 'add' && (
        <Modal title={editingId ? 'Editar Orçamento' : 'Novo Orçamento'} onClose={closeAdd}>
          <Input label="Nome da Empresa *" value={form.empresa}
            onChange={e => setForm({...form, empresa: e.target.value})} placeholder="Empresa Ltda." />
          <Input label="Telefone" value={form.telefone}
            onChange={e => setForm({...form, telefone: e.target.value})} placeholder="(00) 00000-0000" />
          <Input label="Nome do Contato" value={form.contato}
            onChange={e => setForm({...form, contato: e.target.value})} placeholder="João Silva" />
          <Input label="Nome do Evento *" value={form.evento}
            onChange={e => setForm({...form, evento: e.target.value})} placeholder="Aniversário, Lançamento..." />
          <Input label="Data do Evento *" type="date" value={form.data_evento}
            onChange={e => setForm({...form, data_evento: e.target.value})} />
          <Input label="Local do Evento" value={form.local}
            onChange={e => setForm({...form, local: e.target.value})} placeholder="Cidade, Estado" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Input label="Drones" type="number" value={form.drones}
              onChange={e => setForm({...form, drones: e.target.value})} placeholder="0" />
            <Input label="Valor (R$)" type="number" value={form.valor}
              onChange={e => setForm({...form, valor: e.target.value})} placeholder="0,00" />
          </div>
          <Select label="Status" value={form.status}
            onChange={e => setForm({...form, status: e.target.value})} options={STATUS_OPTS} />
          <ModalBtns onCancel={closeAdd} onSave={save} saveLabel={editingId ? 'Salvar' : 'Cadastrar'} />
        </Modal>
      )}

      {/* Modal: detalhes */}
      {modal === 'detail' && detail && (
        <Modal title="Detalhes do Orçamento" onClose={() => { setModal(null); setDetail(null); }}>
          <div style={{ marginBottom: 10 }}>
            <span style={{ fontSize: 8, letterSpacing: 2, padding: '3px 10px', border: `1px solid ${STATUS_COLOR[detail.status] || '#888'}`, color: STATUS_COLOR[detail.status] || '#888', textTransform: 'uppercase' }}>
              {STATUS_LABEL[detail.status] || detail.status}
            </span>
          </div>
          {[
            ['Empresa',  detail.empresa],
            ['Telefone', detail.telefone || '—'],
            ['Contato',  detail.contato  || '—'],
            ['Evento',   detail.evento],
            ['Data',     fmtDate(detail.data_evento)],
            ['Local',    detail.local    || '—'],
            ['Drones',   detail.drones   || '—'],
            ['Valor',    fmtVal(detail.valor)],
          ].map(([l, v]) => (
            <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #111', fontSize: 12 }}>
              <span style={{ color: '#666', fontSize: 10 }}>{l}</span>
              <span>{v}</span>
            </div>
          ))}

          <button onClick={() => convertToShow(detail)} disabled={converting} style={{
            width: '100%', marginTop: 14, padding: '10px 0',
            fontFamily: 'Space Mono, monospace', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase',
            cursor: converting ? 'not-allowed' : 'pointer',
            border: '1px solid #4caf50', background: 'transparent', color: '#4caf50',
            opacity: converting ? 0.6 : 1,
          }}>
            {converting ? 'Convertendo...' : '→ Converter para Show'}
          </button>

          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <Btn full variant="ghost"    onClick={() => { setModal(null); setDetail(null); }}>Fechar</Btn>
            <Btn full variant="outline"  onClick={() => openEdit(detail)}>Editar</Btn>
            <Btn full variant="danger"   onClick={() => handleDelete(detail)}>Excluir</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
