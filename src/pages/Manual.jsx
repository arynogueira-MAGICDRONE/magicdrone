import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { PageHeader, Btn, Input, Modal, ModalBtns, Empty } from '../components/layout/UI';

function pad(n) { return n < 10 ? '0' + n : n; }
function today() { const d = new Date(); return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()}`; }
function getType(name) {
  const ext = name.split('.').pop().toLowerCase();
  if (ext === 'pdf') return 'pdf';
  if (['doc','docx'].includes(ext)) return 'word';
  if (['xls','xlsx'].includes(ext)) return 'excel';
  return 'img';
}
function fileIcon(type) { return { pdf: '📄', word: '📝', excel: '📊', img: '🖼️' }[type] || '📎'; }

const ICONS = ['🚁','🛡️','🔧','📋','💻','📦','✅','🌐','⚡','🎯'];

export default function Manual() {
  const { manuals, addManualTopic, addManualFile, deleteManualFile } = useApp();
  const [search, setSearch] = useState('');
  const [openTopics, setOpenTopics] = useState({});
  const [modal, setModal] = useState(null); // 'topic' | 'file'
  const [form, setForm] = useState({});
  const [selFile, setSelFile] = useState(null);
  const [presetTopic, setPresetTopic] = useState(null);
  const fileRef = useRef();

  const toggleTopic = (id) => setOpenTopics(prev => ({ ...prev, [id]: !prev[id] }));

  const filtered = manuals.map(t => ({
    ...t,
    files: search ? t.files.filter(f => f.name.toLowerCase().includes(search.toLowerCase())) : t.files,
  })).filter(t => !search || t.files.length > 0);

  const saveTopic = () => {
    if (!form.topicName?.trim()) return;
    addManualTopic({ name: form.topicName.trim(), icon: form.icon || '📦' });
    setModal(null); setForm({});
  };

  const saveFile = () => {
    if (!form.fileName?.trim() || !selFile) return;
    const topicId = parseInt(form.topicId || presetTopic);
    const size = selFile.size > 1048576
      ? (selFile.size / 1048576).toFixed(1) + ' MB'
      : (selFile.size / 1024).toFixed(0) + ' KB';
    addManualFile(topicId, { name: form.fileName.trim(), file: selFile.name, type: getType(selFile.name), size, date: today() });
    setModal(null); setForm({}); setSelFile(null); setPresetTopic(null);
  };

  const openAddFile = (topicId) => {
    setPresetTopic(topicId);
    setForm({ topicId: topicId?.toString() || manuals[0]?.id?.toString() || '' });
    setModal('file');
  };

  return (
    <div>
      <PageHeader label="Módulo" title="Manuais"
        action={<Btn onClick={() => openAddFile(null)}>+ Arquivo</Btn>} />

      {/* Search */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #111' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar manual..."
          style={{ width: '100%', background: '#0a0a0a', border: '1px solid #222', color: '#fff', padding: '8px 12px', fontFamily: 'Space Mono,monospace', fontSize: 16, outline: 'none' }}
          onFocus={e => e.target.style.borderColor = '#fff'}
          onBlur={e => e.target.style.borderColor = '#222'} />
      </div>

      {/* Topics */}
      <div style={{ padding: '0 16px' }}>
        {filtered.map(topic => (
          <div key={topic.id} style={{ margin: '14px 0 0' }}>
            <div onClick={() => toggleTopic(topic.id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', paddingBottom: 10, borderBottom: '1px solid #1a1a1a' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 16 }}>{topic.icon}</span>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: 1 }}>{topic.name}</div>
                  <div style={{ fontSize: 14, color: '#aaa', letterSpacing: 2 }}>{topic.files.length} arquivo(s)</div>
                </div>
              </div>
              <span style={{ fontSize: 14, color: '#aaa', transform: openTopics[topic.id] ? 'rotate(90deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s' }}>▶</span>
            </div>

            {(openTopics[topic.id] || search) && (
              <div style={{ paddingTop: 6 }}>
                {topic.files.length === 0 ? <Empty text="Nenhum arquivo" /> : topic.files.map(f => (
                  <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', background: '#0a0a0a', border: '1px solid #1a1a1a', marginBottom: 4 }}>
                    <span style={{ fontSize: 18, flexShrink: 0 }}>{fileIcon(f.type)}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{f.name}</div>
                      <div style={{ fontSize: 14, color: '#aaa', marginTop: 1, letterSpacing: 1 }}>{f.file} · {f.size} · {f.date}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      <button onClick={() => alert(`Abrindo: ${f.name}`)} style={{ fontSize: 14, padding: '4px 7px', border: '1px solid #333', background: 'transparent', color: '#888', fontFamily: 'Space Mono,monospace', cursor: 'pointer' }}>Ver</button>
                      <button onClick={() => { if (window.confirm('Remover?')) deleteManualFile(topic.id, f.id); }}
                        style={{ fontSize: 14, padding: '4px 7px', border: '1px solid #333', background: 'transparent', color: '#f44336', fontFamily: 'Space Mono,monospace', cursor: 'pointer' }}>✕</button>
                    </div>
                  </div>
                ))}
                <button onClick={() => openAddFile(topic.id)} style={{
                  width: '100%', padding: 9, fontFamily: 'Space Mono,monospace', fontSize: 14,
                  letterSpacing: 2, textTransform: 'uppercase', cursor: 'pointer',
                  border: '1px dashed #222', background: 'transparent', color: '#888', marginTop: 4, marginBottom: 8,
                }}>+ Adicionar arquivo aqui</button>
              </div>
            )}
          </div>
        ))}

        <button onClick={() => { setForm({ icon: '📦' }); setModal('topic'); }} style={{
          width: '100%', padding: 10, fontFamily: 'Space Mono,monospace', fontSize: 14,
          letterSpacing: 3, textTransform: 'uppercase', cursor: 'pointer',
          border: '1px dashed #333', background: 'transparent', color: '#aaa', margin: '14px 0',
        }}>+ Novo Tópico</button>
      </div>

      {/* Add topic modal */}
      {modal === 'topic' && (
        <Modal title="Novo Tópico" onClose={() => setModal(null)}>
          <Input label="Nome do Tópico" value={form.topicName||''} onChange={e=>setForm({...form,topicName:e.target.value})} placeholder="Ex: Logística, Treinamento..." />
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 14, letterSpacing: 2, color: '#aaa', textTransform: 'uppercase', marginBottom: 6 }}>Ícone</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {ICONS.map(ic => (
                <div key={ic} onClick={() => setForm({...form, icon: ic})} style={{
                  width: 36, height: 36, border: `1px solid ${form.icon===ic?'#fff':'#333'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, cursor: 'pointer', background: form.icon===ic?'#111':'#0a0a0a',
                }}>{ic}</div>
              ))}
            </div>
          </div>
          <ModalBtns onCancel={() => setModal(null)} onSave={saveTopic} />
        </Modal>
      )}

      {/* Add file modal */}
      {modal === 'file' && (
        <Modal title="Adicionar Arquivo" onClose={() => { setModal(null); setSelFile(null); setPresetTopic(null); }}>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 14, letterSpacing: 2, color: '#aaa', textTransform: 'uppercase', marginBottom: 4 }}>Tópico</div>
            <select value={form.topicId||''} onChange={e=>setForm({...form,topicId:e.target.value})}
              style={{ width: '100%', background: '#000', border: '1px solid #333', color: '#fff', padding: '8px 10px', fontFamily: 'Space Mono,monospace', fontSize: 16, outline: 'none' }}>
              {manuals.map(t => <option key={t.id} value={t.id}>{t.icon} {t.name}</option>)}
            </select>
          </div>
          <Input label="Nome do Manual" value={form.fileName||''} onChange={e=>setForm({...form,fileName:e.target.value})} placeholder="Ex: Guia de Operação v2..." />
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 14, letterSpacing: 2, color: '#aaa', textTransform: 'uppercase', marginBottom: 4 }}>Arquivo</div>
            <div onClick={() => fileRef.current.click()} style={{ border: '1px dashed #333', padding: '18px 16px', textAlign: 'center', cursor: 'pointer' }}>
              <div style={{ fontSize: 22, marginBottom: 6 }}>📎</div>
              <div style={{ fontSize: 14, letterSpacing: 2, color: '#aaa', textTransform: 'uppercase' }}>Toque para selecionar</div>
              <div style={{ fontSize: 14, color: '#888', marginTop: 4 }}>PDF · JPG · PNG · WORD · EXCEL</div>
            </div>
            {selFile && <div style={{ fontSize: 14, color: '#4caf50', marginTop: 6 }}>✓ {selFile.name}</div>}
            <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx" style={{ display: 'none' }}
              onChange={e => { if (e.target.files?.[0]) setSelFile(e.target.files[0]); }} />
          </div>
          <ModalBtns onCancel={() => { setModal(null); setSelFile(null); setPresetTopic(null); }} onSave={saveFile} />
        </Modal>
      )}
    </div>
  );
}
