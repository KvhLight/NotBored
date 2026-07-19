import React from 'react';

const OPTIONS = [
  { id: 'male', labelKey: 'profile.genderMale' },
  { id: 'female', labelKey: 'profile.genderFemale' },
  { id: 'other', labelKey: 'profile.genderOther' },
  { id: 'unspecified', labelKey: 'profile.genderUnspecified' },
];

/**
 * Selector de género del perfil de usuario — se guarda en userProfile.gender
 * y se inyecta (si está definido) en el bloque de contexto que la IA recibe
 * sobre quién eres, igual que ya pasa con el nombre y el tono.
 */
export default function GenderSelector({ value, onChange, t }) {
  return (
    <div className='grid grid-cols-2 gap-2'>
      {OPTIONS.map(opt => (
        <button
          key={opt.id}
          type='button'
          onClick={() => onChange(opt.id)}
          className={`flex items-center justify-center py-2.5 rounded-xl border text-sm transition-all ${
            value === opt.id
              ? 'border-accent bg-accent/10 text-white'
              : 'border-white/10 text-gray-400 hover:border-white/30'
          }`}
        >
          {t(opt.labelKey)}
        </button>
      ))}
    </div>
  );
}
