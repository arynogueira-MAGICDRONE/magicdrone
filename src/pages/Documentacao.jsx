import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { PageHeader, Section, Modal, ModalBtns, Input, Empty, Btn } from '../components/layout/UI';

function pad(n) { return n < 10 ? '0' + n : n; }
function today() { const d = new Date(); return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()}`; }
function getType(name) {
  const ext = name.split('.').pop().toLowerCase();
  if (ext === 'pdf') return 'pdf';
  if (['jpg','jpeg','png'].includes(ext)) return 'img';
  if (['doc','docx'].includes(ext)) return 'word';
  if (['xls','xlsx'].includes(ext)) return 'excel';
  return 'other';
}
function fileIcon(type) {
  return { pdf: '📄', img: '🖼️', word: '📝', excel: '📊' }[type] || '📎';
}

export default function Documentacao() {
  const { shows, docs, addDoc, deleteDoc } = useApp();
  const [sel, setSel] = useState('');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ name: '' });
  const [selFile, setSelFile] = useState(null);
  const fileRef = useRef();

  const show = sel ? shows.find(s => String(s.id) === sel) : null;
  const list = show ? (docs[show.id] || []) : [];
  const statusColors = { conf: '#4caf50', neg: '#ff9800', exec: '#555' };

  const save = () => {
    if (!form.name.trim() || !selFile) return;
    const size = selFile.size > 1048576
      ? (selFile.size / 1048576).toFixed(1) + ' MB'
      : (selFile.size / 1024).toFixed(0) + ' KB';
    addDoc(show.id, { name: form.name.trim(), file: selFile.name, type: getType(selFile.name), size, date: today() });
    setModal(false); setForm({ name: '' }); setSelFile(null);
  };

  return (
    <div>
      <PageHeader label="Módulo" title="Documentação" />

      <Section title="Selecionar Show">
        <select value={sel} onChange={e => setSel(e.target.value)}
          style={{ width: '100%', background: '#000', border: '1px solid #333', color: '#fff', padding: '10px', fontFamily: 'Space Mono,monospace', fontSize: 12, outline: 'none' }}>
          <option value="">Selecione um show...</option>
          {shows.map(s => <option key={s.id} value={s.id}>{s.client}</option>)}
        </select>

        {show && (
          <div style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', borderLeft: `3px solid ${statusColors[show.status] || '#fff'}`, padding: '10px 14px', marginTop: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{show.client}</div>
            <div style={{ fontSize: 10, color: '#666', marginTop: 2 }}>{show.city}, {show.state}</div>
          </div>
        )}
      </Section>

      {!show && <div style={{ textAlign: 'center', padding: '32px 0', color: '#333', fontSize: 10, letterSpacing: 3, textTransform: 'uppercase' }}>Selecione um show</div>}

      {show && (
        <>
          <Section title="Resumo">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, marginBottom: 0 }}>
              {[['Total', list.length, '#fff'], ['PDF', list.filter(d=>d.type==='pdf').length, '#f44336'], ['Outros', list.filter(d=>d.type!=='pdf').length, '#4caf50']].map(([l,n,c]) => (
                <div key={l} style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', padding: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: c }}>{n}</div>
                  <div style={{ fontSize: 8, letterSpacing: 2, color: '#666', textTransform: 'uppercase', marginTop: 2 }}>{l}</div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Documentos Anexados" action={<Btn size="sm" onClick={() => setModal(true)}>+ Anexar</Btn>}>
            {list.length === 0 ? <Empty text="Nenhum documento" /> : list.map(doc => (
              <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#0a0a0a', border: '1px solid #1a1a1a', padding: 12, marginBottom: 4 }}>
                <div style={{ width: 36, height: 36, background: '#111', border: '1px solid #222', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{fileIcon(doc.type)}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{doc.name}</div>
                  <div style={{ fontSize: 9, color: '#666', marginTop: 1, letterSpacing: 1 }}>{doc.file} · {doc.size} · {doc.date}</div>
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <button onClick={() => alert(`Abrindo: ${doc.name}`)} style={{ fontSize: 9, letterSpacing: 1, padding: '4px 8px', border: '1px solid #333', background: 'transparent', color: '#888', fontFamily: 'Space Mono,monospace', cursor: 'pointer' }}>Ver</button>
                  <button onClick={() => { if (window.confirm('Remover?')) deleteDoc(show.id, doc.id); }}
                    style={{ fontSize: 9, padding: '4px 8px', border: '1px solid #333', background: 'transparent', color: '#f44336', fontFamily: 'Space Mono,monospace', cursor: 'pointer' }}>✕</button>
                </div>
              </div>
            ))}
          </Section>
        </>
      )}

      {modal && (
        <Modal title="Anexar Documento" onClose={() => { setModal(false); setSelFile(null); setForm({ name: '' }); }}>
          <Input label="Nome do Documento" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Ex: Autorização ANAC..." />
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, letterSpacing: 2, color: '#666', textTransform: 'uppercase', marginBottom: 4 }}>Arquivo</div>
            <div onClick={() => fileRef.current.click()} style={{ border: '1px dashed #333', padding: '18px 16px', textAlign: 'center', cursor: 'pointer' }}>
              <div style={{ fontSize: 22, marginBottom: 6 }}>📎</div>
              <div style={{ fontSize: 10, letterSpacing: 2, color: '#666', textTransform: 'uppercase' }}>Toque para selecionar</div>
              <div style={{ fontSize: 9, color: '#444', marginTop: 4 }}>PDF · JPG · PNG · WORD · EXCEL</div>
            </div>
            {selFile && <div style={{ fontSize: 10, color: '#4caf50', marginTop: 6, letterSpacing: 1 }}>✓ {selFile.name}</div>}
            <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx" style={{ display: 'none' }}
              onChange={e => { if (e.target.files?.[0]) setSelFile(e.target.files[0]); }} />
          </div>
          <ModalBtns onCancel={() => { setModal(false); setSelFile(null); setForm({ name: '' }); }} onSave={save} />
        </Modal>
      )}
    </div>
  );
}
