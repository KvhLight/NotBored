import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Trash2, UserCircle2, Check, Pencil } from 'lucide-react';
import { useApp } from '../context/AppContext';

/**
 * Panel de selección de "persona" — quién eres tú de cara a la IA, en este
 * personaje concreto. Por defecto se usa el perfil de Ajustes; aquí puedes
 * crear perfiles alternativos y elegir cuál usar (guardado por personaje).
 */
export default function PersonaPicker({ isOpen, onClose, characterId, characterName, onChange }) {
  const { t, userProfile } = useApp();
  const [personas, setPersonas] = useState([]);
  const [selection, setSelection] = useState({ enabled: false, personaId: null });
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState(null); // id de la persona que se está editando, o null
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [lore, setLore] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    Promise.all([
      window.electronAPI.personas.getAll(),
      window.electronAPI.personas.getSelection(characterId),
    ]).then(([allPersonas, sel]) => {
      setPersonas(allPersonas);
      setSelection(sel);
      setLoading(false);
    });
  }, [isOpen, characterId]);

  function resetForm() {
    setTitle(''); setName(''); setDescription(''); setLore('');
  }

  async function persistSelection(next) {
    setSelection(next);
    await window.electronAPI.personas.setSelection(characterId, next);
    onChange?.(next);
  }

  async function handleToggleEnabled() {
    if (selection.enabled) {
      await persistSelection({ enabled: false, personaId: selection.personaId });
      return;
    }
    // Al activar, si no hay ninguna persona seleccionada todavía, se elige
    // la primera de la lista automáticamente (para que no quede "vacío")
    const fallbackId = selection.personaId || personas[0]?.id || null;
    await persistSelection({ enabled: true, personaId: fallbackId });
  }

  async function handleSelectPersona(personaId) {
    await persistSelection({ enabled: true, personaId });
  }

  async function handleCreatePersona() {
    if (!title.trim() || !name.trim()) return;
    const newPersona = await window.electronAPI.personas.create({ title, name, description, lore });
    setPersonas(p => [...p, newPersona]);
    resetForm();
    setCreating(false);
    // Si es la primera persona creada y la persona está activada, se selecciona sola
    if (selection.enabled && !selection.personaId) {
      await persistSelection({ enabled: true, personaId: newPersona.id });
    }
  }

  function handleStartEdit(p) {
    setEditingId(p.id);
    setCreating(false);
    setTitle(p.title || '');
    setName(p.name || '');
    setDescription(p.description || '');
    setLore(p.lore || '');
  }

  async function handleSaveEdit() {
    if (!title.trim() || !name.trim()) return;
    const updated = await window.electronAPI.personas.update(editingId, { title, name, description, lore });
    setPersonas(p => p.map(x => x.id === editingId ? updated : x));
    resetForm();
    setEditingId(null);
  }

  async function handleDeletePersona(id) {
    await window.electronAPI.personas.delete(id);
    setPersonas(p => p.filter(x => x.id !== id));
    if (selection.personaId === id) {
      setSelection(s => ({ ...s, personaId: null }));
    }
    if (editingId === id) { resetForm(); setEditingId(null); }
  }

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className='absolute inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-end'
        onClick={onClose}
      >
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          onClick={e => e.stopPropagation()}
          className='w-full bg-card-bg rounded-t-3xl border-t border-white/10 p-4 max-h-[75%] overflow-y-auto'
        >
          <div className='flex items-center justify-between mb-3'>
            <h3 className='flex items-center gap-2 text-white font-semibold'>
              <UserCircle2 size={18} className='text-accent' />
              {t('persona.title')}
            </h3>
            <button onClick={onClose} className='p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white'>
              <X size={16} />
            </button>
          </div>

          {loading ? (
            <p className='text-sm text-gray-500 py-6 text-center'>{t('appearance.loading')}</p>
          ) : (
            <>
              {/* Interruptor: usar persona personalizada o el perfil por defecto */}
              <div className='flex items-center justify-between bg-app-bg rounded-xl p-3 border border-white/10 mb-3'>
                <div>
                  <p className='text-sm text-white'>{t('persona.enableToggle')}</p>
                  <p className='text-xs text-gray-500'>
                    {selection.enabled
                      ? t('persona.usingCustom')
                      : t('persona.usingDefault', { name: userProfile?.alias || '' })}
                  </p>
                </div>
                <button
                  onClick={handleToggleEnabled}
                  className={`w-11 h-6 rounded-full flex-shrink-0 transition-colors relative ${selection.enabled ? 'bg-accent' : 'bg-gray-700'}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${selection.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>

              {selection.enabled && (
                <>
                  {personas.length === 0 && !creating && (
                    <p className='text-xs text-gray-500 text-center py-4 px-2'>
                      {t('persona.emptyState', { character: characterName || '' })}
                    </p>
                  )}

                  <div className='space-y-2 mb-3'>
                    {personas.map(p => (
                      <div
                        key={p.id}
                        onClick={() => handleSelectPersona(p.id)}
                        className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-colors ${
                          selection.personaId === p.id ? 'border-accent bg-accent/10' : 'border-white/10 hover:border-white/30'
                        }`}
                      >
                        <div className='min-w-0'>
                          <p className='text-sm text-white font-medium truncate'>{p.title}</p>
                          <p className='text-xs text-gray-500 truncate'>{p.name}</p>
                        </div>
                        <div className='flex items-center gap-1 flex-shrink-0'>
                          {selection.personaId === p.id && <Check size={14} className='text-accent' />}
                          <button
                            onClick={e => { e.stopPropagation(); handleStartEdit(p); }}
                            className='p-1.5 rounded-lg hover:bg-white/10 text-gray-500 hover:text-white'
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); handleDeletePersona(p.id); }}
                            className='p-1.5 rounded-lg hover:bg-white/10 text-gray-500 hover:text-red-400'
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {(creating || editingId) ? (
                    <div className='space-y-2 bg-app-bg rounded-xl p-3 border border-white/10'>
                      <input
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        placeholder={t('persona.titlePlaceholder')}
                        className='w-full bg-card-bg text-white text-sm rounded-lg px-3 py-2 border border-white/10 outline-none focus:border-accent/60'
                      />
                      <input
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder={t('persona.namePlaceholder')}
                        className='w-full bg-card-bg text-white text-sm rounded-lg px-3 py-2 border border-white/10 outline-none focus:border-accent/60'
                      />
                      <textarea
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        placeholder={t('persona.descriptionPlaceholder')}
                        rows={3}
                        className='w-full bg-card-bg text-white text-sm rounded-lg px-3 py-2 border border-white/10 outline-none focus:border-accent/60 resize-none'
                      />
                      <div>
                        <textarea
                          value={lore}
                          onChange={e => setLore(e.target.value)}
                          placeholder={t('persona.lorePlaceholder')}
                          rows={3}
                          className='w-full bg-card-bg text-white text-sm rounded-lg px-3 py-2 border border-white/10 outline-none focus:border-accent/60 resize-none'
                        />
                        <p className='text-[11px] text-gray-600 mt-1'>{t('persona.loreHint')}</p>
                      </div>
                      <div className='flex justify-end gap-2 pt-1'>
                        <button
                          onClick={() => { resetForm(); setCreating(false); setEditingId(null); }}
                          className='text-xs px-3 py-2 rounded-lg text-gray-400 hover:text-white'
                        >
                          {t('appearance.confirmNo')}
                        </button>
                        <button
                          onClick={editingId ? handleSaveEdit : handleCreatePersona}
                          disabled={!title.trim() || !name.trim()}
                          className='text-xs px-3 py-2 rounded-lg bg-accent text-white disabled:opacity-40'
                        >
                          {t('appearance.confirmYes')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => { resetForm(); setCreating(true); }}
                      className='w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-white/20 text-gray-400 hover:text-white hover:border-white/40'
                    >
                      <Plus size={14} /> {t('persona.createNew')}
                    </button>
                  )}
                </>
              )}
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
