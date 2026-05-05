import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { supabase } from '../supabase';
import { PageHeader, Btn, Input, Modal, ModalBtns, Section, Toggle, Avatar, Empty } from '../components/layout/UI';

const PERM_LABELS = {
  inventario: 'Cadastrar/editar equipamentos',
  agenda: 'Alterar agenda',
  checklist: 'Preencher checklist',
  equipe: 'Gerenciar equipe',
  orcamento: 'Ver/editar orçamento',
  documentacao: 'Acessar documentação',
  manual: 'Acessar manuais',
};

export default function Equipe() {
  const { isMaster } = useAuth();
  const { members, addMember, updateMemberPerms, deleteMember, updateMember, shows, scaling, scaleToShow, removeFromShow, isMemberBusy } = useApp();

  const [tab, setTab] = useState('membros');
  const [modal, setModal] = useState(null);
  const [detail, setDetail] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [selectedShow, setSelectedShow] = useState('');
  const [scaleModal, setScaleModal] = useState(null);
  const [form, setForm] = useState({});
  const [shareText, setShareText] = useState(null);

  const tabs = [
    { key: 'membros', label: 'Membros' },
    { key: 'escalar', label: 'Escalar' },
    ...(isMaster() ? [{ key: 'permissoes', label: 'Permissões' }] : []),
  ];

  const openEdit = (m) => {
    setEditingId(m.id);
    setForm({
      name: m.name, cpf: m.cpf, rg: m.rg, email: m.email,
      tel: m.tel, sarpas: m.sarpas, senha: '',
      ...Object.fromEntries(Object.keys(PERM_LABELS).map(k => [`perm_${k}`, m.perms?.[k] || false]))
    });
    setDetail(null);
    setModal('add');
  };

  const saveMember = async () => {
    if (!form.name?.trim()) return;
    if (!form.email?.trim()) { alert('Informe o email.'); return; }
    const perms = Object.fromEntries(Object.keys(PERM_LABELS).map(k => [k, form[`perm_${k}`] || false]));

    if (editingId) {
      // Editando membro existente
      await supabase.from('membros').update({
        nome: form.name, cpf: form.cpf, rg: form.rg,
        email: form.email, telefone: form.tel, sarpas: form.sarpas, permissoes: perms
      }).eq('id', editingId);

      // Atualiza usuário também
      const updateData = { nome: form.name, email: form.email, permissoes: perms };
      if (form.senha?.trim()) updateData.senha = form.senha;
      await supabase.from('usuarios').update(updateData).eq('email', form.email);

      updateMember(editingId, { name: form.name, cpf: form.cpf, rg: form.rg, email: form.email, tel: form.tel, sarpas: form.sarpas, perms });
    } else {
      // Novo membro
      if (!form.senha?.trim()) { alert('Informe a senha.'); return; }
      await supabase.from('usuarios').insert({
        nome: form.name, email: form.email, senha: form.senha,
        perfil: 'secundario', permissoes: perms
      });
      addMember({ name: form.name, cpf: form.cpf||'', rg: form.rg||'', email: form.email||'', tel: form.tel||'', sarpas: form.sarpas||'', perms });
    }

    setModal(null); setForm({}); setEditingId(null);
  };

  const handleDeleteMember = async (m) => {
    if (!window.confirm(`Remover ${m.name}?`)) return;
    await supabase.from('usuarios').delete().eq('email', m.email);
    deleteMember(m.id);
    setDetail(null);
  };

  const confirmScale = () => {
    if (!scaleModal) return;
    scaleToShow(scaleModal.showId, scaleModal.memberId, scaleModal.role || '—');
    setScaleModal(null);
  };

  const generateShareText = (showId) => {
    const show = shows.find(s => s.id === showId);
    const scaled = scaling[showId] || [];
    if (!show || !scaled.length) return;
    let text = `MAGICDRONE — Equipe Escalada\nShow: ${show.client}\n─────────────────────\n`;
    scaled.forEach((sc, i) => {
      const m = members.find(m => m.id === sc.memberId);
      if (!m) return;
      text += `\n${i+1}. ${m.name}\n   Telefone: ${m.tel}\n   CPF: ${m.cpf}\n   RG: ${m.rg}\n`;
    });
    text += `\n─────────────────────`;
    setShareText(text);
  };

  const showId = selectedShow || null;
  const currentScaled = showId ? (scaling[showId] || []) : [];
  const availableMembers = showId ? members.filter(m => !currentScaled.some(sc => sc.memberId === m.id)) : [];

  return (
    <div>
      <PageHeader label="Módulo" title="Equipe"
        action={isMaster() && <Btn onClick={() => { setForm({}); setEditingId(null); setModal('add'); }}>+ Membro</Btn>} />

      <div style={{ display: 'flex', borderBottom: '1px solid #222' }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            flex: 1, padding: '10px 4px', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase',
            textAlign: 'center', cursor: 'pointer', fontFamily: 'Space Mono,monospace',
            color: tab === t.key ? '#fff' : '#555',
            borderBottom: `2px solid ${tab === t.key ? '#fff' : 'transparent'}`,
            background: 'transparent', border: 'none',
          }}>{t.label}</button>
        ))}
      </div>

      {tab === 'membros' && (
        <Section title={`${members.length} membro(s)`}>
          {members.length === 0 ? <Empty text="Nenhum membro" /> : members.map(m => (
            <div key={m.id} onClick={() => setDetail(m)} style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', padding: 12, marginBottom: 6, cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Avatar name={m.name} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{m.name}</div>
                  <div style={{ fontSize: 10, color: '#666', marginTop: 1 }}>{m.email}</div>
                </div>
              </div>
              {m.sarpas && (
                <div style={{ marginTop: 6 }}>
                  <span style={{ fontSize: 8, letterSpacing: 1, padding: '2px 7px', border: '1px solid #4caf50', color: '#4caf50', textTransform: 'uppercase' }}>
                    Sarpas: {m.sarpas}
                  </span>
                </div>
              )}
            </div>
          ))}
        </Section>
      )}

      {tab === 'escalar' && (
        <Section title="Escalar para Show">
          <select value={selectedShow} onChange={e => setSelectedShow(e.target.value)}
            style={{ width: '100%', background: '#000', border: '1px solid #333', color: '#fff', padding: '8px 10px', fontFamily: 'Space Mono,monospace', fontSize: 12, outline: 'none', marginBottom: 14 }}>
            <option value="">Selecionar show...</option>
            {shows.map(s => <option key={s.id} value={s.id}>{s.client}</option>)}
          </select>
          {showId && (
            <>
              <div style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', padding: 12, marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 6 }}>Equipe Escalada</div>
                {currentScaled.length === 0 ? <div style={{ fontSize: 10, color: '#555' }}>Nenhum membro escalado</div> : currentScaled.map((sc, i) => {
                  const m = members.find(m => m.id === sc.memberId);
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 8px', background: '#111', border: '1px solid #222', marginBottom: 3 }}>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600 }}>{m?.name}</div>
                        <div style={{ fontSize: 10, color: '#888', fontStyle: 'italic' }}>{sc.role}</div>
                      </div>
                      <span onClick={() => removeFromShow(showId, i)} style={{ fontSize: 10, color: '#f44336', cursor: 'pointer', padding: '0 4px' }}>✕</span>
                    </div>
                  );
                })}
                {currentScaled.length > 0 && (
                  <button onClick={() => generateShareText(showId)} style={{
                    width: '100%', padding: 8, marginTop: 8, fontFamily: 'Space Mono,monospace',
                    fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', cursor: 'pointer',
                    border: '1px solid #4caf50', background: 'transparent', color: '#4caf50',
                  }}>Gerar Texto para Compartilhar</button>
                )}
              </div>
              <div style={{ fontSize: 9, letterSpacing: 4, color: '#888', textTransform: 'uppercase', marginBottom: 8 }}>Adicionar à Equipe</div>
              {availableMembers.map(m => {
                const busy = isMemberBusy(m.id, showId);
                return (
                  <div key={m.id} onClick={() => setScaleModal({ showId, memberId: m.id, role: '' })}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, background: '#0a0a0a', border: '1px solid #1a1a1a', marginBottom: 4, cursor: 'pointer' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: busy ? '#f44336' : '#4caf50' }} />
                    <Avatar name={m.name} size={28} />
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{m.name}</div>
                      <div style={{ fontSize: 9, color: busy ? '#f44336' : '#4caf50', letterSpacing: 1 }}>{busy ? 'Ocupado em outro show' : 'Disponível'}</div>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </Section>
      )}

      {tab === 'permissoes' && isMaster() && (
        <Section title="Permissões">
          {members.map(m => (
            <div key={m.id} style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', padding: 12, marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Avatar name={m.name} size={28} />
                <div style={{ fontSize: 12, fontWeight: 700 }}>{m.name}</div>
              </div>
              {Object.keys(PERM_LABELS).map(k => (
                <div key={k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 0' }}>
                  <div style={{ fontSize: 10, color: '#888' }}>{PERM_LABELS[k]}</div>
                  <Toggle on={m.perms?.[k]} onClick={() => updateMemberPerms(m.id, { ...m.perms, [k]: !m.perms?.[k] })} />
                </div>
              ))}
            </div>
          ))}
        </Section>
      )}

      {modal === 'add' && (
        <Modal title={editingId ? 'Editar Membro' : 'Novo Membro'} onClose={() => { setModal(null); setEditingId(null); }}>
          <Input label="Nome completo" value={form.name||''} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Nome Sobrenome" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Input label="CPF" value={form.cpf||''} onChange={e=>setForm({...form,cpf:e.target.value})} placeholder="000.000.000-00" />
            <Input label="RG" value={form.rg||''} onChange={e=>setForm({...form,rg:e.target.value})} placeholder="00.000.000-0" />
          </div>
          <Input label="Email" type="email" value={form.email||''} onChange={e=>setForm({...form,email:e.target.value})} placeholder="email@exemplo.com" />
          <Input label="Telefone" value={form.tel||''} onChange={e=>setForm({...form,tel:e.target.value})} placeholder="(00) 00000-0000" />
          <Input label="Código Sarpas (opcional)" value={form.sarpas||''} onChange={e=>setForm({...form,sarpas:e.target.value})} placeholder="BR-2024-XXX" />
          <Input label={editingId ? 'Nova Senha (deixe vazio para manter)' : 'Senha de Acesso'} type="password" value={form.senha||''} onChange={e=>setForm({...form,senha:e.target.value})} placeholder="Senha para login" />
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #222' }}>
            <div style={{ fontSize: 9, letterSpacing: 3, color: '#666', textTransform: 'uppercase', marginBottom: 8 }}>Permissões</div>
            {Object.keys(PERM_LABELS).map(k => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 0' }}>
                <div style={{ fontSize: 10, color: '#888' }}>{PERM_LABELS[k]}</div>
                <Toggle on={form[`perm_${k}`]} onClick={() => setForm(f => ({...f, [`perm_${k}`]: !f[`perm_${k}`]}))} />
              </div>
            ))}
          </div>
          <ModalBtns onCancel={() => { setModal(null); setEditingId(null); }} onSave={saveMember} saveLabel={editingId ? 'Salvar' : 'Cadastrar'} />
        </Modal>
      )}

      {detail && (
        <Modal title="Detalhes do Membro" onClose={() => setDetail(null)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <Avatar name={detail.name} size={44} />
            <div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{detail.name}</div>
              {detail.sarpas && <div style={{ fontSize: 10, color: '#4caf50' }}>Sarpas: {detail.sarpas}</div>}
            </div>
          </div>
          {[['CPF', detail.cpf], ['RG', detail.rg], ['Email', detail.email], ['Telefone', detail.tel]].map(([l, v]) => (
            <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #111', fontSize: 12 }}>
              <span style={{ color: '#666' }}>{l}</span><span>{v || '—'}</span>
            </div>
          ))}
          <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
            <Btn full variant="ghost" onClick={() => setDetail(null)}>Fechar</Btn>
            {isMaster() && <Btn full variant="outline" onClick={() => openEdit(detail)}>Editar</Btn>}
            {isMaster() && <Btn full variant="danger" onClick={() => handleDeleteMember(detail)}>Remover</Btn>}
          </div>
        </Modal>
      )}

      {scaleModal && (
        <Modal title="Escalar Membro" onClose={() => setScaleModal(null)}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{members.find(m => m.id === scaleModal.memberId)?.name}</div>
          <div style={{ fontSize: 10, color: '#888', marginBottom: 12 }}>{shows.find(s => s.id === scaleModal.showId)?.client}</div>
          <Input label="Função no Show" value={scaleModal.role} onChange={e => setScaleModal({...scaleModal, role: e.target.value})} placeholder="Ex: Piloto, Técnico, Segurança..." />
          <ModalBtns onCancel={() => setScaleModal(null)} onSave={confirmScale} saveLabel="Escalar" />
        </Modal>
      )}

      {shareText && (
        <Modal title="Texto para Compartilhar" onClose={() => setShareText(null)}>
          <div style={{ background: '#000', border: '1px solid #333', padding: 12, fontSize: 11, lineHeight: 1.8, whiteSpace: 'pre-wrap', marginBottom: 10, color: '#ccc', maxHeight: 300, overflowY: 'auto' }}>
            {shareText}
          </div>
          <button onClick={() => { navigator.clipboard?.writeText(shareText); alert('Copiado!'); }}
            style={{ width: '100%', padding: 9, fontFamily: 'Space Mono,monospace', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', cursor: 'pointer', border: '1px solid #fff', background: '#fff', color: '#000' }}>
            Copiar Texto
          </button>
          <div style={{ marginTop: 8 }}>
            <Btn full variant="ghost" onClick={() => setShareText(null)}>Fechar</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}