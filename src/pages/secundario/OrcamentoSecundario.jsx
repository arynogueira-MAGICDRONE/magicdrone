import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase';
import { useApp } from '../../context/AppContext';

function pad(n) { return n < 10 ? '0' + n : n; }
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}
function fmtDate(str) {
  if (!str) return '—';
  const [y, m, d] = str.split('-');
  return `${d}/${m}/${y}`;
}
function fmt(v) { return 'R$ '+(v||0).toFixed(2).replace('.',',').replace(/\B(?=(\d{3})+(?!\d))/g,'.'); }

const CATS_VISIBLE = ['Combustível', 'Pedágio', 'Hotel', 'Fogos de Artifício'];
const INP = {
  background: '#000', border: '1px solid #333', color: '#fff',
  padding: '10px 12px', fontFamily: 'Space Mono, monospace', fontSize: 15,
  outline: 'none', width: '100%', boxSizing: 'border-box',
};

export default function OrcamentoSecundario() {
  const { shows } = useApp();

  const today = todayStr();
  const confirmedShows = shows
    .filter(s => s.status === 'conf' && s.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date));

  const [sel, setSel]           = useState('');
  const [items, setItems]       = useState([]);
  const [loading, setLoading]   = useState(false);
  const [saving, setSaving]     = useState({});
  const [uploading, setUploading] = useState({});
  const [realEdits, setRealEdits] = useState({});
  const [saved, setSaved]       = useState({});

  const show = sel ? shows.find(s => String(s.id) === sel) : null;

  // Carrega itens ao selecionar show
  useEffect(() => {
    if (!sel) { setItems([]); setRealEdits({}); setSaved({}); return; }
    setLoading(true);
    supabase.from('orcamento')
      .select('id, categoria, previsto, realizado')
      .eq('show_id', sel)
      .then(({ data }) => {
        const filtered = (data || []).filter(i => CATS_VISIBLE.includes(i.categoria));
        setItems(filtered);
        const edits = {};
        filtered.forEach(i => { edits[i.id] = String(i.realizado || ''); });
        setRealEdits(edits);
        setLoading(false);
      });
  }, [sel]);

  async function salvarLancamento(item) {
    const val = parseFloat(realEdits[item.id] || '0') || 0;
    setSaving(prev => ({ ...prev, [item.id]: true }));
    const { error } = await supabase.from('orcamento')
      .update({ realizado: val })
      .eq('id', item.id);
    setSaving(prev => ({ ...prev, [item.id]: false }));
    if (!error) {
      setSaved(prev => ({ ...prev, [item.id]: true }));
      setTimeout(() => setSaved(prev => ({ ...prev, [item.id]: false })), 2000);
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, realizado: val } : i));
    } else {
      alert('Erro ao salvar: ' + error.message);
    }
  }

  async function anexarComprovante(item, file) {
    if (!file) return;
    setUploading(prev => ({ ...prev, [item.id]: true }));
    const path = `orcamento/${item.id}/${Date.now()}_${file.name}`;
    const { error: upErr } = await supabase.storage.from('comprovantes').upload(path, file);
    if (!upErr) {
      const { data: urlData } = supabase.storage.from('comprovantes').getPublicUrl(path);
      await supabase.from('comprovantes').insert({
        orcamento_id: item.id,
        url:          urlData.publicUrl,
        arquivo:      file.name,
      });
      setSaved(prev => ({ ...prev, [`comp_${item.id}`]: true }));
      setTimeout(() => setSaved(prev => ({ ...prev, [`comp_${item.id}`]: false })), 2500);
    } else {
      alert('Erro ao enviar: ' + upErr.message);
    }
    setUploading(prev => ({ ...prev, [item.id]: false }));
  }

  return (
    <div>
      {/* Header */}
      <div style={{ padding: '16px 16px 10px', borderBottom: '1px solid #111' }}>
        <div style={{ fontSize: 12, letterSpacing: 3, color: '#bbb', textTransform: 'uppercase', marginBottom: 3 }}>
          Módulo
        </div>
        <div style={{ fontSize: 26, fontWeight: 700, fontFamily: 'Bebas Neue, sans-serif', letterSpacing: 2 }}>
          Orçamento
        </div>
      </div>

      {/* Seletor de show */}
      <div style={{ padding: '14px 16px 0' }}>
        <div style={{ fontSize: 12, letterSpacing: 2, color: '#aaa', textTransform: 'uppercase', marginBottom: 6 }}>
          Selecionar Show
        </div>
        <select value={sel} onChange={e => setSel(e.target.value)} style={{ ...INP }}>
          <option value="">Selecione um show confirmado...</option>
          {confirmedShows.map(s => (
            <option key={s.id} value={s.id}>{s.client} — {fmtDate(s.date)}</option>
          ))}
        </select>
      </div>

      {!show && sel === '' && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#333', fontSize: 14, letterSpacing: 3, textTransform: 'uppercase' }}>
          Selecione um show
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: '30px', color: '#aaa', fontSize: 13, letterSpacing: 2, textTransform: 'uppercase' }}>
          Carregando...
        </div>
      )}

      {/* Show selecionado */}
      {show && !loading && (
        <div style={{ padding: '14px 16px 0' }}>
          <div style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', borderLeft: '3px solid #4caf50', padding: '12px 14px', marginBottom: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{show.client}</div>
            <div style={{ fontSize: 13, color: '#4caf50', marginTop: 2 }}>{fmtDate(show.date)}</div>
            {(show.city || show.state) && (
              <div style={{ fontSize: 13, color: '#aaa', marginTop: 2 }}>
                {[show.city, show.state].filter(Boolean).join(', ')}
              </div>
            )}
          </div>

          {items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: '#555', fontSize: 13, letterSpacing: 2, textTransform: 'uppercase' }}>
              Nenhuma despesa cadastrada para este show
            </div>
          ) : items.map(item => (
            <div key={item.id} style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', padding: 16, marginBottom: 12 }}>
              {/* Categoria */}
              <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: '#bbb', marginBottom: 12 }}>
                {item.categoria}
              </div>

              {/* Valor realizado */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, letterSpacing: 2, color: '#aaa', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                  Valor Realizado (R$)
                </label>
                <input
                  type="number"
                  value={realEdits[item.id] ?? ''}
                  onChange={e => setRealEdits(prev => ({ ...prev, [item.id]: e.target.value }))}
                  placeholder="0,00"
                  style={INP}
                  onFocus={e => e.target.style.borderColor = '#fff'}
                  onBlur={e => e.target.style.borderColor = '#333'}
                />
              </div>

              {/* Ações */}
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => salvarLancamento(item)} disabled={saving[item.id]} style={{
                  flex: 1, padding: '10px',
                  background: saved[item.id] ? '#4caf50' : '#fff',
                  color: saved[item.id] ? '#000' : '#000',
                  border: 'none', fontFamily: 'Space Mono, monospace',
                  fontSize: 13, cursor: saving[item.id] ? 'wait' : 'pointer',
                  letterSpacing: 1, textTransform: 'uppercase', fontWeight: 700,
                  transition: 'all 0.2s',
                }}>
                  {saving[item.id] ? 'Salvando...' : saved[item.id] ? '✓ Salvo' : 'Salvar'}
                </button>

                <label style={{ flex: 1, cursor: uploading[item.id] ? 'wait' : 'pointer' }}>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    capture="environment"
                    style={{ display: 'none' }}
                    onChange={e => anexarComprovante(item, e.target.files[0])}
                  />
                  <div style={{
                    padding: '10px', textAlign: 'center',
                    background: saved[`comp_${item.id}`] ? '#1a2a1a' : 'transparent',
                    border: `1px solid ${saved[`comp_${item.id}`] ? '#4caf50' : '#555'}`,
                    color: saved[`comp_${item.id}`] ? '#4caf50' : '#aaa',
                    fontFamily: 'Space Mono, monospace', fontSize: 13,
                    letterSpacing: 1, textTransform: 'uppercase',
                    transition: 'all 0.2s',
                  }}>
                    {uploading[item.id] ? 'Enviando...' : saved[`comp_${item.id}`] ? '✓ Enviado' : '📎 Comprovante'}
                  </div>
                </label>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
