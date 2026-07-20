import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Brain, Plus, Trash2, Pencil, Check, RefreshCw, Loader2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { generateMemories } from '../services/memoryAnalysis';

const MEMORY_CHAR_LIMIT = 4000;
const CATEGORIES = ['user', 'character', 'both'];

export default function MemoryPanel({ isOpen, onClose, conversationId, character, messages }) {
  const { t } = useApp();
  const [memories, setMemories] = useState([]);
  const [autoEnabled, setAutoEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  const [adding, setAdding] = useState(false);
  const [newCategory, setNewCategory] = useState('both');
  const [newText, setNewText] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    Promise.all([
      window.electronAPI.conversations.getMemories(conversationId),
      window.electronAPI.settings.get(),
    ]).then(([mems, settings]) => {
      setMemories(mems);
      setAutoEnabled(settings.autoMemoryEnabled !== false);
      setLoading(false);
    });
  }, [isOpen, conversationId]);

  const totalChars = memories.reduce((sum, m) => sum + m.text.length, 0);
  const usagePercent = Math.min(100, Math.round((totalChars / MEMORY_CHAR_LIMIT) * 100));

  async function toggleAuto() {
    const next = !autoEnabled;
    setAutoEnabled(next);
    await window.electronAPI.settings.update({ autoMemoryEnabled: next });
  }

  async function handleGenerateNow() {
    setGenerating(true);
    setError('');
    const result = await generateMemories({ conversationId, character, messages });
    setGenerating(false);
    if (result.success) {
      const fresh = await window.electronAPI.conversations.getMemories(conversationId);
      setMemories(fresh);
    } else {
      setError(result.error || t('memory.generateError'));
    }
  }

  async function handleAddManual() {
    if (!newText.trim()) return;
    const saved = await window.electronAPI.conversations.addMemory(conversationId, {
      category: newCategory,
      text: newText.trim(),
      auto: false,
    });
    setMemories(m => [...m, saved]);
    setNewText('');
    setAdding(false);
  }

  async function handleSaveEdit(id) {
    if (!editDraft.trim()) return;
    await window.electronAPI.conversations.updateMemory(conversationId, id, { text: editDraft.trim() });
    setMemories(m => m.map(x => (x.id === id ? { ...x, text: editDraft.trim() } : x)));
    setEditingId(null);
  }

  async function handleDelete(id) {
    await window.electronAPI.conversations.deleteMemory(conversationId, id);
    setMemories(m => m.filter(x => x.id !== id));
  }

  if (!isOpen) return null;

  const categoryLabels = {
    user: t('memory.aboutUser'),
    character: t('memory.aboutCharacter'),
    both: t('memory.aboutBoth'),
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className='absolute inset-0 z-50 bg-black/80 flex items-end'
        onClick={onClose}
      >
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          onClick={e => e.stopPropagation()}
          className='w-full bg-card-bg rounded-t-3xl border-t border-white/10 p-4 max-h-[85%] overflow-y-auto'
        >
          <div className='flex items-center justify-between mb-3'>
            <h3 className='flex items-center gap-2 text-white font-semibold'>
              <Brain size={18} className='text-accent' />
              {t('memory.title')}
            </h3>
            <button onClick={onClose} className='p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white'>
              <X size={16} />
            </button>
          </div>

          {loading ? (
            <p className='text-sm text-gray-500 py-6 text-center'>{t('appearance.loading')}</p>
          ) : (
            <>
              {/* Barra de uso */}
              <div className='mb-4'>
                <div className='flex items-center justify-between text-xs text-gray-500 mb-1'>
                  <span>{t('memory.usage')}</span>
                  <span>{usagePercent}%</span>
                </div>
                <div className='w-full bg-app-bg rounded-full h-1.5 overflow-hidden'>
                  <div
                    className={`h-full transition-all ${usagePercent >= 90 ? 'bg-yellow-500' : 'bg-accent'}`}
                    style={{ width: `${usagePercent}%` }}
                  />
                </div>
              </div>

              {/* Interruptor de generación automática + botón manual */}
              <div className='flex items-center justify-between bg-app-bg rounded-xl p-3 border border-white/10 mb-4'>
                <div>
                  <p className='text-sm text-white'>{t('memory.autoToggle')}</p>
                  <p className='text-xs text-gray-500'>{t('memory.autoToggleSubtitle')}</p>
                </div>
                <button
                  onClick={toggleAuto}
                  className={`w-11 h-6 rounded-full flex-shrink-0 transition-colors relative ${autoEnabled ? 'bg-accent' : 'bg-gray-700'}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${autoEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>

              <button
                onClick={handleGenerateNow}
                disabled={generating}
                className='w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-accent/10 border border-accent/30 text-accent hover:bg-accent/20 disabled:opacity-50 mb-4 text-sm'
              >
                {generating ? <Loader2 size={14} className='animate-spin' /> : <RefreshCw size={14} />}
                {generating ? t('memory.generating') : t('memory.generateNow')}
              </button>

              {error && <p className='text-xs text-red-400 mb-3'>{error}</p>}

              {/* Lista agrupada por categoría */}
              {memories.length === 0 ? (
                <p className='text-xs text-gray-500 text-center py-6'>{t('memory.emptyState')}</p>
              ) : (
                CATEGORIES.map(cat => {
                  const items = memories.filter(m => m.category === cat);
                  if (items.length === 0) return null;
                  return (
                    <div key={cat} className='mb-4'>
                      <p className='text-xs uppercase tracking-wide text-gray-600 mb-2'>{categoryLabels[cat]}</p>
                      <div className='space-y-2'>
                        {items.map(m => (
                          <div key={m.id} className='bg-app-bg rounded-xl p-3 border border-white/10'>
                            {editingId === m.id ? (
                              <div className='flex flex-col gap-2'>
                                <textarea
                                  autoFocus
                                  value={editDraft}
                                  onChange={e => setEditDraft(e.target.value)}
                                  rows={2}
                                  className='w-full bg-card-bg text-white text-sm rounded-lg p-2 outline-none resize-none'
                                />
                                <div className='flex justify-end gap-2'>
                                  <button onClick={() => setEditingId(null)} className='p-1.5 rounded-lg hover:bg-white/10 text-gray-400'>
                                    <X size={13} />
                                  </button>
                                  <button onClick={() => handleSaveEdit(m.id)} className='p-1.5 rounded-lg hover:bg-white/10 text-green-400'>
                                    <Check size={13} />
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className='flex items-start justify-between gap-2'>
                                <p className='text-sm text-gray-200 flex-1'>
                                  {m.text} {m.auto && <span className='text-gray-600 text-xs'>· {t('memory.autoTag')}</span>}
                                </p>
                                <div className='flex items-center gap-1 flex-shrink-0'>
                                  <button
                                    onClick={() => { setEditingId(m.id); setEditDraft(m.text); }}
                                    className='p-1.5 rounded-lg hover:bg-white/10 text-gray-500 hover:text-white'
                                  >
                                    <Pencil size={12} />
                                  </button>
                                  <button
                                    onClick={() => handleDelete(m.id)}
                                    className='p-1.5 rounded-lg hover:bg-white/10 text-gray-500 hover:text-red-400'
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}

              {/* Añadir a mano */}
              {adding ? (
                <div className='bg-app-bg rounded-xl p-3 border border-white/10 space-y-2'>
                  <div className='grid grid-cols-3 gap-1.5'>
                    {CATEGORIES.map(cat => (
                      <button
                        key={cat}
                        onClick={() => setNewCategory(cat)}
                        className={`py-1.5 rounded-lg text-xs border ${newCategory === cat ? 'border-accent bg-accent/10 text-white' : 'border-white/10 text-gray-400'}`}
                      >
                        {categoryLabels[cat]}
                      </button>
                    ))}
                  </div>
                  <textarea
                    autoFocus
                    value={newText}
                    onChange={e => setNewText(e.target.value)}
                    placeholder={t('memory.addPlaceholder')}
                    rows={2}
                    className='w-full bg-card-bg text-white text-sm rounded-lg p-2 outline-none resize-none placeholder-gray-700'
                  />
                  <div className='flex justify-end gap-2'>
                    <button onClick={() => setAdding(false)} className='text-xs px-3 py-2 rounded-lg text-gray-400'>
                      {t('appearance.confirmNo')}
                    </button>
                    <button onClick={handleAddManual} className='text-xs px-3 py-2 rounded-lg bg-accent text-white'>
                      {t('appearance.confirmYes')}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setAdding(true)}
                  className='w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-white/20 text-gray-400 hover:text-white hover:border-white/40 text-sm'
                >
                  <Plus size={14} /> {t('memory.addManual')}
                </button>
              )}
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
