import React, { useEffect } from 'react';
import { Search, Settings } from 'lucide-react';
import { useCharacterFilter } from '../hooks/useCharacterFilter';
import TagFilterBar      from './TagFilterBar';
import CharacterGridCard from './CharacterGridCard';
import { useApp }        from '../context/AppContext';

export default function Sidebar({
  characters,
  activeTagFilter,
  onTagFilterApplied,
  onSelectCharacter,
  onNewCharacter,
  onEditCharacter,
  onDeleteCharacter,
  onOpenSettings,
  onToggleFavorite,
}) {
  const { t } = useApp();
  const {
    filteredCharacters,
    searchText,
    setSearchText,
    activeTags,
    setActiveTags,
    toggleTag,
    clearFilters,
    hasActiveFilters,
  } = useCharacterFilter(characters);

  useEffect(() => {
    if (!activeTagFilter) return;
    setActiveTags(prev => {
      const next = new Set(prev);
      next.add(activeTagFilter);
      return next;
    });
    onTagFilterApplied?.();
  }, [activeTagFilter]);

  return (
    <div className='flex flex-col h-full bg-app-bg'>

      <div className='px-4 pt-12 pb-3 bg-gradient-to-b from-card-bg to-transparent'>
        <div className='flex items-center justify-between mb-1'>
          <h1 className='text-xl font-bold text-white'>{t('sidebar.title')}</h1>
          <button
            onClick={onOpenSettings}
            title={t('sidebar.settings')}
            className='p-2 rounded-xl hover:bg-white/10 text-gray-400 hover:text-white transition-colors'
          >
            <Settings size={16} />
          </button>
        </div>
        <p className='text-xs text-gray-500'>
          {t('sidebar.version')} {filteredCharacters.length}/{characters.length}
          {' '}{t('app.characters')}
          {hasActiveFilters && ' (filtrado)'}
        </p>
      </div>

      <div className='px-4 mb-2'>
        <div className='flex items-center gap-2 bg-card-bg rounded-xl px-3 py-2 border border-white/10'>
          <Search size={15} className='text-gray-500' />
          <input
            type='text'
            placeholder={t('sidebar.search')}
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            className='flex-1 bg-transparent text-sm text-white placeholder-gray-600 outline-none'
          />
        </div>
      </div>

      <TagFilterBar
        activeTags={activeTags}
        onToggleTag={toggleTag}
        onRemoveTag={toggleTag}
        onClear={clearFilters}
        hasFilters={hasActiveFilters}
      />

      <div className='flex-1 overflow-y-auto px-4 pb-28'>
        {characters.length === 0 && (
          <div className='text-center py-16 text-gray-600'>
            <p className='text-4xl mb-3'>📭</p>
            <p className='text-sm'>{t('sidebar.lackCahracter')}</p>
            <p className='text-xs mt-1'>{t('sidebar.createCharacter')}</p>
          </div>
        )}

        <div className='grid grid-cols-2 gap-3 pt-1'>
          {filteredCharacters.map((char, i) => (
            <CharacterGridCard
              key={char.id}
              character={char}
              index={i}
              onSelect={onSelectCharacter}
              onEdit={onEditCharacter}
              onDelete={onDeleteCharacter}
              onTagClick={toggleTag}
              onToggleFavorite={onToggleFavorite}
            />
          ))}
        </div>
      </div>
    </div>
  );
}