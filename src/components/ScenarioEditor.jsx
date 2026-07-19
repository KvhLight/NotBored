import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MapPinned, RotateCcw } from 'lucide-react';
import { useApp } from '../context/AppContext';

/**
 * Panel para editar el escenario de ESTA conversación en concreto.
 * Si se deja vacío, se usa el escenario por defecto del personaje
 * (definido al crearlo) — así el mismo personaje puede tener roleplays
 * distintos sin tener que duplicarlo.
 */
export default function ScenarioEditor({ isOpen, onClose, character, conversation, onSave }) {
  const { t } = useApp();
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) setValue(conversation?.scenarioOverride || '');
  }, [isOpen, conversation?.id]);

  if (!isOpen) return null;

  async function handleSave() {
    setSaving(true);
    await window.electronAPI.conversations.setScenario(conversation.id, value);
    setSaving(false);
    onSave?.(value.trim());
    onClose();
  }

  async function handleReset() {
    setValue('');
    setSaving(true);
    await window.electronAPI.conversations.setScenario(conversation.id, '');
    setSaving(false);
    onSave?.('');
    onClose();
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className='absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end'
        onClick={onClose}
      >
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          onClick={e => e.stopPropagation()}
          className='w-full bg-card-bg rounded-t-3xl border-t border-white/10 p-4 max-h-[80%] overflow-y-auto'
        >
          <div className='flex items-center justify-between mb-3'>
            <h3 className='flex items-center gap-2 text-white font-semibold'>
              <MapPinned size={18} className='text-accent' />
              {t('scenarioEditor.title')}
            </h3>
            <button onClick={onClose} className='p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white'>
              <X size={16} />
            </button>
          </div>

          <p className='text-xs text-gray-500 mb-3'>
            {t('scenarioEditor.description', { name: character?.name || '' })}
          </p>

          <textarea
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder={character?.scenario
              ? t('scenarioEditor.placeholderWithDefault', { defaultScenario: character.scenario })
              : t('scenarioEditor.placeholderEmpty')}
            rows={6}
            autoFocus
            className='w-full bg-app-bg text-white text-sm rounded-xl px-3 py-3 border border-white/10 outline-none focus:border-accent/60 resize-none'
          />

          <div className='flex items-center justify-between gap-2 pt-3'>
            {conversation?.scenarioOverride ? (
              <button
                onClick={handleReset}
                disabled={saving}
                className='flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg text-gray-400 hover:text-white disabled:opacity-40'
              >
                <RotateCcw size={12} /> {t('scenarioEditor.resetToDefault')}
              </button>
            ) : <span />}
            <button
              onClick={handleSave}
              disabled={saving}
              className='text-xs px-4 py-2 rounded-lg bg-accent text-white disabled:opacity-40'
            >
              {t('scenarioEditor.save')}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
