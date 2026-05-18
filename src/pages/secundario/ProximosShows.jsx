import React, { useState, useEffect, useCallback } from 'react';
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

export default function ProximosShows() {
  const { members, scaling, loadScaling } = useApp();

  const [shows,      setShows]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [detail,     setDetail]     = useState(null);
  const [shareText,  setShareText]  = useState('');
  const [copied,     setCopied]     = useState(false);

  const loadShows = useCallback(async () => {
    setLoading(true);
    console.log('Buscando shows...');
    const hoje = new Date().toISOString().split('T')[0];
    console.log('Data de hoje:', hoje);
    const { data, error } = await supabase
      .from('shows')
      .select('*')
      .eq('status', 'conf');
    console.log('Shows encontrados:', data);
    console.log('Erro:', error);

    if (!error && data) {
      setShows(data.map(s => ({
        id:     s.id,
        client: s.cliente,
        date:   s.data,
        city:   s.cidade,
        state:  s.estado,
        drones: s.drones,
        test:   s.data_teste,
        valor:  s.valor,
      })));
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadShows(); }, [loadShows]);

  async function openDetail(show) {
    setDetail(show);
    setShareText('');
    setCopied(false);
    if (!scaling[show.id]) await loadScaling(show.id);
  }

  function gerarTexto(show) {
    const scaled = scaling[show.id] || [];
    let text = `MAGICDRONE — Equipe Escalada\n`;
    text += `Show: ${show.client}\n`;
    text += `Data: ${fmtDate(show.date)}\n`;
    if (show.city || show.state) text += `Local: ${[show.city, show.state].filter(Boolean).join(', ')}\n`;
    text += `Drones: ${show.drones}\n`;
    text += `─────────────────────\n`;
    scaled.forEach((sc, i) => {
      const m = members.find(m => m.id === sc.memberId);
      if (!m) return;
      text += `\n${i + 1}. ${m.name}`;
      if (sc.role) text += ` — ${sc.role}`;
      text += '\n';
      if (m.tel) text += `   Tel: ${m.tel}\n`;
      if (m.cpf) text += `   CPF: ${m.cpf}\n`;
      if (m.rg)  text += `   RG: ${m.rg}\n`;
    });
    setShareText(text.trim());
  }

  async function copyText() {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      alert('Não foi possível copiar. Selecione o texto manualmente.');
    }
  }

  const scaledTeam = detail ? (scaling[detail.id] || []) : [];

  return (
    <div>
      {/* Header */}
      <div style={{ padding: '16px 16px 10px', borderBottom: '1px solid #111', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 12, letterSpacing: 3, color: '#bbb', textTransform: 'uppercase', marginBottom: 3 }}>
            Módulo
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, fontFamily: 'Bebas Neue, sans-serif', letterSpacing: 2 }}>
            Próximos Shows
          </div>
        </div>
        <button onClick={loadShows} disabled={loading} style={{
          background: 'transparent', border: '1px solid #333', color: loading ? '#444' : '#aaa',
          fontFamily: 'Space Mono, monospace', fontSize: 18,
          width: 40, height: 40, cursor: loading ? 'wait' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
          title="Recarregar">
          🔄
        </button>
      </div>

      {/* Lista */}
      <div style={{ padding: '14px 16px 0' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#aaa', fontSize: 13, letterSpacing: 3, textTransform: 'uppercase' }}>
            Carregando...
          </div>
        ) : shows.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#333', fontSize: 14, letterSpacing: 3, textTransform: 'uppercase' }}>
            Nenhum show confirmado
          </div>
        ) : shows.map(show => (
          <div key={show.id} onClick={() => openDetail(show)} style={{
            background: '#0a0a0a', border: '1px solid #1a1a1a',
            borderLeft: '3px solid #4caf50', padding: '14px 16px',
            marginBottom: 10, cursor: 'pointer',
          }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{show.client}</div>
            <div style={{ fontSize: 14, color: '#4caf50', fontWeight: 600, marginBottom: 4 }}>
              {fmtDate(show.date)}
            </div>
            {(show.city || show.state) && (
              <div style={{ fontSize: 13, color: '#aaa', marginBottom: 4 }}>
                📍 {[show.city, show.state].filter(Boolean).join(', ')}
              </div>
            )}
            <div style={{ fontSize: 13, color: '#888' }}>
              🚁 {show.drones} drones
            </div>
          </div>
        ))}
      </div>

      {/* Modal de Detalhes */}
      {detail && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)',
          zIndex: 200, overflowY: 'auto', padding: 16,
          display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: '#111', border: '1px solid #333',
            padding: 20, width: '100%', maxWidth: 440, marginTop: 40,
          }}>
            {/* Header modal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{detail.client}</div>
                <span style={{ fontSize: 11, padding: '2px 8px', border: '1px solid #4caf50', color: '#4caf50', textTransform: 'uppercase', letterSpacing: 1 }}>
                  Confirmado
                </span>
              </div>
              <button onClick={() => { setDetail(null); setShareText(''); }}
                style={{ background: 'transparent', border: 'none', color: '#888', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>
                ✕
              </button>
            </div>

            {/* Informações */}
            {[
              ['Data',   fmtDate(detail.date)],
              ['Local',  [detail.city, detail.state].filter(Boolean).join(', ') || '—'],
              ['Drones', detail.drones],
            ].map(([l, v]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #1a1a1a', fontSize: 14 }}>
                <span style={{ color: '#aaa' }}>{l}</span>
                <span style={{ fontWeight: 600 }}>{v}</span>
              </div>
            ))}

            {/* Equipe escalada */}
            {scaledTeam.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 12, letterSpacing: 2, color: '#bbb', textTransform: 'uppercase', marginBottom: 8 }}>
                  Equipe Escalada
                </div>
                {scaledTeam.map((sc, i) => {
                  const m = members.find(m => m.id === sc.memberId);
                  if (!m) return null;
                  return (
                    <div key={i} style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', padding: '10px 12px', marginBottom: 6 }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{m.name}</div>
                      {sc.role && <div style={{ fontSize: 12, color: '#aaa', marginTop: 2 }}>{sc.role}</div>}
                      {m.tel && <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>📱 {m.tel}</div>}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Gerar texto */}
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button onClick={() => gerarTexto(detail)} style={{
                padding: '12px', background: 'transparent', border: '1px solid #fff',
                color: '#fff', fontFamily: 'Space Mono, monospace', fontSize: 13,
                cursor: 'pointer', letterSpacing: 1, textTransform: 'uppercase',
              }}>
                📋 Gerar Texto para Compartilhar
              </button>

              {shareText && (
                <>
                  <div style={{
                    background: '#000', border: '1px solid #222', padding: 12,
                    fontSize: 13, lineHeight: 1.8, whiteSpace: 'pre-wrap', color: '#ccc',
                    maxHeight: 200, overflowY: 'auto',
                  }}>
                    {shareText}
                  </div>
                  <button onClick={copyText} style={{
                    padding: '12px',
                    background: copied ? '#4caf50' : 'transparent',
                    border: `1px solid ${copied ? '#4caf50' : '#aaa'}`,
                    color: copied ? '#000' : '#aaa',
                    fontFamily: 'Space Mono, monospace', fontSize: 13,
                    cursor: 'pointer', letterSpacing: 1, textTransform: 'uppercase',
                    transition: 'all 0.2s',
                  }}>
                    {copied ? '✓ Copiado!' : 'Copiar Texto'}
                  </button>
                </>
              )}

              <button onClick={() => { setDetail(null); setShareText(''); }} style={{
                padding: '10px', background: 'transparent', border: '1px solid #333',
                color: '#888', fontFamily: 'Space Mono, monospace', fontSize: 12,
                cursor: 'pointer', letterSpacing: 1, textTransform: 'uppercase',
              }}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
