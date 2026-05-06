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

const FIELD = {
  background: '#000', border: '1px solid #333', color: '#fff',
  padding: '8px 10px', fontFamily: 'Space Mono, monospace', fontSize: 14,
  outline: 'none', width: '100%', boxSizing: 'border-box',
};
const LABEL = { fontSize: 11, letterSpacing: 3, color: '#aaa', textTransform: 'uppercase' };

function Textarea({ label, value, onChange, placeholder }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
      {label && <label style={LABEL}>{label}</label>}
      <textarea value={value} onChange={onChange} placeholder={placeholder}
        style={{ ...FIELD, minHeight: 80, resize: 'vertical' }}
        onFocus={e => e.target.style.borderColor = '#fff'}
        onBlur={e  => e.target.style.borderColor = '#333'}
      />
    </div>
  );
}

const emptyForm = () => ({
  empresa: '', telefone: '', contato: '', evento: '',
  data_evento: '', local: '', drones: '', valor: '', status: 'orcamento',
  observacao: '',
  cep: '', rua: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '',
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
  const [cepLoading, setCepLoading] = useState(false);

  useEffect(() => { loadEntries(); }, []);

  if (!isMaster()) return null;

  // ─── Carregamento ─────────────────────────────────
  const loadEntries = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('crm')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) alert('Erro ao carregar CRM: ' + error.message);
    if (data) setEntries(data);
    setLoading(false);
  };

  // ─── Abrir modais ────────────────────────────────
  const openAdd = () => { setEditingId(null); setForm(emptyForm()); setModal('add'); };

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
      status:      entry.status      || 'orcamento',
      observacao:  entry.observacao  || '',
      cep:         entry.cep         || '',
      rua:         entry.rua         || '',
      numero:      entry.numero      || '',
      complemento: entry.complemento || '',
      bairro:      entry.bairro      || '',
      cidade:      entry.cidade      || '',
      estado:      entry.estado      || '',
    });
    setDetail(null);
    setModal('add');
  };

  // ─── Busca de CEP ────────────────────────────────
  const buscarCep = async () => {
    const cep = form.cep.replace(/\D/g, '');
    if (cep.length !== 8) { alert('CEP inválido. Informe 8 dígitos.'); return; }
    setCepLoading(true);
    try {
      const res  = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await res.json();
      if (data.erro) { alert('CEP não encontrado.'); return; }
      setForm(f => ({
        ...f,
        rua:    data.logradouro || '',
        bairro: data.bairro     || '',
        cidade: data.localidade || '',
        estado: data.uf         || '',
      }));
    } catch {
      alert('Erro ao buscar CEP. Verifique sua conexão.');
    } finally {
      setCepLoading(false);
    }
  };

  // ─── Salvar (insert / update) ────────────────────
  const save = async () => {
    if (!form.empresa.trim()) { alert('Informe o nome da empresa.');  return; }
    if (!form.evento.trim())  { alert('Informe o nome do evento.');   return; }
    if (!form.data_evento)    { alert('Informe a data do evento.');   return; }

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
      observacao:  form.observacao.trim(),
      cep:         form.cep.trim(),
      rua:         form.rua.trim(),
      numero:      form.numero.trim(),
      complemento: form.complemento.trim(),
      bairro:      form.bairro.trim(),
      cidade:      form.cidade.trim(),
      estado:      form.estado.trim(),
    };

    if (editingId) {
      const { data, error } = await supabase.from('crm').update(row).eq('id', editingId).select().single();
      if (error) { alert('Erro ao salvar: ' + error.message); return; }
      if (data)  setEntries(prev => prev.map(e => e.id === editingId ? data : e));
    } else {
      const { data, error } = await supabase.from('crm').insert(row).select().single();
      if (error) { alert('Erro ao salvar: ' + error.message); return; }
      if (data)  setEntries(prev => [data, ...prev]);
    }

    setModal(null);
    setEditingId(null);
  };

  // ─── Excluir ────────────────────────────────────
  const handleDelete = async (entry) => {
    if (!window.confirm(`Deseja excluir o orçamento de ${entry.empresa}? Esta ação não pode ser desfeita.`)) return;
    const { error } = await supabase.from('crm').delete().eq('id', entry.id);
    if (error) { alert('Erro ao excluir: ' + error.message); return; }
    setEntries(prev => prev.filter(e => e.id !== entry.id));
    setDetail(null);
    setModal(null);
  };

  // ─── Converter para Show ─────────────────────────
  const convertToShow = async (entry) => {
    setConverting(true);
    await addShow({
      date:   entry.data_evento,
      status: 'neg',
      client: entry.empresa,
      drones: entry.drones || 0,
      city:   entry.cidade || entry.local || '',
      state:  entry.estado || '',
      test:   null,
      valor:  entry.valor  || null,
    });
    setConverting(false);
    setModal(null);
    setDetail(null);
    navigate('/shows');
  };

  // ─── Formatação ──────────────────────────────────
  const fmtDate = (str) => {
    if (!str) return '—';
    const [y, m, d] = str.split('-');
    return `${d}/${m}/${y}`;
  };

  const fmtVal = (v) =>
    v ? 'R$ ' + Number(v).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '—';

  const fmtAddress = (e) => {
    const parts = [
      e.rua && e.numero ? `${e.rua}, ${e.numero}` : e.rua,
      e.complemento,
      e.bairro,
      e.cidade && e.estado ? `${e.cidade} - ${e.estado}` : (e.cidade || e.estado),
      e.cep ? `CEP ${e.cep}` : '',
    ].filter(Boolean);
    return parts.length ? parts.join(' · ') : '—';
  };

  const closeAdd    = () => { setModal(null); setEditingId(null); };
  const closeDetail = () => { setModal(null); setDetail(null); };

  // ─── Render ──────────────────────────────────────
  return (
    <div>
      <PageHeader label="Módulo" title="CRM" action={<Btn onClick={openAdd}>+ Novo Orçamento</Btn>} />

      {loading ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: '#aaa', fontSize: 12, letterSpacing: 3, textTransform: 'uppercase' }}>
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
                <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>{entry.evento}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  <span style={{ fontSize: 11, color: '#aaa' }}>{fmtDate(entry.data_evento)}</span>
                  {(entry.cidade || entry.local) && (
                    <span style={{ fontSize: 11, color: '#aaa' }}>{entry.cidade || entry.local}</span>
                  )}
                  {entry.drones > 0 && <span style={{ fontSize: 11, color: '#aaa' }}>{entry.drones} drones</span>}
                  {entry.valor  > 0 && <span style={{ fontSize: 11, color: '#aaa' }}>{fmtVal(entry.valor)}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Modal: cadastro / edição ─── */}
      {modal === 'add' && (
        <Modal title={editingId ? 'Editar Orçamento' : 'Novo Orçamento'} onClose={closeAdd}>

          <div style={{ fontSize: 11, letterSpacing: 3, color: '#aaa', textTransform: 'uppercase', marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid #1a1a1a' }}>
            Dados do Cliente
          </div>
          <Input label="Nome da Empresa *" value={form.empresa}
            onChange={e => setForm({...form, empresa: e.target.value})} placeholder="Empresa Ltda." />
          <Input label="Telefone" value={form.telefone}
            onChange={e => setForm({...form, telefone: e.target.value})} placeholder="(00) 00000-0000" />
          <Input label="Nome do Contato" value={form.contato}
            onChange={e => setForm({...form, contato: e.target.value})} placeholder="João Silva" />

          <div style={{ fontSize: 11, letterSpacing: 3, color: '#aaa', textTransform: 'uppercase', marginBottom: 8, marginTop: 6, paddingBottom: 6, borderBottom: '1px solid #1a1a1a' }}>
            Dados do Evento
          </div>
          <Input label="Nome do Evento *" value={form.evento}
            onChange={e => setForm({...form, evento: e.target.value})} placeholder="Aniversário, Lançamento..." />
          <Input label="Data do Evento *" type="date" value={form.data_evento}
            onChange={e => setForm({...form, data_evento: e.target.value})} />
          <Input label="Nome do Local / Espaço" value={form.local}
            onChange={e => setForm({...form, local: e.target.value})} placeholder="Ex: Buffet Estrela, Arena XYZ" />

          <div style={{ fontSize: 11, letterSpacing: 3, color: '#aaa', textTransform: 'uppercase', marginBottom: 8, marginTop: 6, paddingBottom: 6, borderBottom: '1px solid #1a1a1a' }}>
            Endereço
          </div>
          {/* CEP com botão buscar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
            <label style={LABEL}>CEP</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <input value={form.cep}
                onChange={e => setForm({...form, cep: e.target.value})}
                placeholder="00000-000" maxLength={9}
                style={{ ...FIELD, flex: 1 }}
                onFocus={e => e.target.style.borderColor = '#fff'}
                onBlur={e  => e.target.style.borderColor = '#333'}
              />
              <button onClick={buscarCep} disabled={cepLoading} style={{
                padding: '0 14px', background: 'transparent', border: '1px solid #fff',
                color: cepLoading ? '#666' : '#fff', fontFamily: 'Space Mono, monospace',
                fontSize: 11, letterSpacing: 1, textTransform: 'uppercase',
                cursor: cepLoading ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
              }}>
                {cepLoading ? '...' : 'Buscar'}
              </button>
            </div>
          </div>
          <Input label="Rua / Logradouro" value={form.rua}
            onChange={e => setForm({...form, rua: e.target.value})} placeholder="Rua das Flores" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Input label="Número" value={form.numero}
              onChange={e => setForm({...form, numero: e.target.value})} placeholder="123" />
            <Input label="Complemento" value={form.complemento}
              onChange={e => setForm({...form, complemento: e.target.value})} placeholder="Apto 4" />
          </div>
          <Input label="Bairro" value={form.bairro}
            onChange={e => setForm({...form, bairro: e.target.value})} placeholder="Centro" />
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8 }}>
            <Input label="Cidade" value={form.cidade}
              onChange={e => setForm({...form, cidade: e.target.value})} placeholder="São Paulo" />
            <Input label="Estado" value={form.estado}
              onChange={e => setForm({...form, estado: e.target.value})} placeholder="SP" />
          </div>

          <div style={{ fontSize: 11, letterSpacing: 3, color: '#aaa', textTransform: 'uppercase', marginBottom: 8, marginTop: 6, paddingBottom: 6, borderBottom: '1px solid #1a1a1a' }}>
            Negociação
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Input label="Drones" type="number" value={form.drones}
              onChange={e => setForm({...form, drones: e.target.value})} placeholder="0" />
            <Input label="Valor (R$)" type="number" value={form.valor}
              onChange={e => setForm({...form, valor: e.target.value})} placeholder="0,00" />
          </div>
          <Select label="Status" value={form.status}
            onChange={e => setForm({...form, status: e.target.value})} options={STATUS_OPTS} />
          <Textarea label="Observações" value={form.observacao}
            onChange={e => setForm({...form, observacao: e.target.value})} placeholder="Informações adicionais, requisitos especiais..." />

          <ModalBtns onCancel={closeAdd} onSave={save} saveLabel={editingId ? 'Salvar' : 'Cadastrar'} />
        </Modal>
      )}

      {/* ─── Modal: detalhes ─── */}
      {modal === 'detail' && detail && (() => {
        const color = STATUS_COLOR[detail.status] || '#888';
        return (
          <Modal title="Detalhes do Orçamento" onClose={closeDetail}>
            <div style={{ marginBottom: 12 }}>
              <span style={{ fontSize: 8, letterSpacing: 2, padding: '3px 10px', border: `1px solid ${color}`, color, textTransform: 'uppercase' }}>
                {STATUS_LABEL[detail.status] || detail.status}
              </span>
            </div>

            {[
              ['Empresa',  detail.empresa],
              ['Telefone', detail.telefone   || '—'],
              ['Contato',  detail.contato    || '—'],
              ['Evento',   detail.evento],
              ['Data',     fmtDate(detail.data_evento)],
              ['Local',    detail.local      || '—'],
              ['Endereço', fmtAddress(detail)],
              ['Drones',   detail.drones > 0 ? `${detail.drones} drones` : '—'],
              ['Valor',    fmtVal(detail.valor)],
            ].map(([l, v]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '7px 0', borderBottom: '1px solid #111', gap: 10 }}>
                <span style={{ color: '#aaa', fontSize: 12, flexShrink: 0 }}>{l}</span>
                <span style={{ fontSize: 14, textAlign: 'right', wordBreak: 'break-word' }}>{v}</span>
              </div>
            ))}

            {detail.observacao && (
              <div style={{ padding: '10px 0', borderBottom: '1px solid #111' }}>
                <div style={{ color: '#aaa', fontSize: 12, marginBottom: 5, letterSpacing: 1, textTransform: 'uppercase' }}>Observações</div>
                <div style={{ fontSize: 13, color: '#ccc', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{detail.observacao}</div>
              </div>
            )}

            <button onClick={() => convertToShow(detail)} disabled={converting} style={{
              width: '100%', marginTop: 14, padding: '10px 0',
              fontFamily: 'Space Mono, monospace', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase',
              cursor: converting ? 'not-allowed' : 'pointer',
              border: '1px solid #4caf50', background: 'transparent', color: '#4caf50',
              opacity: converting ? 0.6 : 1,
            }}>
              {converting ? 'Convertendo...' : '→ Converter para Show'}
            </button>

            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <Btn full variant="ghost"   onClick={closeDetail}>Fechar</Btn>
              <Btn full variant="outline" onClick={() => openEdit(detail)}>Editar</Btn>
              <Btn full variant="danger"  onClick={() => handleDelete(detail)}>Excluir</Btn>
            </div>
          </Modal>
        );
      })()}
    </div>
  );
}
