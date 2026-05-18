import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase';

function fmtDate(str) {
  if (!str) return '—';
  const [y, m, d] = str.split('-');
  return `${d}/${m}/${y}`;
}

const INP = {
  background: '#000', border: '1px solid #333', color: '#fff',
  padding: '10px 12px', fontFamily: 'Space Mono, monospace', fontSize: 15,
  outline: 'none', width: '100%', boxSizing: 'border-box',
};

export default function OrcamentoSecundario() {
  const [shows,        setShows]        = useState([]);
  const [loadingShows, setLoadingShows] = useState(true);
  const [sel,          setSel]          = useState('');
  const [groups,       setGroups]       = useState([]); // [{cat, items:[{id, realizado}]}]
  const [loading,      setLoading]      = useState(false);
  const [realEdits,    setRealEdits]    = useState({});  // {itemId: string}
  const [saving,       setSaving]       = useState({});
  const [uploading,    setUploading]    = useState({});
  const [saved,        setSaved]        = useState({});
  const [adding,       setAdding]       = useState({});  // {cat: bool} — loading new item

  // Carrega shows confirmados
  useEffect(() => {
    setLoadingShows(true);
    supabase
      .from('shows')
      .select('id, cliente, data, cidade, estado, drones')
      .eq('status', 'conf')
      .order('data', { ascending: true })
      .then(({ data, error }) => {
        if (!error && data) setShows(data);
        setLoadingShows(false);
      });
  }, []);

  const show = sel ? shows.find(s => String(s.id) === sel) : null;

  // Carrega itens visíveis ao selecionar show
  useEffect(() => {
    if (!sel) { setGroups([]); setRealEdits({}); return; }
    setLoading(true);
    supabase
      .from('orcamento')
      .select('id, categoria, realizado, visivel_secundario')
      .eq('show_id', sel)
      .then(({ data }) => {
        // Filtra itens visíveis para o secundário (visivel_secundario = true OU null)
        const visible = (data || []).filter(i => i.visivel_secundario !== false);

        // Agrupa por categoria
        const catMap = {};
        visible.forEach(i => {
          if (!catMap[i.categoria]) catMap[i.categoria] = [];
          catMap[i.categoria].push({ id: i.id, realizado: i.realizado || 0 });
        });

        const grps = Object.entries(catMap).map(([cat, items]) => ({ cat, items }));
        setGroups(grps);

        // Inicializa edits
        const edits = {};
        visible.forEach(i => { edits[i.id] = String(i.realizado || ''); });
        setRealEdits(edits);
        setLoading(false);
      });
  }, [sel]);

  async function salvar(itemId) {
    const val = parseFloat(realEdits[itemId] || '0') || 0;
    setSaving(prev => ({ ...prev, [itemId]: true }));
    const { error } = await supabase.from('orcamento').update({ realizado: val }).eq('id', itemId);
    setSaving(prev => ({ ...prev, [itemId]: false }));
    if (!error) {
      setSaved(prev => ({ ...prev, [itemId]: true }));
      setTimeout(() => setSaved(prev => ({ ...prev, [itemId]: false })), 2000);
      setGroups(prev => prev.map(g => ({
        ...g,
        items: g.items.map(i => i.id === itemId ? { ...i, realizado: val } : i),
      })));
    } else {
      alert('Erro ao salvar: ' + error.message);
    }
  }

  async function anexar(itemId, file) {
    if (!file) return;
    setUploading(prev => ({ ...prev, [itemId]: true }));
    const path = `orcamento/${itemId}/${Date.now()}_${file.name}`;
    const { error: upErr } = await supabase.storage.from('comprovantes').upload(path, file);
    if (!upErr) {
      const { data: urlData } = supabase.storage.from('comprovantes').getPublicUrl(path);
      await supabase.from('comprovantes').insert({ orcamento_id: itemId, url: urlData.publicUrl, arquivo: file.name });
      setSaved(prev => ({ ...prev, [`comp_${itemId}`]: true }));
      setTimeout(() => setSaved(prev => ({ ...prev, [`comp_${itemId}`]: false })), 2500);
    } else {
      alert('Erro ao enviar: ' + upErr.message);
    }
    setUploading(prev => ({ ...prev, [itemId]: false }));
  }

  async function adicionarLancamento(cat) {
    if (!sel) return;
    setAdding(prev => ({ ...prev, [cat]: true }));
    const { data, error } = await supabase
      .from('orcamento')
      .insert({ show_id: sel, categoria: cat, previsto: 0, realizado: 0, visivel_secundario: true })
      .select('id, categoria, realizado')
      .single();
    setAdding(prev => ({ ...prev, [cat]: false }));
    if (!error && data) {
      setRealEdits(prev => ({ ...prev, [data.id]: '' }));
      setGroups(prev => prev.map(g =>
        g.cat === cat ? { ...g, items: [...g.items, { id: data.id, realizado: 0 }] } : g
      ));
    } else if (error) {
      alert('Erro ao adicionar: ' + error.message);
    }
  }

  return (
    <div>
      {/* Header */}
      <div style={{ padding: '16px 16px 10px', borderBottom: '1px solid #111' }}>
        <div style={{ fontSize: 12, letterSpacing: 3, color: '#bbb', textTransform: 'uppercase', marginBottom: 3 }}>Módulo</div>
        <div style={{ fontSize: 26, fontWeight: 700, fontFamily: 'Bebas Neue, sans-serif', letterSpacing: 2 }}>Orçamento</div>
      </div>

      {/* Seletor */}
      <div style={{ padding: '14px 16px 0' }}>
        <div style={{ fontSize: 12, letterSpacing: 2, color: '#aaa', textTransform: 'uppercase', marginBottom: 6 }}>Selecionar Show</div>
        {loadingShows ? (
          <div style={{ padding: '10px 0', color: '#555', fontSize: 13, letterSpacing: 2, textTransform: 'uppercase' }}>Carregando shows...</div>
        ) : (
          <select value={sel} onChange={e => setSel(e.target.value)} style={{ ...INP }}>
            <option value="">Selecione um show confirmado...</option>
            {shows.map(s => (
              <option key={s.id} value={String(s.id)}>{s.cliente} — {fmtDate(s.data)}</option>
            ))}
          </select>
        )}

        {!show && !loadingShows && sel === '' && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#333', fontSize: 14, letterSpacing: 3, textTransform: 'uppercase' }}>
            Selecione um show
          </div>
        )}

        {loading && (
          <div style={{ textAlign: 'center', padding: '30px', color: '#aaa', fontSize: 13, letterSpacing: 2, textTransform: 'uppercase' }}>Carregando...</div>
        )}

        {show && !loading && (
          <>
            {/* Card do show */}
            <div style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', borderLeft: '3px solid #4caf50', padding: '12px 14px', margin: '14px 0' }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{show.cliente}</div>
              <div style={{ fontSize: 13, color: '#4caf50', marginTop: 2 }}>{fmtDate(show.data)}</div>
              {(show.cidade || show.estado) && (
                <div style={{ fontSize: 13, color: '#aaa', marginTop: 2 }}>{[show.cidade, show.estado].filter(Boolean).join(', ')}</div>
              )}
            </div>

            {groups.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: '#555', fontSize: 13, letterSpacing: 2, textTransform: 'uppercase' }}>
                Nenhuma despesa disponível para este show
              </div>
            ) : groups.map(({ cat, items }) => (
              <div key={cat} style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', marginBottom: 14 }}>
                {/* Cabeçalho da categoria */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderBottom: '1px solid #111' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#bbb' }}>{cat}</div>
                  <button onClick={() => adicionarLancamento(cat)} disabled={adding[cat]} style={{
                    width: 32, height: 32, background: 'transparent', border: '1px solid #4caf50',
                    color: '#4caf50', fontSize: 20, cursor: adding[cat] ? 'wait' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>+</button>
                </div>

                {/* Lançamentos */}
                <div style={{ padding: '10px 14px' }}>
                  {items.map((item, idx) => (
                    <div key={item.id} style={{ marginBottom: idx < items.length - 1 ? 14 : 0, paddingBottom: idx < items.length - 1 ? 14 : 0, borderBottom: idx < items.length - 1 ? '1px solid #111' : 'none' }}>
                      <div style={{ fontSize: 12, color: '#555', marginBottom: 6, letterSpacing: 1 }}>Lançamento #{idx + 1}</div>

                      <div style={{ marginBottom: 8 }}>
                        <label style={{ fontSize: 12, letterSpacing: 2, color: '#aaa', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>
                          Valor Realizado (R$)
                        </label>
                        <input type="number" value={realEdits[item.id] ?? ''}
                          onChange={e => setRealEdits(prev => ({ ...prev, [item.id]: e.target.value }))}
                          placeholder="0,00" style={INP}
                          onFocus={e => e.target.style.borderColor = '#fff'}
                          onBlur={e  => e.target.style.borderColor = '#333'}
                        />
                      </div>

                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => salvar(item.id)} disabled={saving[item.id]} style={{
                          flex: 1, padding: '10px',
                          background: saved[item.id] ? '#4caf50' : '#fff',
                          color: '#000', border: 'none',
                          fontFamily: 'Space Mono, monospace', fontSize: 13,
                          cursor: saving[item.id] ? 'wait' : 'pointer',
                          letterSpacing: 1, textTransform: 'uppercase', fontWeight: 700,
                          transition: 'all 0.2s',
                        }}>
                          {saving[item.id] ? 'Salvando...' : saved[item.id] ? '✓ Salvo' : 'Salvar'}
                        </button>

                        <label style={{ flex: 1, cursor: uploading[item.id] ? 'wait' : 'pointer' }}>
                          <input type="file" accept="image/*,application/pdf" capture="environment"
                            style={{ display: 'none' }}
                            onChange={e => anexar(item.id, e.target.files[0])} />
                          <div style={{
                            padding: '10px', textAlign: 'center',
                            background: saved[`comp_${item.id}`] ? '#1a2a1a' : 'transparent',
                            border: `1px solid ${saved[`comp_${item.id}`] ? '#4caf50' : '#555'}`,
                            color: saved[`comp_${item.id}`] ? '#4caf50' : '#aaa',
                            fontFamily: 'Space Mono, monospace', fontSize: 13,
                            letterSpacing: 1, textTransform: 'uppercase', transition: 'all 0.2s',
                          }}>
                            {uploading[item.id] ? 'Enviando...' : saved[`comp_${item.id}`] ? '✓ Enviado' : '📎 Foto'}
                          </div>
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
