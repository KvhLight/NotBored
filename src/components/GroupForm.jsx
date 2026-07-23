import React, { useState } from 'react';
import { X, Save, Check } from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function GroupForm({ group, characters, onSave, onCancel }) {
  const { t } = useApp();
  const [name, setName] = useState(group?.name || '');
  const [scenario, setScenario] = useState(group?.scenario || '');
  const [selectedIds, setSelectedIds] = useState(group?.characterIds || []);
  const [error, setError] = useState('');

  function toggleCharacter(id) {
    setSelectedIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  }

  function handleSave() {
    if (!name.trim()) {
      setError(t('group.nameRequired'));
      return;
    }
    if (selectedIds.length < 2) {
      setError(t('group.minCharacters'));
      return;
    }
    onSave({ name: name.trim(), scenario: scenario.trim(), characterIds: selectedIds });
  }

  return (
    <div className='flex flex-col h-full bg-app-bg'>
      <div className='flex items-center justify-between px-4 pt-12 pb-3 border-b border-white/10'>
        <button onClick={onCancel} className='p-2 rounded-xl hover:bg-white/10 text-gray-400'>
          <X size={18} />
        </button>
        <h2 className='text-base font-bold text-white'>
          {group ? t('group.edit') : t('group.new')}
        </h2>
        <button
          onClick={handleSave}
          className='flex items-center gap-1.5 bg-accent text-white text-sm px-3 py-1.5 rounded-xl hover:bg-accent/80 transition-colors'
        >
          <Save size={14} /> {t('character.save')}
        </button>
      </div>

      <div className='flex-1 overflow-y-auto px-4 py-4 space-y-4'>
        {error && <p className='text-xs text-red-400 bg-red-500/10 rounded-xl px-3 py-2'>{error}</p>}

        <div>
          <label className='text-xs text-gray-500 mb-1.5 block'>{t('group.nameLabel')}</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={t('group.namePlaceholder')}
            className='w-full bg-card-bg text-white text-sm rounded-xl px-3 py-2.5 border border-white/10 focus:border-accent/60 outline-none placeholder-gray-700'
          />
        </div>

        <div>
          <label className='text-xs text-gray-500 mb-1.5 block'>{t('group.scenarioLabel')}</label>
          <textarea
            value={scenario}
            onChange={e => setScenario(e.target.value)}
            placeholder={t('group.scenarioPlaceholder')}
            rows={4}
            className='w-full bg-card-bg text-white text-sm rounded-xl px-3 py-2.5 border border-white/10 focus:border-accent/60 outline-none resize-none placeholder-gray-700'
          />
        </div>

        <div>
          <label className='text-xs text-gray-500 mb-1.5 block'>
            {t('group.charactersLabel')} ({selectedIds.length} {t('group.selected')})
          </label>

          {characters.length === 0 ? (
            <p className='text-xs text-gray-500'>{t('group.noCharacters')}</p>
          ) : (
            <div className='space-y-2'>
              {characters.map(c => {
                const selected = selectedIds.includes(c.id);
                return (
                  <button
                    key={c.id}
                    onClick={() => toggleCharacter(c.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                      selected ? 'border-accent bg-accent/10' : 'border-white/10 hover:border-white/30'
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
                    {selected && <Check size={16} className='text-accent flex-shrink-0' />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className='h-8' />
      </div>
    </div>
  );
}
