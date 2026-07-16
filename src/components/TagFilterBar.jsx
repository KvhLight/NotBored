import React from 'react';
import { X } from 'lucide-react';
import { TAXONOMY , getTaxonomy} from '../constants/taxonomy';
import { useApp } from '../context/AppContext';
import { AnimatePresence, motion } from 'framer-motion';

/**
 * Barra horizontal de filtros por tag con scroll adaptativo.
 * @param {Set} activeTags - Set de IDs de tags activos
 * @param {Function} onToggleTag - Callback(tagId)
 * @param {Function} onRemoveTag - Desactivar un tag desde su chip
 * @param {Function} onClear - Callback para limpiar todos los filtros activos
 * @param {Boolean} hasFilters - Flag que determina si hay filtros de texto o tags activos
 */
export default function TagFilterBar({ activeTags, onToggleTag, onRemoveTag, onClear, hasFilters }) {
  const { t } = useApp();
  const activeTagList = [...activeTags].map(id => getTaxonomy(id));
  return (
    <div className='flex flex-col gap-2 px-4 mb-3'>
      <AnimatePresence>
        {activeTags.size > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className='overflow-hidden'
          >
          <div className='flex items-center gap-1.5 flex-wrap pt-1'>
          <span className='text-[10px] text-gray-600 uppercase tracking-widest'>
            {t('tagChips.activeFilters')}
          </span>
          {activeTagList.map(tax => (
            <motion.button
              key={tax.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={() => onRemoveTag(tax.id)}
              title={t('tagChips.removeTag')}
              className='flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold transition-all hover:brightness-125 active:scale-95'
              style={{
                backgroundColor: `${tax.color}25`,
                color: tax.color,
                border: `1px solid ${tax.color}50`,
              }}
              >
              <span>{tax.label}</span>
              <X size={10} strokeWidth={2.5} />
            </motion.button>
          ))}
          </div>
          </motion.div>
        )}
      </AnimatePresence>

    <div className='flex items-center gap-2 bg-card-bg/30 p-2 rounded-2xl border border-white/5 w-full overflow-hidden'>
      
      {/* Botón Limpiar — solo visible si hay algún filtro o tag activo */}
      {hasFilters && (
        <button
          type='button'
          onClick={onClear}
          className='flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-all flex-shrink-0 active:scale-95'
        >
          <X size={12} />
          <span>{t('character.clearFilters')}</span>
        </button>
      )}

      {/* Scroll horizontal de tags */}
      <div className='flex-1 flex items-center gap-1.5 overflow-x-auto thin-scrollbar'>
        {TAXONOMY.map(tax => {
          const isActive = activeTags.has(tax.id);
          
          return (
            <button
              key={tax.id}
              type='button'
              onClick={() => onToggleTag(tax.id)}
              className='flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer select-none active:scale-95 hover:brightness-110'
              style={{
                backgroundColor: isActive ? `${tax.color}25` : 'rgba(255, 255, 255, 0.02)',
                borderColor: isActive ? `${tax.color}60` : 'rgba(255, 255, 255, 0.05)',
                color: isActive ? tax.color : '#8E9196',
              }}
            >
              {tax.label}
            </button>
          );
        })}
      </div>

    </div>
    </div>
  );
}