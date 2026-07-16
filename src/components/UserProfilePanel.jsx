import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Save, User } from 'lucide-react';

const AVATAR_OPTIONS = ['👤', '🧙‍♂️', '🧝‍♀️', '🥷', '👨‍🚀', '🧛', '🤖', '🦊', '🦁', '👑'];

const TONE_OPTIONS = [
  { value: 'casual', label: 'Casual — Cercano y familiar' },
  { value: 'formal', label: 'Formal — Respetuoso y distante' },
  { value: 'epic', label: 'Épico — Como un héroe legendario' },
];

export default function UserProfilePanel({ onClose }) {
  const { userProfile, saveProfile, lang, saveLanguage, t } = useApp();
  const [alias, setAlias] = useState(userProfile.alias);
  const [avatar, setAvatar] = useState(userProfile.avatar);
  const [tone, setTone] = useState(userProfile.roleTone);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    await saveProfile({ alias, avatar, roleTone: tone });
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose?.();
    }, 1200);
  }

  return (
    <div className='w-full max-w-md bg-card-bg border border-white/10 rounded-2xl p-5 shadow-xl text-white'>
      
      {/* Encabezado */}
      <div className='flex items-center gap-2 mb-6 border-b border-white/5 pb-3'>
        <User size={18} className='text-accent' />
        <h2 className='text-base font-bold'>Tu Perfil de Jugador</h2>
      </div>

      <div className='space-y-5'>
        {/* Campo: Alias */}
        <div>
          <label className='block text-xs font-semibold text-gray-400 mb-2'>
            Alias en el mundo
          </label>
          <input
            type='text'
            value={alias}
            onChange={e => setAlias(e.target.value)}
            placeholder='Cómo te llamarán los NPCs'
            className='w-full bg-app-bg text-white text-sm rounded-xl px-3 py-2.5 border border-white/10 focus:border-accent/60 outline-none placeholder-gray-700 transition-colors'
          />
        </div>

        {/* Campo: Selector de Avatar */}
        <div>
          <label className='block text-xs font-semibold text-gray-400 mb-2'>
            Avatar
          </label>
          <div className='grid grid-cols-5 gap-2 bg-app-bg p-2 rounded-xl border border-white/10'>
            {AVATAR_OPTIONS.map(a => (
              <button
                key={a}
                type='button'
                onClick={() => setAvatar(a)}
                className={`text-xl h-10 rounded-lg transition-all flex items-center justify-center ${
                  avatar === a ? 'bg-accent/30 ring-1 ring-accent' : 'hover:bg-white/5'
                }`}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        {/* Campo: Tono de Rol */}
        <div>
          <label className='block text-xs font-semibold text-gray-400 mb-2'>
            Tono de interacción
          </label>
          <div className='space-y-1.5'>
            {TONE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type='button'
                onClick={() => setTone(opt.value)}
                className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-all ${
                  tone === opt.value
                    ? 'bg-accent/20 text-accent border border-accent/30 font-medium'
                    : 'bg-app-bg text-gray-400 border border-white/10 hover:border-white/20'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Campo: Selector de Idioma */}
        <div>
          <label className='block text-xs font-semibold text-gray-400 mb-2'>
            Idioma de la interfaz
          </label>
          <div className='flex gap-2 bg-app-bg p-1 rounded-xl border border-white/10'>
            {['es', 'en'].map(l => (
              <button
                key={l}
                type='button'
                onClick={() => saveLanguage(l)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
                  lang === l
                    ? 'bg-accent text-white shadow-md'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {l === 'es' ? '🇪🇸 Español' : '🇺🇸 English'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Botón de Guardado */}
      <button
        type='button'
        onClick={handleSave}
        disabled={saved}
        className={`w-full mt-6 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
          saved
            ? 'bg-emerald-600 text-white'
            : 'bg-accent hover:bg-accent-hover text-white shadow-lg shadow-accent/20'
        }`}
      >
        <Save size={16} />
        {saved ? 'Guardado con éxito' : 'Guardar Perfil'}
      </button>

    </div>
  );
}