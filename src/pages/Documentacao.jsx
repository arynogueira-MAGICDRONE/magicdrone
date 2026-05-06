import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { PageHeader, Section, Empty, Btn } from '../components/layout/UI';

function pad(n) { return n < 10 ? '0' + n : n; }
function today() { const d = new Date(); return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()}`; }
function getType(name) {
  const ext = (name || '').split('.').pop().toLowerCase();
  if (ext === 'pdf') return 'pdf';
  if (['jpg','jpeg','png','gif','webp'].includes(ext)) return 'img';
  if (['doc','docx'].includes(ext)) return 'word';
  if (['xls','xlsx'].includes(ext)) return 'excel';
  return 'other';
}
function fileIcon(type) { return { pdf: '📄', img: '🖼️', word: '📝', excel: '📊' }[type] || '📎'; }

const SEL_STYLE = { width: '100%', background: '#000', border: '1px solid #333', color: '#fff', padding: '10px', fontFamily: 'Space Mono,monospace', fontSize: 14, outline: 'none' };
const STATUS_COLORS = { conf: '#4caf50', neg: '#ff9800', exec: '#555', cancelado: '#f44336' };

export default function Documentacao() {
  const { shows, docs, adminDocs, addDoc, deleteDoc } = useApp();

  const [docType, setDocType] = useState('admin');
  const [sel, setSel] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [selFile, setSelFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();

  const show = sel ? shows.find(s => String(s.id) === sel) : null;
  const list = docType === 'admin' ? (adminDocs || []) : (show ? (docs[show.id] || []) : []);

  const resetForm = () => { setShowForm(false); setFormName(''); setSelFile(null); };

  const save = async () => {
    if (!formName.trim() || !selFile) return;
    const size = selFile.size > 1048576
      ? (selFile.size / 1048576).toFixed(1) + ' MB'
      : (selFile.size / 1024).toFixed(0) + ' KB';
    setUploading(true);
    await addDoc(
      docType === 'show' && show ? show.id : null,
      { name: formName.trim(), file: selFile.name, type: getType(selFile.name), size, date: today() },
      selFile
    );
    setUploading(false);
    resetForm();
  };

  const handleDelete = async (doc) => {
    if (!window.confirm(`Excluir "${doc.name}"?`)) return;
    deleteDoc(docType === 'show' && show ? show.id : null, doc.id);
  };

  const canAdd = docType === 'admin' || (docType === 'show' && show);

  return (
    <div>
      <PageHeader label="Módulo" title="Documentação" />

      {/* Seletor de Tipo */}
      <Section title="Tipo de Documento">
        <select value={docType} onChange={e => { setDocType(e.target.value); setSel(''); resetForm(); }} style={SEL_STYLE}>
          <option value="admin">Documentos Administrativos</option>
          <option value="show">Documentos de Show</option>
        </select>

        {docType === 'show' && (
          <div style={{ marginTop: 10 }}>
            <select value={sel} onChange={e => { setSel(e.target.value); resetForm(); }} style={SEL_STYLE}>
              <option value="">Selecione um show...</option>
              {shows.map(s => <option key={s.id} value={s.id}>{s.client}</option>)}
            </select>
            {show && (
              <div style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', borderLeft: `3px solid ${STATUS_COLORS[show.status] || '#fff'}`, padding: '10px 14px', marginTop: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{show.client}</div>
                <div style={{ fontSize: 12, color: '#aaa', marginTop: 2 }}>{show.city}, {show.state}</div>
              </div>
            )}
          </div>
        )}
      </Section>

      {/* Mensagem quando aguardando seleção de show */}
      {docType === 'show' && !show && (
        <div style={{ textAlign: 'center', padding: '32px 0', color: '#333', fontSize: 12, letterSpacing: 3, textTransform: 'uppercase' }}>
          Selecione um show
        </div>
      )}

      {/* Stats e lista */}
      {(docType === 'admin' || show) && (
        <>
          {/* Stats */}
          <Section title="Resumo">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
              {[
                ['Total', list.length, '#fff'],
                ['PDF', list.filter(d => d.type === 'pdf').length, '#f44336'],
                ['Outros', list.filter(d => d.type !== 'pdf').length, '#4caf50'],
              ].map(([l, n, c]) => (
                <div key={l} style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', padding: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: c }}>{n}</div>
                  <div style={{ fontSize: 8, letterSpacing: 2, color: '#aaa', textTransform: 'uppercase', marginTop: 2 }}>{l}</div>
                </div>
              ))}
            </div>
          </Section>

          {/* Lista de documentos */}
          <Section title="Documentos Anexados" action={canAdd && <Btn size="sm" onClick={() => setShowForm(f => !f)}>+ Anexar</Btn>}>

            {/* Formulário inline */}
            {showForm && (
              <div style={{ background: '#0a0a0a', border: '1px solid #333', padding: 14, marginBottom: 10 }}>
                <div style={{ fontSize: 11, letterSpacing: 3, color: '#aaa', textTransform: 'uppercase', marginBottom: 8 }}>Novo Documento</div>
                <input
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="Nome do documento..."
                  style={{ background: '#000', border: '1px solid #333', color: '#fff', padding: '8px 10px', fontFamily: 'Space Mono,monospace', fontSize: 14, outline: 'none', width: '100%', boxSizing: 'border-box', marginBottom: 10 }}
                  onFocus={e => e.target.style.borderColor = '#fff'}
                  onBlur={e => e.target.style.borderColor = '#333'}
                />
                <div
                  onClick={() => fileRef.current.click()}
                  style={{ border: '1px dashed #333', padding: '14px 16px', textAlign: 'center', cursor: 'pointer', marginBottom: 8 }}
                >
                  <div style={{ fontSize: 20, marginBottom: 4 }}>📎</div>
                  <div style={{ fontSize: 11, letterSpacing: 2, color: '#aaa', textTransform: 'uppercase' }}>
                    {selFile ? selFile.name : 'Toque para selecionar ou tirar foto'}
                  </div>
                  <div style={{ fontSize: 8, color: '#888', marginTop: 3 }}>PDF · JPG · PNG · WORD · EXCEL</div>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,image/*"
                  capture="environment"
                  style={{ display: 'none' }}
                  onChange={e => { if (e.target.files?.[0]) setSelFile(e.target.files[0]); }}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={resetForm} style={{ flex: 1, padding: '8px', background: 'transparent', border: '1px solid #333', color: '#888', fontFamily: 'Space Mono,monospace', fontSize: 11, letterSpacing: 2, cursor: 'pointer', textTransform: 'uppercase' }}>
                    Cancelar
                  </button>
                  <button onClick={save} disabled={uploading || !formName.trim() || !selFile}
                    style={{ flex: 1, padding: '8px', background: uploading ? '#111' : '#fff', border: '1px solid #fff', color: uploading ? '#888' : '#000', fontFamily: 'Space Mono,monospace', fontSize: 11, letterSpacing: 2, cursor: uploading ? 'wait' : 'pointer', textTransform: 'uppercase' }}>
                    {uploading ? 'Enviando...' : 'Salvar'}
                  </button>
                </div>
              </div>
            )}

            {list.length === 0 ? (
              <Empty text="Nenhum documento" />
            ) : (
              list.map(doc => (
                <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#0a0a0a', border: '1px solid #1a1a1a', padding: 12, marginBottom: 4 }}>
                  <div style={{ width: 36, height: 36, background: '#111', border: '1px solid #222', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                    {fileIcon(doc.type)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{doc.name}</div>
                    <div style={{ fontSize: 11, color: '#aaa', marginTop: 1, letterSpacing: 1 }}>{doc.size} · {doc.date}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    {doc.file && doc.file.startsWith('http') && (
                      <a href={doc.file} target="_blank" rel="noopener noreferrer"
                        style={{ fontSize: 11, letterSpacing: 1, padding: '4px 8px', border: '1px solid #333', color: '#888', fontFamily: 'Space Mono,monospace', textDecoration: 'none', display: 'inline-block' }}>
                        Ver
                      </a>
                    )}
                    <button onClick={() => handleDelete(doc)}
                      style={{ background: 'transparent', border: '1px solid #333', color: '#f44336', padding: '4px 8px', fontFamily: 'Space Mono,monospace', fontSize: 14, cursor: 'pointer' }}>
                      🗑️
                    </button>
                  </div>
                </div>
              ))
            )}
          </Section>
        </>
      )}
    </div>
  );
}
