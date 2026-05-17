import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { PageHeader, Btn, Modal, ModalBtns, Empty } from '../components/layout/UI';

const STATUS_COLOR = { orcamento: '#ff9800', negociando: '#ffeb3b', confirmado: '#4caf50' };
const STATUS_LABEL = { orcamento: 'Orçamento', negociando: 'Negociando', confirmado: 'Confirmado' };

const FIELD = {
  background: '#000', border: '1px solid #333', color: '#fff',
  padding: '8px 10px', fontFamily: 'Space Mono, monospace', fontSize: 14,
  outline: 'none', width: '100%', boxSizing: 'border-box',
};
const LABEL = { fontSize: 11, letterSpacing: 3, color: '#aaa', textTransform: 'uppercase' };
const SEC = {
  fontSize: 11, letterSpacing: 3, color: '#aaa', textTransform: 'uppercase',
  marginBottom: 8, marginTop: 6, paddingBottom: 6, borderBottom: '1px solid #1a1a1a',
};

function FInput({ label, value, onChange, placeholder, type = 'text', maxLength }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
      {label && <label style={LABEL}>{label}</label>}
      <input type={type} value={value} onChange={onChange} placeholder={placeholder} maxLength={maxLength}
        style={FIELD}
        onFocus={e => e.target.style.borderColor = '#fff'}
        onBlur={e => e.target.style.borderColor = '#333'}
      />
    </div>
  );
}

function FTextarea({ label, value, onChange, placeholder, rows = 4 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
      {label && <label style={LABEL}>{label}</label>}
      <textarea value={value} onChange={onChange} placeholder={placeholder} rows={rows}
        style={{ ...FIELD, resize: 'vertical' }}
        onFocus={e => e.target.style.borderColor = '#fff'}
        onBlur={e => e.target.style.borderColor = '#333'}
      />
    </div>
  );
}

const emptyClientForm = () => ({
  tipo: 'pf', nome: '', empresa: '', contato: '',
  telefone: '', telefoneIsWhatsapp: true, whatsapp: '', email: '',
});

const emptyNegoForm = () => ({
  data_evento: '', drones: '', cidade: '', estado: '', observacao: '',
});

const emptyEditForm = (c = {}) => ({
  tipo: c.tipo || 'pf',
  nome: c.nome || '', empresa: c.nome_empresa || '', contato: c.contato || '',
  telefone: c.telefone || '', telefoneIsWhatsapp: c.tem_whatsapp !== false, whatsapp: c.whatsapp || '',
  email: c.email || '', cpf: c.cpf || '', cnpj: c.cnpj || '',
  cep: c.cep || '', rua: c.rua || '', numero: c.numero || '',
  complemento: c.complemento || '', bairro: c.bairro || '',
  cidade: c.cidade || '', estado: c.estado || '', ramo: c.ramo_atividade || '',
});

function TypeToggle({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
      {['pf', 'pj'].map(t => (
        <button key={t} onClick={() => onChange(t)} style={{
          flex: 1, padding: '8px 0', fontFamily: 'Space Mono,monospace', fontSize: 10,
          letterSpacing: 3, textTransform: 'uppercase', cursor: 'pointer',
          border: `1px solid ${value === t ? '#fff' : '#333'}`,
          background: value === t ? '#fff' : 'transparent',
          color: value === t ? '#000' : '#888',
        }}>
          {t === 'pf' ? 'Pessoa Física' : 'Pessoa Jurídica'}
        </button>
      ))}
    </div>
  );
}

function PhoneFields({ f, setF }) {
  return (
    <>
      <FInput label="Telefone" value={f.telefone}
        onChange={e => setF(prev => ({ ...prev, telefone: e.target.value }))} placeholder="(00) 00000-0000" />
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: f.telefoneIsWhatsapp ? 10 : 4, cursor: 'pointer' }}>
        <input type="checkbox" checked={f.telefoneIsWhatsapp}
          onChange={e => setF(prev => ({ ...prev, telefoneIsWhatsapp: e.target.checked }))}
          style={{ accentColor: '#4caf50', width: 14, height: 14 }} />
        <span style={{ fontSize: 11, color: '#aaa', letterSpacing: 1 }}>Este telefone é WhatsApp</span>
      </label>
      {!f.telefoneIsWhatsapp && (
        <FInput label="WhatsApp" value={f.whatsapp}
          onChange={e => setF(prev => ({ ...prev, whatsapp: e.target.value }))} placeholder="(00) 00000-0000" />
      )}
    </>
  );
}

