import React, { useState } from 'react';
import { Upload, Image, Loader2 } from 'lucide-react';
import { useApp } from '../context/AppContext';

const EMOJI_FALLBACKS = [
  '🧙‍♂️', '🧝‍♀️', '🥷', '🧛', '🤖', '🦊', '🦁', '👑', '⚔️', '🔮',
  '🐲', '👹', '💀', '👽', '🧜‍♂️', '🧚‍♀️', '🤠', '🕵️', '🦾', '🎭'
];

/**
 * @param {String} value - Avatar actual (emoji, Base64 o file:// URL)
 * @param {String} characterId - ID del personaje (para nombrar el archivo)
 * @param {Function} onChange - Callback(newAvatar: String)
 */
export default function AvatarPicker({ value, characterId, onChange }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('emoji'); // 'emoji' | 'image'
  const { t } = useApp();

  // Determinar si el valor actual es una imagen real (Base64 o archivo local de Electron)
  const isImage = value?.startsWith('data:') || value?.startsWith('file://');

  async function handleSelectImage() {
    setLoading(true);
    setError('');
    try {
      // 1. Abrir diálogo de selección nativo
      const filePath = await window.electronAPI.image.selectFile();
      if (!filePath) { 
        setLoading(false); 
        return; 
      }
      
      let avatarValue;
      if (characterId) {
        // Personaje existente => copiar a AppData y usar file:// URL
        avatarValue = await window.electronAPI.image.saveAvatar(filePath, characterId);
      } else {
        // Personaje nuevo (sin ID aún) => Base64 temporal
        avatarValue = await window.electronAPI.image.toBase64(filePath);
      }
      onChange(avatarValue);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className='flex items-center gap-4 bg-card-bg p-4 rounded-2xl border border-white/5 text-white'>
      
      {/* Preview del avatar actual */}
      <div className='w-16 h-16 rounded-xl bg-app-bg border border-white/10 flex items-center justify-center text-3xl flex-shrink-0 overflow-hidden select-none'>
        {isImage ? (
          <img 
            src={value} 
            alt={t('avatarPicker.altPreview')} 
            className='w-full h-full object-cover'
            onError={() => setError(t('avatarPicker.imgRenderError'))}
          />
        ) : (
          <span>{value || '👤'}</span>
        )}
      </div>

      {/* Panel de Controles */}
      <div className='flex-1 min-w-0'>
        <div className='mb-2'>
          <h4 className='text-sm font-semibold text-white'>{t('avatarPicker.title')}</h4>
          <p className='text-xs text-gray-500'>{t('avatarPicker.subtitle')}</p>
        </div>

        {/* Tabs de Selección: Emoji / Imagen */}
        <div className='flex gap-1 bg-app-bg p-1 rounded-xl border border-white/10 mb-3'>
          {['emoji', 'image'].map(t_item => (
            <button
              key={t_item}
              type='button'
              onClick={() => setTab(t_item)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                tab === t_item ? 'bg-accent text-white shadow-sm' : 'text-gray-500 hover:text-white'
              }`}
            >
              {t_item === 'emoji' ? t('avatarPicker.tabEmoji') : t('avatarPicker.tabImage')}
            </button>
          ))}
        </div>

        {/* Vista Tab: Selector de Emojis */}
        {tab === 'emoji' && (
          <div className='grid grid-cols-10 gap-1.5 bg-app-bg p-2 rounded-xl border border-white/10 max-h-24 overflow-y-auto hidden-scrollbar'>
            {EMOJI_FALLBACKS.map(emoji => (
              <button
                key={emoji}
                type='button'
                onClick={() => onChange(emoji)}
                className={`text-xl h-8 rounded-lg flex items-center justify-center transition-all ${
                  value === emoji ? 'bg-accent/30 ring-1 ring-accent' : 'hover:bg-white/5'
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        {/* Vista Tab: Selector de Archivos Local */}
        {tab === 'image' && (
          <div className='space-y-1.5'>
            <button
              type='button'
              disabled={loading}
              onClick={handleSelectImage}
              className='w-full bg-app-bg border border-dashed border-white/20 hover:border-accent/60 text-gray-300 hover:text-white rounded-xl p-3 flex items-center justify-center gap-2 text-xs font-medium transition-all group disabled:opacity-50'
            >
              {loading ? (
                <Loader2 size={14} className='animate-spin text-accent' />
              ) : (
                <Upload size={14} className='text-gray-500 group-hover:text-accent transition-colors' />
              )}
              {loading ? t('avatarPicker.loading') : t('avatarPicker.uploadBtn')}
            </button>
            
            <p className='text-[10px] text-gray-500 leading-tight'>
              {t('avatarPicker.disclaimer')}
            </p>

            {error && (
              <p className='text-xs text-red-400 font-medium bg-red-500/10 border border-red-500/20 px-2 py-1 rounded-md mt-1'>
                ⚠️ {error}
              </p>
            )}
          </div>
        )}
      </div>

    </div>
  );
}