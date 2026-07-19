import React, { useState } from 'react';
import { X, Save } from 'lucide-react';
import AvatarPicker from './AvatarPicker';
import { useApp } from '../context/AppContext';
import useKeyboardInset from '../hooks/useKeyboardInset';


const FIELD_CONFIG = [
  { key: 'name', label: 'characterForm.nameLabel', type: 'input', placeholder: 'characterForm.namePlaceholder', required: true },
  { key: 'description', label: 'characterForm.descLabel', type: 'textarea', placeholder: 'characterForm.descPlaceholder' },
  { key: 'personality', label: 'characterForm.personalityLabel', type: 'textarea', placeholder: 'characterForm.personalityPlaceholder' },
  { key: 'scenario', label: 'characterForm.scenarioLabel', type: 'textarea', placeholder: 'characterForm.scenarioPlaceholder' },
  { key: 'systemPrompt', label: 'characterForm.systemLabel', type: 'textarea', placeholder: 'characterForm.systemPlaceholder', rows: 5 },
  { key: 'greetingMsg', label: 'characterForm.greetingLabel', type: 'textarea', placeholder: 'characterForm.greetingPlaceholder' },
  { key: 'tags', label: 'characterForm.tagsLabel', type: 'input', placeholder: 'tagsPlaceholder' },
];

export default function CharacterForm({ character, characters, onSave, onCancel, creationMode, setCreationMode}) {
  const [form, setForm] = useState({
    name: character?.name || '',
    avatar: character?.avatar || '🤖',
    description: character?.description || '',
    personality: character?.personality || '',
    scenario: character?.scenario || '',
    systemPrompt: character?.systemPrompt || '',
    greetingMsg: character?.greetingMsg || '',
    tags: character?.tags?.join(', ') || '',
    isNSFW: character?.isNSFW || false,
  });

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [errors, setErrors] = useState({});
  const [tagSuggestions, setTagSuggestions] = useState([]);
  const { t } = useApp();
  const keyboardInset = useKeyboardInset(true);

  const allTags = [
    ...new Set(
      characters.flatMap(char => char.tags || [])
    )
  ].sort();



  function set(key, value) {
    setForm(f => ({ ...f, [key]: value }));
    if (errors[key]) setErrors(e => ({ ...e, [key]: null }));
  }

  function updateTagSuggestions(value) {
    const currentTag = value
      .split(',')
      .pop()
      ?.trim()
      .toLowerCase();

    if (!currentTag) {
      setTagSuggestions([]);
      return;
    }

    const matches = allTags.filter(tag =>
      tag.toLowerCase().includes(currentTag)
    );

    setTagSuggestions(matches.slice(0, 5));
  }

  function validate() {
    const e = {};
    if (!form.name.trim()) e.name = t('character.requiredNameError');
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSave() {
    if (!validate()) return;
    const data = {
      ...form,
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
    };
    onSave(data);
  }

  return (
    <div className='flex flex-col h-full bg-app-bg'>

      {/* Header */}
      <div className='flex items-center justify-between px-4 pt-12 pb-3 border-b border-white/10'>
        <button onClick={onCancel} className='p-2 rounded-xl hover:bg-white/10 text-gray-400'>
          <X size={18} />
        </button>
        <h2 className='text-base font-bold text-white'>
          {character ? t('character.edit') : t('character.new')}
        </h2>
        <button 
          onClick={handleSave}
          className='flex items-center gap-1.5 bg-accent text-white text-sm px-3 py-1.5 rounded-xl hover:bg-accent/80 transition-colors'
        >
          <Save size={14} /> {t('character.save')}
        </button>
      </div>

      <div
        className='flex-1 overflow-y-auto px-4 py-4 space-y-4'
        style={{ paddingBottom: keyboardInset ? keyboardInset + 24 : undefined }}
      >
        
        {/* Avatar Picker */}
        <AvatarPicker 
          value={form.avatar}
          characterId={character?.id}
          onChange={(newAvatar) => set('avatar', newAvatar)}
        />

        {/* Dynamic Fields */}
        {FIELD_CONFIG.map(({ key, label, type, placeholder, rows, required }) => (
          <div key={key}>
            <label className='text-xs text-gray-500 mb-1.5 block'>
              {t(label)}
              {required && <span className='text-red-400 ml-1'>*</span>}
            </label>

            {type === 'input' ? (
              <>
                <input
                  value={form[key]}
                  onChange={e => {
                    set(key, e.target.value);

                    if (key === 'tags') {
                      updateTagSuggestions(e.target.value);
                    }
                  }}
                  placeholder={t(placeholder)}
                  className={`w-full bg-card-bg text-white text-sm rounded-xl px-3 py-2.5 border outline-none transition-colors placeholder-gray-700 ${
                    errors[key]
                      ? 'border-red-500'
                      : 'border-white/10 focus:border-accent/60'
                  }`}
                />

                {key === 'tags' && tagSuggestions.length > 0 && (
                  <div className='mt-2 bg-card-bg border border-white/10 rounded-xl overflow-hidden'>
                    {tagSuggestions.map(tag => (
                      <button
                        key={tag}
                        type='button'
                        onClick={() => {
                          const tags = form.tags.split(',');
                          tags[tags.length - 1] = ` ${tag}`;
                          set('tags', tags.join(',').trim());
                          setTagSuggestions([]);
                        }}
                        className='block w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-white/5'
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <textarea
                value={form[key]}
                onChange={e => set(key, e.target.value)}
                placeholder={t(placeholder)}
                rows={rows || 3}
                className={`w-full bg-card-bg text-white text-sm rounded-xl px-3 py-2.5 border outline-none resize-none transition-colors placeholder-gray-700 ${
                  errors[key]
                    ? 'border-red-500'
                    : 'border-white/10 focus:border-accent/60'
                }`}
              />
            )}
            
            {errors[key] && <p className='text-red-400 text-xs mt-1'>{errors[key]}</p>}
          </div>
        ))}

        {/* NSFW Toggle */}
        <div className='flex items-center justify-between bg-card-bg rounded-xl px-4 py-3 border border-white/10'>
          <div>
            <p className='text-sm text-white font-medium'>{t('character.nsfwTitle')}</p>
            <p className='text-xs text-gray-500'>{t('character.nsfwSubtitle')}</p>
          </div>
          
          <button 
            onClick={() => set('isNSFW', !form.isNSFW)}
            className={`w-11 h-6 rounded-full transition-colors relative ${
              form.isNSFW ? 'bg-accent' : 'bg-gray-700'
            }`}
          >
            <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all ${
              form.isNSFW ? 'left-5' : 'left-0.5'
            }`} />
          </button>
        </div>

        <div className='h-8' /> {/* Bottom padding */}
      </div>

    </div>
  );
}