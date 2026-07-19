import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, ChevronRight, UserCircle2, MapPinned, BookMarked,
  Brain, Mic2, ImagePlus, Languages, Image as ImageIcon,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import PersonaPicker from './PersonaPicker';
import ScenarioEditor from './ScenarioEditor';
import ChatWallpaperPicker from './ChatWallpaperPicker';

/**
 * Menú de ajustes del chat, en formato de lista escalable (inspirado en el
 * panel de "Chat Settings" de Moedark): una fila por función, cada una
 * navega a su propio panel en vez de amontonar todo en un solo formulario.
 *
 * Para añadir una función nueva en el futuro, basta con añadir una entrada
 * al array ROWS de abajo — no hace falta tocar el layout.
 */
export default function ChatSettingsMenu({
  isOpen,
  onClose,
  character,
  conversation,
  activePersona,
  onPersonaChange,
  onScenarioChange,
}) {
  const { t, getChatWallpaper } = useApp();
  const [subPanel, setSubPanel] = useState(null); // 'persona' | 'scenario' | 'wallpaper' | null

  if (!isOpen) return null;

  const hasWallpaper = !!getChatWallpaper(character.id);

  const ROWS = [
    {
      key: 'persona',
      icon: UserCircle2,
      label: t('chatSettingsMenu.persona'),
      value: activePersona ? activePersona.title : t('chatSettingsMenu.personaDefault'),
      onClick: () => setSubPanel('persona'),
    },
    {
      key: 'scenario',
      icon: MapPinned,
      label: t('chatSettingsMenu.scenario'),
      value: conversation?.scenarioOverride
        ? t('chatSettingsMenu.scenarioCustom')
        : t('chatSettingsMenu.scenarioDefault'),
      onClick: () => setSubPanel('scenario'),
    },
    {
      key: 'wallpaper',
      icon: ImageIcon,
      label: t('chatSettingsMenu.wallpaper'),
      value: hasWallpaper ? t('chatSettingsMenu.wallpaperActive') : t('chatSettingsMenu.wallpaperInactive'),
      onClick: () => setSubPanel('wallpaper'),
    },
    // --- Próximamente: añadir aquí siguiendo el mismo patrón ---
    { key: 'lorebooks', icon: BookMarked, label: t('chatSettingsMenu.lorebooks'), disabled: true },
    { key: 'memory', icon: Brain, label: t('chatSettingsMenu.memory'), disabled: true },
    { key: 'voice', icon: Mic2, label: t('chatSettingsMenu.voice'), disabled: true },
    { key: 'imageGen', icon: ImagePlus, label: t('chatSettingsMenu.imageGen'), disabled: true },
    { key: 'translation', icon: Languages, label: t('chatSettingsMenu.translation'), disabled: true },
  ];

  return (
    <AnimatePresence>
      {!subPanel && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className='absolute inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-end'
        onClick={onClose}
      >
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          onClick={e => e.stopPropagation()}
          className='w-full bg-card-bg rounded-t-3xl border-t border-white/10 p-4 max-h-[80%] overflow-y-auto'
        >
          <div className='flex items-center justify-between mb-4'>
            <button onClick={onClose} className='p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white'>
              <X size={18} />
            </button>
            <h3 className='text-white font-semibold'>{t('chatSettingsMenu.title')}</h3>
            <div className='w-8' /> {/* balancea el X para centrar el título */}
          </div>

          <div className='rounded-2xl overflow-hidden border border-white/10'>
            {ROWS.map((row, i) => (
              <button
                key={row.key}
                onClick={row.disabled ? undefined : row.onClick}
                disabled={row.disabled}
                className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors ${
                  i !== ROWS.length - 1 ? 'border-b border-white/5' : ''
                } ${row.disabled ? 'opacity-40 cursor-default' : 'hover:bg-white/5'}`}
              >
                <row.icon size={17} className={row.disabled ? 'text-gray-600' : 'text-accent'} />
                <span className={`flex-1 text-sm ${row.disabled ? 'text-gray-500' : 'text-white'}`}>
                  {row.label}
                </span>
                {row.value && (
                  <span className='text-xs text-gray-500 max-w-[40%] truncate'>{row.value}</span>
                )}
                {row.disabled ? (
                  <span className='text-[10px] uppercase tracking-wide text-gray-600 bg-white/5 px-1.5 py-0.5 rounded'>
                    {t('chatSettingsMenu.comingSoon')}
                  </span>
                ) : (
                  <ChevronRight size={15} className='text-gray-600 flex-shrink-0' />
                )}
              </button>
            ))}
          </div>
        </motion.div>
      </motion.div>
      )}

      <PersonaPicker
        isOpen={subPanel === 'persona'}
        onClose={() => setSubPanel(null)}
        characterId={character.id}
        characterName={character.name}
        onChange={onPersonaChange}
      />

      <ScenarioEditor
        isOpen={subPanel === 'scenario'}
        onClose={() => setSubPanel(null)}
        character={character}
        conversation={conversation}
        onSave={onScenarioChange}
      />

      <ChatWallpaperPicker
        isOpen={subPanel === 'wallpaper'}
        onClose={() => setSubPanel(null)}
        characterId={character.id}
      />
    </AnimatePresence>
  );
}
