export const TAXONOMY = [
  {	id:	'favorites',	label:	'⭐	Favoritos',	color:	'#FACC15'	},
  { id: 'fantasy', label: '🔮 Fantasía', color: '#7C3AED' },
  { id: 'scifi', label: '🚀 Ciencia Ficción', color: '#2563EB' },
  { id: 'cyberpunk', label: '🌐 Cyberpunk', color: '#06B6D4' },
  { id: 'historical', label: '📜 Histórico', color: '#D97706' },
  { id: 'horror', label: '🩸 Terror', color: '#DC2626' },
  { id: 'romance', label: '💖 Romance', color: '#EC4899' },
  { id: 'adventure', label: '🧭 Aventura', color: '#059669' },
  { id: 'mystery', label: '🔎 Misterio', color: '#0891B2' },
  { id: 'comedy', label: '🎭 Comedia', color: '#F59E0B' },
  { id: 'drama', label: '⏳ Drama', color: '#6B7280' },
  { id: 'nsfw', label: '🔞 NSFW', color: '#991B1B' },
  { id: 'original', label: '💎 Original', color: '#8B5CF6' },
];

/**
 * Helper: Obtener datos estructurados de una categoría por su ID.
 * Si no existe, retorna un objeto fallback seguro.
 * @param {String} id 
 * @returns {Object}
 */
export function getTaxonomy(id) {
  return TAXONOMY.find(t => t.id === id) || { id, label: id, color: '#6B7280' };
}
export const FAVORITES_TAG_ID ='favorites';