import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, UserCircle2 } from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function SpeakerPicker({ isOpen, onClose, characters, userLabel, suggestedSpeakerId, onSelect }) {
  const { t } = useApp();

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className='absolute inset-0 z-40 bg-black/80 flex items-end'
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
          <div className='flex items-center justify-between mb-4'>
            <h3 className='text-white font-semibold'>{t('group.whoSpeaks')}</h3>
            <button onClick={onClose} className='p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white'>
              <X size={16} />
            </button>
          </div>

          <div className='space-y-2'>
            {/* Tú */}
            <button
              onClick={() => onSelect('user')}
              className='w-full flex items-center gap-3 p-3 rounded-xl border border-white/10 hover:border-white/30 transition-colors'
            >
              <div className='w-9 h-9 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0'>
                <UserCircle2 size={18} className='text-gray-300' />
              </div>
              <span className='text-sm text-white'>{userLabel}</span>
            </button>

            {/* Personajes del grupo */}
            {characters.map(c => {
              const isSuggested = suggestedSpeakerId === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => onSelect(c.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                    isSuggested ? 'border-accent bg-accent/10' : 'border-white/10 hover:border-white/30'
                  }`}
                >
                  <div className='w-9 h-9 rounded-full bg-accent/20 flex items-center justify-center overflow-hidden flex-shrink-0'>
                    {c.avatar?.startsWith('data:') ? (
                      <img src={c.avatar} alt={c.name} className='w-full h-full object-cover' />
                    ) : (
                      <span className='text-base'>{c.avatar || '👤'}</span>
                    )}
                  </div>
                  <span className='flex-1 text-left text-sm text-white truncate'>{c.name}</span>
                  {isSuggested && (
                    <span className='flex items-center gap-1 text-[10px] uppercase tracking-wide text-accent bg-accent/15 px-2 py-1 rounded-full flex-shrink-0'>
                      <Sparkles size={10} /> {t('group.aiSuggests')}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
