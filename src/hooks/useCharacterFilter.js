import { useState, useMemo } from 'react';
import { FAVORITES_TAG_ID } from '../constants/taxonomy';

/**
 * Hook personalizado que gestiona el filtrado combinado (Texto + Tags) de personajes.
 * Aplica lógica OR para los campos de texto y lógica AND estricta para la colección de tags.
 * * @param {Array} characters - Lista completa de personajes de la base de datos
 * @returns {Object} { filteredCharacters, searchText, setSearchText, activeTags, toggleTag, clearFilters, hasActiveFilters }
 */
export function useCharacterFilter(characters) {
  const [searchText, setSearchText] = useState('');
  const [activeTags, setActiveTags] = useState(new Set());

  // Conmutar la activación de un tag en el Set reactivo
  function toggleTag(tagId) {
    setActiveTags(prev => {
      const next = new Set(prev);
      if (next.has(tagId)) {
        next.delete(tagId);
      } else {
        next.add(tagId);
      }
      return next;
    });
  }

  // Purgar todos los filtros activos para restaurar la lista completa
  function clearFilters() {
    setSearchText('');
    setActiveTags(new Set());
  }

  // useMemo optimizado para evitar recalcular filtros pesados en re-renders innecesarios
  const filteredCharacters = useMemo(() => {
    const query = searchText.toLowerCase().trim();
    const	wantsFavoritesOnly	=	activeTags.has(FAVORITES_TAG_ID);
    const	realActiveTags	=	[...activeTags].filter(t	=>	t	!==	FAVORITES_TAG_ID);

    return characters.filter(char => {
      // 1. Filtro de Texto Avanzado (OR multiesquema)
      const matchesText = !query || [
        char.name,
        char.description,
        char.personality,
        char.scenario,
        ...(char.tags || []),
      ].some(field => field?.toLowerCase().includes(query));

      // 2. Filtro de Tags Cruzado (Lógica relacional AND)
      // El personaje debe cumplir/contener TODOS los tags seleccionados en el panel
      const matchesTags = activeTags.size === 0 ||
        realActiveTags.every(tag => char.tags?.includes(tag));
      //	3.	Filtro	de	Favoritos	(virtual	—	no	vive	en	char.tags)
      const	matchesFavorites	=	!wantsFavoritesOnly	||	char.isFavorite	===	true;
      return matchesText && matchesTags && matchesFavorites;
    });
  }, [characters, searchText, activeTags]);

  const hasActiveFilters = searchText.length > 0 || activeTags.size > 0;

  return {
    filteredCharacters,
    searchText,
    setSearchText,
    activeTags,
    setActiveTags,   // ← añadir esta línea
    toggleTag,
    clearFilters,
    hasActiveFilters,
  };
}