import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Image as ImageIcon, Trash2 } from 'lucide-react';
import { useApp } from '../context/AppContext';

/**
 * Panel para poner/quitar el fondo de pantalla de ESTE chat (personaje).
 * Antes vivía como un menú desplegable suelto en la cabecera del chat;
 * ahora es una fila más dentro del menú de Ajustes del chat.
 */
export default function ChatWallpaperPicker({ isOpen, onClose, characterId }) {
  const { t, getChatWallpaper, saveChatWallpaper } = useApp();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const chatWallpaper = getChatWallpaper(characterId);

  if (!isOpen) return null;

  async function handleSelect() {
    setLoading(true);
    setError('');
    try {
      const filePath = await window.electronAPI.image.selectFile();
      if (!filePath) { setLoading(false); return; }
      const dataUri = await window.electronAPI.image.toBase64(filePath);
      await saveChatWallpaper(characterId, dataUri);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleClear() {
    await saveChatWallpaper(characterId, null);
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
              <ImageIcon size={18} className='text-accent' />
              {t('chat.wallpaperTooltip')}
            </h3>
            <button onClick={onClose} className='p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white'>
              <X size={16} />
            </button>
          </div>

          {chatWallpaper && (
            <img
              src={chatWallpaper}
              alt='wallpaper'
              className='w-full h-32 object-cover rounded-xl mb-3 border border-white/10'
            />
          )}

          {error && (
            <p className='text-xs text-red-400 mb-2'>{error}</p>
          )}

          <div className='space-y-2'>
            <button
              disabled={loading}
              onClick={handleSelect}
              className='w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-white/20 text-gray-300 hover:text-white hover:border-white/40 disabled:opacity-50'
            >
              <ImageIcon size={14} className='text-accent' />
              {loading ? t('appearance.loading') : t('chat.setWallpaper')}
            </button>

            {chatWallpaper && (
              <button
                onClick={handleClear}
                className='w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-white/10 text-red-400 hover:bg-red-500/10'
              >
                <Trash2 size={14} />
                {t('chat.removeWallpaper')}
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
