import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Trash2, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { estimateWrappedWork, generateWrappedReport, getAvailableProviders } from '../services/wrappedAnalysis';

const CARD_STYLES = {
  stat: 'from-blue-500/30 to-indigo-600/30',
  topCharacter: 'from-pink-500/30 to-rose-600/30',
  archetype: 'from-purple-500/30 to-fuchsia-600/30',
  topic: 'from-amber-500/30 to-orange-600/30',
  insight: 'from-emerald-500/30 to-teal-600/30',
};

export default function WrappedModal({ isOpen, onClose }) {
  const { t } = useApp();
  const [screen, setScreen] = useState('list'); // list | configure | generating | viewing | error
  const [reports, setReports] = useState([]);
  const [activeReport, setActiveReport] = useState(null);
  const [cardIndex, setCardIndex] = useState(0);

  const [range, setRange] = useState('week');
  const [providers, setProviders] = useState([]);
  const [providerId, setProviderId] = useState(null);
  const [estimate, setEstimate] = useState(null);
  const [progress, setProgress] = useState({ step: 0, total: 0, label: '' });
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setScreen('list');
    window.electronAPI.wrappedReports.getAll().then(setReports);
  }, [isOpen]);

  useEffect(() => {
    if (screen !== 'configure') return;
    getAvailableProviders().then(list => {
      setProviders(list);
      if (!providerId && list.length > 0) setProviderId(list[0].id);
    });
  }, [screen]);

  useEffect(() => {
    if (screen !== 'configure') return;
    estimateWrappedWork(range).then(setEstimate);
  }, [screen, range]);

  async function handleGenerate() {
    setScreen('generating');
    setError('');
    setProgress({ step: 0, total: estimate?.totalCalls || 1, label: 'Preparando...' });

    const result = await generateWrappedReport({
      range,
      providerId,
      onProgress: p => setProgress(p),
    });

    if (result.success) {
      setActiveReport(result.report);
      setCardIndex(0);
      setReports(r => [result.report, ...r]);
      setScreen('viewing');
    } else {
      setError(result.error || 'Algo salió mal generando el informe.');
      setScreen('error');
    }
  }

  async function handleDelete(id) {
    await window.electronAPI.wrappedReports.delete(id);
    setReports(r => r.filter(x => x.id !== id));
  }

  function openReport(report) {
    setActiveReport(report);
    setCardIndex(0);
    setScreen('viewing');
  }

  if (!isOpen) return null;

  const cards = activeReport?.data?.cards || [];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className='absolute inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4'
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={e => e.stopPropagation()}
          className='w-full max-h-[85%] bg-card-bg rounded-3xl border border-white/10 overflow-hidden flex flex-col'
        >
          <div className='flex items-center justify-between p-4 border-b border-white/10'>
            <h3 className='flex items-center gap-2 text-white font-semibold'>
              <Sparkles size={18} className='text-accent' /> Wrapped
            </h3>
            <button onClick={onClose} className='p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white'>
              <X size={16} />
            </button>
          </div>

          <div className='flex-1 overflow-y-auto p-4'>

            {/* ---- LISTA DE INFORMES ---- */}
            {screen === 'list' && (
              <div className='space-y-3'>
                <button
                  onClick={() => setScreen('configure')}
                  className='w-full flex items-center justify-center gap-2 p-4 rounded-xl bg-accent text-white hover:bg-accent/80'
                >
                  <Sparkles size={14} /> Generar nuevo informe
                </button>

                {reports.length === 0 ? (
                  <p className='text-xs text-gray-500 text-center py-6'>
                    Todavía no has generado ningún informe. Analiza tus últimas conversaciones y descubre patrones curiosos.
                  </p>
                ) : (
                  reports.map(r => (
                    <div
                      key={r.id}
                      onClick={() => openReport(r)}
                      className='flex items-center justify-between p-3 rounded-xl border border-white/10 hover:border-white/30 cursor-pointer'
                    >
                      <div>
                        <p className='text-sm text-white font-medium'>{r.data?.period || (r.range === 'month' ? 'Último mes' : 'Última semana')}</p>
                        <p className='text-xs text-gray-500'>{new Date(r.createdAt).toLocaleDateString()} · {r.data?.totalMessages ?? '?'} mensajes</p>
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); handleDelete(r.id); }}
                        className='p-1.5 rounded-lg hover:bg-white/10 text-gray-500 hover:text-red-400'
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* ---- CONFIGURAR NUEVO INFORME ---- */}
            {screen === 'configure' && (
              <div className='space-y-4'>
                <div>
                  <p className='text-xs text-gray-500 mb-2'>Periodo a analizar</p>
                  <div className='grid grid-cols-2 gap-2'>
                    {['week', 'month'].map(r => (
                      <button
                        key={r}
                        onClick={() => setRange(r)}
                        className={`py-2.5 rounded-xl border text-sm ${range === r ? 'border-accent bg-accent/10 text-white' : 'border-white/10 text-gray-400'}`}
                      >
                        {r === 'week' ? 'Última semana' : 'Último mes'}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className='text-xs text-gray-500 mb-2'>IA que hará el análisis</p>
                  <div className='space-y-2'>
                    {providers.map(p => (
                      <button
                        key={p.id}
                        onClick={() => setProviderId(p.id)}
                        className={`w-full flex items-center justify-between p-3 rounded-xl border text-sm ${providerId === p.id ? 'border-accent bg-accent/10 text-white' : 'border-white/10 text-gray-400'}`}
                      >
                        <span>{p.label}</span>
                        {p.isPaid && (
                          <span className='text-xs px-2 py-0.5 rounded-full bg-yellow-600/30 text-yellow-300'>💰 de pago</span>
                        )}
                      </button>
                    ))}
                    {providers.length === 0 && (
                      <p className='text-xs text-gray-500'>No tienes ninguna IA configurada todavía — ve a Ajustes → IA primero.</p>
                    )}
                  </div>
                </div>

                {estimate && (
                  <div className='bg-app-bg rounded-xl p-3 border border-white/10 text-xs text-gray-400'>
                    {estimate.totalConversations === 0 ? (
                      <p>No hay conversaciones en este periodo.</p>
                    ) : (
                      <p>
                        {estimate.totalMessages} mensajes en {estimate.totalConversations} conversaciones ·
                        {' '}~{Math.max(1, Math.round(estimate.estimatedSeconds / 60))} min estimados ({estimate.totalCalls} llamadas a la IA)
                      </p>
                    )}
                  </div>
                )}

                <div className='flex gap-2'>
                  <button onClick={() => setScreen('list')} className='flex-1 py-2.5 rounded-xl text-gray-400 hover:text-white'>
                    Cancelar
                  </button>
                  <button
                    onClick={handleGenerate}
                    disabled={!providerId || !estimate || estimate.totalConversations === 0}
                    className='flex-1 py-2.5 rounded-xl bg-accent text-white disabled:opacity-40'
                  >
                    Generar
                  </button>
                </div>
              </div>
            )}

            {/* ---- PROGRESO ---- */}
            {screen === 'generating' && (
              <div className='flex flex-col items-center justify-center py-10 gap-4'>
                <Loader2 size={28} className='text-accent animate-spin' />
                <p className='text-sm text-white text-center'>{progress.label}</p>
                <div className='w-full bg-app-bg rounded-full h-2 overflow-hidden'>
                  <div
                    className='bg-accent h-full transition-all duration-300'
                    style={{ width: `${progress.total ? (progress.step / progress.total) * 100 : 0}%` }}
                  />
                </div>
                <p className='text-xs text-gray-500'>{progress.step} / {progress.total}</p>
              </div>
            )}

            {/* ---- ERROR ---- */}
            {screen === 'error' && (
              <div className='flex flex-col items-center gap-3 py-10 text-center'>
                <p className='text-sm text-red-400'>{error}</p>
                <button onClick={() => setScreen('configure')} className='text-sm text-accent hover:underline'>
                  Volver a intentar
                </button>
              </div>
            )}

            {/* ---- TARJETAS (VISOR) ---- */}
            {screen === 'viewing' && cards.length > 0 && (
              <div className='flex flex-col items-center gap-4'>
                <div className={`w-full aspect-[3/4] rounded-2xl bg-gradient-to-br ${CARD_STYLES[cards[cardIndex].type] || CARD_STYLES.stat} border border-white/10 flex flex-col items-center justify-center text-center p-6`}>
                  <span className='text-4xl mb-3'>{cards[cardIndex].emoji}</span>
                  <p className='text-xs uppercase tracking-wide text-white/60 mb-2'>{cards[cardIndex].title}</p>
                  <p className='text-2xl font-bold text-white mb-3'>{cards[cardIndex].value}</p>
                  {cards[cardIndex].detail && (
                    <p className='text-sm text-white/70'>{cards[cardIndex].detail}</p>
                  )}
                </div>

                <div className='flex items-center gap-4'>
                  <button
                    onClick={() => setCardIndex(i => Math.max(0, i - 1))}
                    disabled={cardIndex === 0}
                    className='p-2 rounded-full hover:bg-white/10 text-gray-400 disabled:opacity-30'
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <div className='flex gap-1.5'>
                    {cards.map((_, i) => (
                      <span key={i} className={`w-1.5 h-1.5 rounded-full ${i === cardIndex ? 'bg-accent' : 'bg-white/20'}`} />
                    ))}
                  </div>
                  <button
                    onClick={() => setCardIndex(i => Math.min(cards.length - 1, i + 1))}
                    disabled={cardIndex === cards.length - 1}
                    className='p-2 rounded-full hover:bg-white/10 text-gray-400 disabled:opacity-30'
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>

                <button onClick={() => setScreen('list')} className='text-xs text-gray-500 hover:text-white'>
                  ← Volver a mis informes
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
