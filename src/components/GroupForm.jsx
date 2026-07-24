import React, { useState } from 'react';
import { X, Save, Check, Search, UserCircle2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import PersonaPicker from './PersonaPicker';

export default function GroupForm({ group, characters, onSave, onCancel }) {
  const { t, userProfile } = useApp();
  const [name, setName] = useState(group?.name || '');
  const [scenario, setScenario] = useState(group?.scenario || '');
  const [selectedIds, setSelectedIds] = useState(group?.characterIds || []);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [showPersonaPicker, setShowPersonaPicker] = useState(false);
  const [groupPersona, setGroupPersona] = useState(null); // persona elegida para este grupo, si hay alguna

  // La persona de un grupo se guarda con una clave propia ('group:<id>'),
  // reutilizando el mismo sistema de personas que ya existe por personaje —
  // solo se puede elegir una vez que el grupo ya existe (tiene id).
  const personaKey = group ? `group:${group.id}` : null;

  React.useEffect(() => {
    if (!personaKey) return;
    (async () => {
      const selection = await window.electronAPI.personas.getSelection(personaKey);
      if (selection.enabled && selection.personaId) {
        const all = await window.electronAPI.personas.getAll();
        setGroupPersona(all.find(p => p.id === selection.personaId) || null);
      } else {
        setGroupPersona(null);
      }
    })();
  }, [personaKey]);

  const filteredCharacters = characters.filter(c =>
    c.name.toLowerCase().includes(search.trim().toLowerCase())
  );

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
    <div className='flex flex-col h-full bg-app-bg relative'>
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

        {personaKey && (
          <div>
            <label className='text-xs text-gray-500 mb-1.5 block'>{t('group.yourPersonaLabel')}</label>
            <button
              onClick={() => setShowPersonaPicker(true)}
              className='w-full flex items-center gap-3 p-3 rounded-xl border border-white/10 hover:border-white/30 transition-colors'
            >
              <div className='w-9 h-9 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0'>
                <UserCircle2 size={18} className='text-gray-300' />
              </div>
              <div className='flex-1 text-left'>
                <p className='text-sm text-white'>{groupPersona ? groupPersona.title : t('group.usingDefaultPersona')}</p>
                <p className='text-xs text-gray-500'>{groupPersona ? groupPersona.name : (userProfile?.alias || '')}</p>
              </div>
              <span className='text-xs text-accent'>{t('group.change')}</span>
            </button>
          </div>
        )}

        <div>
          <label className='text-xs text-gray-500 mb-1.5 block'>
            {t('group.charactersLabel')} ({selectedIds.length} {t('group.selected')})
          </label>

          {characters.length > 5 && (
            <div className='relative mb-2'>
              <Search size={14} className='absolute left-3 top-1/2 -translate-y-1/2 text-gray-500' />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={t('group.searchCharacters')}
                className='w-full bg-card-bg text-white text-sm rounded-xl pl-9 pr-3 py-2.5 border border-white/10 focus:border-accent/60 outline-none placeholder-gray-700'
              />
            </div>
          )}

          {characters.length === 0 ? (
            <p className='text-xs text-gray-500'>{t('group.noCharacters')}</p>
          ) : filteredCharacters.length === 0 ? (
            <p className='text-xs text-gray-500'>{t('group.noSearchResults')}</p>
          ) : (
            <div className='space-y-2'>
              {filteredCharacters.map(c => {
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

      {personaKey && (
        <PersonaPicker
          isOpen={showPersonaPicker}
          onClose={() => setShowPersonaPicker(false)}
          characterId={personaKey}
          characterName={name || group.name}
          onChange={async () => {
            const selection = await window.electronAPI.personas.getSelection(personaKey);
            if (selection.enabled && selection.personaId) {
              const all = await window.electronAPI.personas.getAll();
              setGroupPersona(all.find(p => p.id === selection.personaId) || null);
            } else {
              setGroupPersona(null);
            }
          }}
        />
      )}
    </div>
  );
}