function fmtDate(str) {
  if (!str) return '—';
  const [y, m, d] = str.split('-');
  return `${d}/${m}/${y}`;
}

function fmtDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const p = n => n < 10 ? '0' + n : n;
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function displayName(c) { return c?.tipo === 'pj' ? (c.nome_empresa || '—') : (c?.nome || '—'); }

export default function CRM() {
  const { isMaster } = useAuth();
  const { addShow } = useApp();

  const [clients,  setClients]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [view,     setView]     = useState(null);

  // Step 1
  const [clientForm,   setClientForm]   = useState(emptyClientForm());
  const [savedClient,  setSavedClient]  = useState(null);
  const [savingClient, setSavingClient] = useState(false);

  // Step 2
  const [negoForm,     setNegoForm]     = useState(emptyNegoForm());
  const [dateStatus,   setDateStatus]   = useState(null);
  const [checkingDate, setCheckingDate] = useState(false);
  const [savedNego,    setSavedNego]    = useState(null);
  const [savingNego,   setSavingNego]   = useState(false);

  // Detail
  const [selectedClient, setSelectedClient] = useState(null);
  const [observations,   setObservations]   = useState([]);
  const [negotiations,   setNegotiations]   = useState([]);
  const [loadingDetail,  setLoadingDetail]  = useState(false);

  // Observation
  const [obsText,   setObsText]   = useState('');
  const [savingObs, setSavingObs] = useState(false);

  // Edit
  const [editForm,      setEditForm]      = useState({});
  const [socios,        setSocios]        = useState([{ nome: '', cpf: '', contato: '' }]);
  const [cepLoading,    setCepLoading]    = useState(false);
  const [uploadingDocs, setUploadingDocs] = useState(false);
  const [editingId,     setEditingId]     = useState(null);

  useEffect(() => { loadClients(); }, []);

  if (!isMaster()) return null;

  // ── Data ──────────────────────────────────────────────────────────
  async function loadClients() {
    setLoading(true);
    const [{ data }, { data: negos }] = await Promise.all([
      supabase.from('crm').select('*').order('created_at', { ascending: false }),
      supabase.from('crm_negociacoes').select('crm_id, status').order('created_at', { ascending: false }),
    ]);
    const statusMap = {};
    if (negos) for (const n of negos) { if (!statusMap[n.crm_id]) statusMap[n.crm_id] = n.status; }
    if (data) setClients(data.map(c => ({ ...c, _negoStatus: statusMap[c.id] || null })));
    setLoading(false);
  }

  async function loadDetail(client) {
    setLoadingDetail(true);
    const [obsRes, negoRes] = await Promise.all([
      supabase.from('crm_observacoes').select('*').eq('crm_id', client.id).order('criado_em', { ascending: false }),
      supabase.from('crm_negociacoes').select('*').eq('crm_id', client.id).order('created_at', { ascending: false }),
    ]);
    setObservations(obsRes.data || []);
    setNegotiations(negoRes.data || []);
    setLoadingDetail(false);
  }

  // ── Step 1: save client ────────────────────────────────────────────
  async function saveClient() {
    const f = clientForm;
    if (f.tipo === 'pf' && !f.nome.trim())    { alert('Informe o nome.'); return; }
    if (f.tipo === 'pj' && !f.empresa.trim()) { alert('Informe o nome da empresa.'); return; }
    if (f.tipo === 'pj' && !f.contato.trim()) { alert('Informe o nome do contato.'); return; }
    setSavingClient(true);
    const row = {
      tipo:         f.tipo,
      ...(f.tipo === 'pf'
        ? { nome: f.nome.trim() }
        : { nome_empresa: f.empresa.trim(), contato: f.contato.trim() }
      ),
      email:        f.email.trim(),
      telefone:     f.telefone.trim(),
      tem_whatsapp: f.telefoneIsWhatsapp,
      whatsapp:     f.telefoneIsWhatsapp ? '' : f.whatsapp.trim(),
    };
    const { data, error } = await supabase.from('crm').insert(row).select().single();
    setSavingClient(false);
    if (error) { alert('Erro ao salvar: ' + error.message); return; }
    setClients(prev => [{ ...data, _negoStatus: null }, ...prev]);
    setSavedClient(data);
    setView('nego_prompt');
  }

  // ── Step 2: check date ─────────────────────────────────────────────
  async function checkDate(date) {
    setNegoForm(f => ({ ...f, data_evento: date }));
    if (!date) { setDateStatus(null); return; }
    setCheckingDate(true);
    const { data } = await supabase.from('shows').select('status, drones').eq('data', date);
    setCheckingDate(false);
    if (!data || data.length === 0) {
      setDateStatus({ type: 'ok', msg: 'Data disponível' });
    } else {
      const s = data[0];
      if (s.status === 'conf')
        setDateStatus({ type: 'conf', msg: `Data com show confirmado — ${s.drones} drones` });
      else if (s.status === 'neg')
        setDateStatus({ type: 'neg', msg: `Data em negociação — ${s.drones} drones` });
      else
        setDateStatus({ type: 'ok', msg: 'Data disponível' });
    }
  }

  // ── Step 2: save negotiation ───────────────────────────────────────
  async function saveNego() {
    if (!negoForm.data_evento) { alert('Informe a data do evento.'); return; }
    setSavingNego(true);
    let obs = negoForm.observacao.trim();
    if (obs) obs = `[${fmtDateTime(new Date().toISOString())}] ${obs}`;
    const row = {
      crm_id:      savedClient.id,
      data_evento: negoForm.data_evento,
      drones:      parseInt(negoForm.drones) || 0,
      cidade:      negoForm.cidade.trim(),
      estado:      negoForm.estado.trim(),
      observacao:  obs,
      status:      'orcamento',
    };
    const { data, error } = await supabase.from('crm_negociacoes').insert(row).select().single();
    setSavingNego(false);
    if (error) { alert('Erro ao salvar negociação: ' + error.message); return; }
    setSavedNego(data);
    setClients(prev => prev.map(c => c.id === savedClient.id ? { ...c, _negoStatus: 'orcamento' } : c));
    setView('block_date_prompt');
  }

  async function handleBlockDate() {
    if (!savedNego || !savedClient) return;
    await addShow({
      date:   savedNego.data_evento,
      status: 'neg',
      client: displayName(savedClient),
      drones: savedNego.drones || 0,
      city:   savedNego.cidade || '',
      state:  savedNego.estado || '',
      test:   null, valor: null,
    });
    closeAll();
  }

  function closeAll() {
    setView(null);
    setClientForm(emptyClientForm());
    setNegoForm(emptyNegoForm());
    setSavedClient(null);
    setSavedNego(null);
    setDateStatus(null);
  }

  // ── Detail ────────────────────────────────────────────────────────
  async function openDetail(client) {
    setSelectedClient(client);
    setView('detail');
    await loadDetail(client);
  }

  // ── Delete ────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!window.confirm(`Excluir ${displayName(selectedClient)}? Esta ação não pode ser desfeita.`)) return;
    const { error } = await supabase.from('crm').delete().eq('id', selectedClient.id);
    if (error) { alert('Erro: ' + error.message); return; }
    setClients(prev => prev.filter(c => c.id !== selectedClient.id));
    setView(null);
    setSelectedClient(null);
  }

  // ── Observation ───────────────────────────────────────────────────
  async function saveObs() {
    if (!obsText.trim()) return;
    setSavingObs(true);
    const { data, error } = await supabase.from('crm_observacoes').insert({
      crm_id:    selectedClient.id,
      texto:     obsText.trim(),
      criado_em: new Date().toISOString(),
    }).select().single();
    setSavingObs(false);
    if (error) { alert('Erro: ' + error.message); return; }
    setObservations(prev => [data, ...prev]);
    setObsText('');
    setView('detail');
  }

  // ── Edit ──────────────────────────────────────────────────────────
  function openEdit(client) {
    setEditingId(client.id);
    setEditForm(emptyEditForm(client));
    setSocios(
      Array.isArray(client.socios) && client.socios.length
        ? client.socios
        : [{ nome: '', cpf: '', contato: '' }]
    );
    setView('edit_client');
  }

  async function buscarCep() {
    const cep = editForm.cep.replace(/\D/g, '');
    if (cep.length !== 8) { alert('CEP inválido. Informe 8 dígitos.'); return; }
    setCepLoading(true);
    try {
      const res  = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await res.json();
      if (data.erro) { alert('CEP não encontrado.'); }
      else setEditForm(f => ({ ...f, rua: data.logradouro || '', bairro: data.bairro || '', cidade: data.localidade || '', estado: data.uf || '' }));
    } catch { alert('Erro ao buscar CEP.'); }
    setCepLoading(false);
  }

  async function handleDocUpload(files) {
    if (!files?.length || !editingId) return;
    setUploadingDocs(true);
    for (const file of files) {
      const path = `crm/${editingId}/${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage.from('comprovantes').upload(path, file);
      if (upErr) continue;
      const { data: urlData } = supabase.storage.from('comprovantes').getPublicUrl(path);
      const ext = file.name.split('.').pop().toLowerCase();
      const tipo = ['jpg','jpeg','png','gif','webp'].includes(ext) ? 'img' : ext === 'pdf' ? 'pdf' : 'doc';
      await supabase.from('crm_documentos').insert({
        crm_id: editingId,
        nome:   file.name,
        url:    urlData.publicUrl,
        tipo,
      });
    }
    setUploadingDocs(false);
    alert('Documentos enviados com sucesso!');
  }

  async function saveEdit() {
    const f = editForm;
    if (f.tipo === 'pf' && !f.nome.trim())    { alert('Informe o nome.'); return; }
    if (f.tipo === 'pj' && !f.empresa.trim()) { alert('Informe o nome da empresa.'); return; }
    const row = {
      tipo:           f.tipo,
      nome:           f.tipo === 'pf' ? f.nome.trim()    : '',
      nome_empresa:   f.tipo === 'pj' ? f.empresa.trim() : '',
      contato:        f.contato.trim(),
      telefone:       f.telefone.trim(),
      tem_whatsapp:   f.telefoneIsWhatsapp,
      whatsapp:       f.telefoneIsWhatsapp ? '' : f.whatsapp.trim(),
      email:          f.email.trim(),
      cpf:            f.tipo === 'pf' ? f.cpf.trim()  : '',
      cnpj:           f.tipo === 'pj' ? f.cnpj.trim() : '',
      cep:            f.cep.trim(),
      rua:            f.rua.trim(),
      numero:         f.numero.trim(),
      complemento:    f.complemento.trim(),
      bairro:         f.bairro.trim(),
      cidade:         f.cidade.trim(),
      estado:         f.estado.trim(),
      ramo_atividade: f.tipo === 'pj' ? f.ramo.trim() : '',
      socios:         f.tipo === 'pj' ? socios.filter(s => s.nome.trim()) : [],
    };
    const { data, error } = await supabase.from('crm').update(row).eq('id', editingId).select().single();
    if (error) { alert('Erro ao salvar: ' + error.message); return; }
    setClients(prev => prev.map(c => c.id === editingId ? { ...data, _negoStatus: c._negoStatus } : c));
    setSelectedClient({ ...data, _negoStatus: selectedClient._negoStatus });
    setView('detail');
  }

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div>
      <PageHeader label="Módulo" title="CRM"
        action={<Btn onClick={() => { setClientForm(emptyClientForm()); setView('new_client'); }}>+ Novo Cliente</Btn>}
      />

      {/* Lista de clientes */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: '#aaa', fontSize: 12, letterSpacing: 3, textTransform: 'uppercase' }}>
          Carregando...
        </div>
      ) : clients.length === 0 ? (
        <div style={{ padding: '0 16px' }}><Empty text="Nenhum cliente cadastrado" /></div>
      ) : (
        <div style={{ padding: '14px 16px 0' }}>
          {clients.map(c => {
            const color = STATUS_COLOR[c._negoStatus] || '#444';
            return (
              <div key={c.id} onClick={() => openDetail(c)}
                style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', borderLeft: `3px solid ${color}`, padding: 12, marginBottom: 8, cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{displayName(c)}</div>
                  {c._negoStatus && (
                    <span style={{ fontSize: 8, letterSpacing: 2, padding: '2px 8px', border: `1px solid ${color}`, color, textTransform: 'uppercase' }}>
                      {STATUS_LABEL[c._negoStatus]}
                    </span>
                  )}
                </div>
                {c.tipo === 'pj' && c.contato && (
                  <div style={{ fontSize: 12, color: '#888', marginBottom: 3 }}>{c.contato}</div>
                )}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  {c.telefone && <span style={{ fontSize: 11, color: '#aaa' }}>{c.telefone}</span>}
                  {c.email    && <span style={{ fontSize: 11, color: '#aaa' }}>{c.email}</span>}
                  <span style={{ fontSize: 9, letterSpacing: 2, color: '#555', textTransform: 'uppercase' }}>
                    {c.tipo === 'pj' ? 'PJ' : 'PF'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── MODAL: Novo Cliente (Etapa 1) ── */}
      {view === 'new_client' && (
        <Modal title="Novo Cliente — Etapa 1" onClose={() => setView(null)}>
          <TypeToggle value={clientForm.tipo} onChange={t => setClientForm(f => ({ ...f, tipo: t }))} />

          {clientForm.tipo === 'pf' ? (
            <FInput label="Nome *" value={clientForm.nome}
              onChange={e => setClientForm(f => ({ ...f, nome: e.target.value }))} placeholder="João Silva" />
          ) : (
            <>
              <FInput label="Nome da Empresa *" value={clientForm.empresa}
                onChange={e => setClientForm(f => ({ ...f, empresa: e.target.value }))} placeholder="Empresa Ltda." />
              <FInput label="Nome do Contato *" value={clientForm.contato}
                onChange={e => setClientForm(f => ({ ...f, contato: e.target.value }))} placeholder="João Silva" />
            </>
          )}

          <PhoneFields f={clientForm} setF={setClientForm} />
          <FInput label="Email" type="email" value={clientForm.email}
            onChange={e => setClientForm(f => ({ ...f, email: e.target.value }))} placeholder="contato@empresa.com" />

          <ModalBtns onCancel={() => setView(null)} onSave={saveClient}
            saveLabel={savingClient ? 'Salvando...' : 'Salvar'} disabled={savingClient} />
        </Modal>
      )}

      {/* ── MODAL: Deseja cadastrar negociação? ── */}
      {view === 'nego_prompt' && (
        <Modal title="Cliente Salvo" onClose={closeAll}>
          <div style={{ fontSize: 14, color: '#ccc', marginBottom: 20, lineHeight: 1.7 }}>
            <strong>{displayName(savedClient)}</strong> cadastrado com sucesso.
            <br />Deseja cadastrar uma negociação?
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn full variant="ghost"   onClick={closeAll}>Não</Btn>
            <Btn full variant="primary" onClick={() => { setNegoForm(emptyNegoForm()); setDateStatus(null); setView('new_nego'); }}>Sim</Btn>
          </div>
        </Modal>
      )}

      {/* ── MODAL: Nova Negociação (Etapa 2) ── */}
      {view === 'new_nego' && (
        <Modal title="Nova Negociação — Etapa 2" onClose={closeAll}>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>
            Cliente: <span style={{ color: '#fff' }}>{displayName(savedClient)}</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 6 }}>
            <label style={LABEL}>Data do Evento *</label>
            <input type="date" value={negoForm.data_evento} onChange={e => checkDate(e.target.value)}
              style={FIELD}
              onFocus={e => e.target.style.borderColor = '#fff'}
              onBlur={e => e.target.style.borderColor = '#333'}
            />
          </div>

          {checkingDate && (
            <div style={{ fontSize: 12, color: '#aaa', marginBottom: 10, letterSpacing: 1 }}>
              Verificando data...
            </div>
          )}
          {!checkingDate && dateStatus && (
            <div style={{
              fontSize: 12, padding: '8px 12px', marginBottom: 10, letterSpacing: 1,
              border: `1px solid ${dateStatus.type === 'ok' ? '#4caf50' : dateStatus.type === 'neg' ? '#ff9800' : '#f44336'}`,
              color:  dateStatus.type === 'ok' ? '#4caf50' : dateStatus.type === 'neg' ? '#ff9800' : '#f44336',
              background: dateStatus.type === 'ok' ? '#0a1a0a' : dateStatus.type === 'neg' ? '#1a0f00' : '#1a0a0a',
            }}>
              {dateStatus.msg}
            </div>
          )}

          <FInput label="Quantidade de Drones" type="number" value={negoForm.drones}
            onChange={e => setNegoForm(f => ({ ...f, drones: e.target.value }))} placeholder="0" />
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8 }}>
            <FInput label="Cidade" value={negoForm.cidade}
              onChange={e => setNegoForm(f => ({ ...f, cidade: e.target.value }))} placeholder="São Paulo" />
            <FInput label="UF" value={negoForm.estado}
              onChange={e => setNegoForm(f => ({ ...f, estado: e.target.value.toUpperCase() }))} placeholder="SP" maxLength={2} />
          </div>
          <FTextarea label="Observação" value={negoForm.observacao}
            onChange={e => setNegoForm(f => ({ ...f, observacao: e.target.value }))}
            placeholder="Detalhes, requisitos especiais..." />

          <ModalBtns onCancel={closeAll} onSave={saveNego}
            saveLabel={savingNego ? 'Salvando...' : 'Salvar'} disabled={savingNego} />
        </Modal>
      )}

      {/* ── MODAL: Deseja bloquear a data? ── */}
      {view === 'block_date_prompt' && (
        <Modal title="Negociação Salva" onClose={closeAll}>
          <div style={{ fontSize: 14, color: '#ccc', marginBottom: 20, lineHeight: 1.7 }}>
            Deseja bloquear a data <strong>{fmtDate(savedNego?.data_evento)}</strong> na agenda de shows?
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Btn full variant="success" onClick={handleBlockDate}>Bloquear Data</Btn>
            <Btn full variant="ghost"   onClick={closeAll}>Só Salvar</Btn>
          </div>
        </Modal>
      )}

      {/* ── MODAL: Detalhes do Cliente ── */}
      {view === 'detail' && selectedClient && (
        <Modal title="Detalhes" onClose={() => { setView(null); setSelectedClient(null); }}>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{displayName(selectedClient)}</div>
            <span style={{ fontSize: 9, letterSpacing: 2, padding: '2px 8px', border: '1px solid #444', color: '#888', textTransform: 'uppercase' }}>
              {selectedClient.tipo === 'pj' ? 'Pessoa Jurídica' : 'Pessoa Física'}
            </span>
          </div>

          {[
            selectedClient.tipo === 'pj' && selectedClient.contato ? ['Contato', selectedClient.contato] : null,
            selectedClient.telefone ? ['Telefone', selectedClient.telefone] : null,
            selectedClient.whatsapp ? ['WhatsApp', selectedClient.whatsapp] : null,
            selectedClient.email    ? ['Email',    selectedClient.email]    : null,
            selectedClient.cpf      ? ['CPF',      selectedClient.cpf]      : null,
            selectedClient.cnpj     ? ['CNPJ',     selectedClient.cnpj]     : null,
            selectedClient.ramo_atividade ? ['Ramo', selectedClient.ramo_atividade] : null,
            (selectedClient.cidade || selectedClient.estado)
              ? ['Cidade', [selectedClient.cidade, selectedClient.estado].filter(Boolean).join(' – ')] : null,
            selectedClient.cep  ? ['CEP', selectedClient.cep] : null,
            selectedClient.rua  ? ['Endereço', [selectedClient.rua, selectedClient.numero, selectedClient.complemento, selectedClient.bairro].filter(Boolean).join(', ')] : null,
          ].filter(Boolean).map(([l, v]) => (
            <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #111', gap: 10 }}>
              <span style={{ color: '#aaa', fontSize: 12, flexShrink: 0 }}>{l}</span>
              <span style={{ fontSize: 13, textAlign: 'right', wordBreak: 'break-word' }}>{v}</span>
            </div>
          ))}

          {/* Sócios PJ */}
          {selectedClient.tipo === 'pj' && Array.isArray(selectedClient.socios) && selectedClient.socios.length > 0 && (
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #1a1a1a' }}>
              <div style={SEC}>Sócios</div>
              {selectedClient.socios.map((s, i) => (
                <div key={i} style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', padding: '8px 10px', marginBottom: 4 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{s.nome}</div>
                  {s.cpf     && <div style={{ fontSize: 11, color: '#aaa' }}>CPF: {s.cpf}</div>}
                  {s.contato && <div style={{ fontSize: 11, color: '#aaa' }}>Contato: {s.contato}</div>}
                </div>
              ))}
            </div>
          )}

          {/* Negociações */}
          {!loadingDetail && negotiations.length > 0 && (
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #1a1a1a' }}>
              <div style={SEC}>Negociações</div>
              {negotiations.map(n => {
                const col = STATUS_COLOR[n.status] || '#444';
                return (
                  <div key={n.id} style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', borderLeft: `3px solid ${col}`, padding: '8px 10px', marginBottom: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{fmtDate(n.data_evento)}</span>
                      <span style={{ fontSize: 8, letterSpacing: 2, padding: '2px 8px', border: `1px solid ${col}`, color: col, textTransform: 'uppercase' }}>
                        {STATUS_LABEL[n.status] || n.status}
                      </span>
                    </div>
                    {(n.cidade || n.estado) && (
                      <div style={{ fontSize: 12, color: '#888' }}>{[n.cidade, n.estado].filter(Boolean).join(' – ')}</div>
                    )}
                    {n.drones > 0 && <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>{n.drones} drones</div>}
                  </div>
                );
              })}
            </div>
          )}

          {/* Histórico de observações */}
          {!loadingDetail && observations.length > 0 && (
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #1a1a1a' }}>
              <div style={SEC}>Histórico de Observações</div>
              {observations.map(obs => (
                <div key={obs.id} style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', padding: '10px 12px', marginBottom: 6 }}>
                  <div style={{ fontSize: 10, letterSpacing: 2, color: '#4caf50', marginBottom: 6, fontFamily: 'Space Mono,monospace' }}>
                    {fmtDateTime(obs.criado_em)}
                  </div>
                  <div style={{ fontSize: 13, color: '#ccc', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{obs.texto}</div>
                </div>
              ))}
            </div>
          )}

          {loadingDetail && (
            <div style={{ fontSize: 12, color: '#aaa', padding: '12px 0', textAlign: 'center', letterSpacing: 2 }}>
              Carregando histórico...
            </div>
          )}

          <div style={{ display: 'flex', gap: 6, marginTop: 14 }}>
            <Btn size="sm" variant="ghost"   full onClick={() => openEdit(selectedClient)}>✏️ Editar</Btn>
            <Btn size="sm" variant="outline" full onClick={() => { setObsText(''); setView('new_obs'); }}>💬 Observação</Btn>
            <Btn size="sm" variant="danger"  full onClick={handleDelete}>🗑️</Btn>
          </div>
        </Modal>
      )}

      {/* ── MODAL: Nova Observação ── */}
      {view === 'new_obs' && selectedClient && (
        <Modal title="Nova Observação" onClose={() => setView('detail')}>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>
            Cliente: <span style={{ color: '#fff' }}>{displayName(selectedClient)}</span>
          </div>
          <FTextarea label="Observação" value={obsText}
            onChange={e => setObsText(e.target.value)}
            placeholder="Descreva o contato, andamento da negociação..." rows={5} />
          <ModalBtns onCancel={() => setView('detail')} onSave={saveObs}
            saveLabel={savingObs ? 'Salvando...' : 'Salvar'} disabled={savingObs || !obsText.trim()} />
        </Modal>
      )}

      {/* ── MODAL: Editar Cliente (completo) ── */}
      {view === 'edit_client' && selectedClient && (
        <Modal title="Editar Cliente" onClose={() => setView('detail')}>
          <TypeToggle value={editForm.tipo} onChange={t => setEditForm(f => ({ ...f, tipo: t }))} />

          <div style={SEC}>Dados Básicos</div>

          {editForm.tipo === 'pf' ? (
            <>
              <FInput label="Nome *" value={editForm.nome}
                onChange={e => setEditForm(f => ({ ...f, nome: e.target.value }))} placeholder="João Silva" />
              <FInput label="CPF" value={editForm.cpf}
                onChange={e => setEditForm(f => ({ ...f, cpf: e.target.value }))} placeholder="000.000.000-00" />
            </>
          ) : (
            <>
              <FInput label="Nome da Empresa *" value={editForm.empresa}
                onChange={e => setEditForm(f => ({ ...f, empresa: e.target.value }))} placeholder="Empresa Ltda." />
              <FInput label="CNPJ" value={editForm.cnpj}
                onChange={e => setEditForm(f => ({ ...f, cnpj: e.target.value }))} placeholder="00.000.000/0000-00" />
              <FInput label="Nome do Contato" value={editForm.contato}
                onChange={e => setEditForm(f => ({ ...f, contato: e.target.value }))} placeholder="João Silva" />
              <FInput label="Ramo de Atividade" value={editForm.ramo}
                onChange={e => setEditForm(f => ({ ...f, ramo: e.target.value }))} placeholder="Ex: Eventos, Construção..." />
            </>
          )}

          <PhoneFields f={editForm} setF={setEditForm} />
          <FInput label="Email" type="email" value={editForm.email}
            onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} placeholder="contato@empresa.com" />

          {/* Sócios PJ */}
          {editForm.tipo === 'pj' && (
            <>
              <div style={SEC}>Sócios</div>
              {socios.map((s, i) => (
                <div key={i} style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', padding: '10px 12px', marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 11, color: '#666', letterSpacing: 2, textTransform: 'uppercase' }}>Sócio {i + 1}</span>
                    {socios.length > 1 && (
                      <button onClick={() => setSocios(prev => prev.filter((_, j) => j !== i))}
                        style={{ background: 'transparent', border: 'none', color: '#f44336', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>✕</button>
                    )}
                  </div>
                  <FInput label="Nome" value={s.nome}
                    onChange={e => setSocios(prev => prev.map((x, j) => j === i ? { ...x, nome: e.target.value } : x))}
                    placeholder="Nome completo" />
                  <FInput label="CPF" value={s.cpf}
                    onChange={e => setSocios(prev => prev.map((x, j) => j === i ? { ...x, cpf: e.target.value } : x))}
                    placeholder="000.000.000-00" />
                  <FInput label="Contato" value={s.contato}
                    onChange={e => setSocios(prev => prev.map((x, j) => j === i ? { ...x, contato: e.target.value } : x))}
                    placeholder="(00) 00000-0000" />
                </div>
              ))}
              <button onClick={() => setSocios(prev => [...prev, { nome: '', cpf: '', contato: '' }])}
                style={{ width: '100%', padding: 8, marginBottom: 12, background: 'transparent', border: '1px dashed #333', color: '#888', fontFamily: 'Space Mono,monospace', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', cursor: 'pointer' }}>
                + Adicionar Sócio
              </button>
            </>
          )}

          {/* Endereço */}
          <div style={SEC}>Endereço</div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', marginBottom: 10 }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={LABEL}>CEP</label>
              <input value={editForm.cep}
                onChange={e => setEditForm(f => ({ ...f, cep: e.target.value }))}
                placeholder="00000-000" maxLength={9} style={FIELD}
                onFocus={e => e.target.style.borderColor = '#fff'}
                onBlur={e => e.target.style.borderColor = '#333'}
              />
            </div>
            <button onClick={buscarCep} disabled={cepLoading}
              style={{ padding: '8px 14px', background: 'transparent', border: '1px solid #fff', color: cepLoading ? '#666' : '#fff', fontFamily: 'Space Mono,monospace', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', cursor: cepLoading ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
              {cepLoading ? '...' : 'Buscar'}
            </button>
          </div>
          <FInput label="Rua" value={editForm.rua}
            onChange={e => setEditForm(f => ({ ...f, rua: e.target.value }))} placeholder="Rua das Flores" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <FInput label="Número" value={editForm.numero}
              onChange={e => setEditForm(f => ({ ...f, numero: e.target.value }))} placeholder="123" />
            <FInput label="Complemento" value={editForm.complemento}
              onChange={e => setEditForm(f => ({ ...f, complemento: e.target.value }))} placeholder="Apto 4" />
          </div>
          <FInput label="Bairro" value={editForm.bairro}
            onChange={e => setEditForm(f => ({ ...f, bairro: e.target.value }))} placeholder="Centro" />
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8 }}>
            <FInput label="Cidade" value={editForm.cidade}
              onChange={e => setEditForm(f => ({ ...f, cidade: e.target.value }))} placeholder="São Paulo" />
            <FInput label="UF" value={editForm.estado}
              onChange={e => setEditForm(f => ({ ...f, estado: e.target.value.toUpperCase() }))} placeholder="SP" maxLength={2} />
          </div>

          {/* Upload documentos */}
          <div style={SEC}>Documentos</div>
          <label style={{ display: 'block', cursor: uploadingDocs ? 'wait' : 'pointer', border: '1px dashed #333', padding: '14px 16px', textAlign: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>📎</div>
            <div style={{ fontSize: 11, letterSpacing: 2, color: '#aaa', textTransform: 'uppercase' }}>
              {uploadingDocs ? 'Enviando...' : 'Toque para selecionar documentos'}
            </div>
            <div style={{ fontSize: 9, color: '#666', marginTop: 3 }}>PDF · JPG · PNG · WORD · Contrato</div>
            <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,image/*" style={{ display: 'none' }}
              onChange={e => handleDocUpload(Array.from(e.target.files))} />
          </label>

          <ModalBtns onCancel={() => setView('detail')} onSave={saveEdit} />
        </Modal>
      )}
    </div>
  );
}
