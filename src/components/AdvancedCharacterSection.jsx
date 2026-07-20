import React from 'react';
import { Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react';

/**
 * Sección "Advanced" de la ficha de personaje — disponible tanto al crear
 * como al editar. Dos cosas:
 *  - writingStyle: descripción libre de cómo escribe el personaje.
 *  - advancedRules: lista de reglas puntuales "cuando salga el tema X,
 *    reacciona/responde así" — tienen prioridad sobre la personalidad
 *    general si hay contradicción (así lo inyecta buildCharacterSystemPrompt).
 */
export default function AdvancedCharacterSection({ writingStyle, advancedRules, onChange, t }) {
  const [expanded, setExpanded] = React.useState(false);

  function updateRule(id, patch) {
    onChange({
      advancedRules: advancedRules.map(r => (r.id === id ? { ...r, ...patch } : r)),
    });
  }

  function addRule() {
    onChange({
      advancedRules: [
        ...advancedRules,
        { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, trigger: '', behavior: '' },
      ],
    });
  }

  function removeRule(id) {
    onChange({ advancedRules: advancedRules.filter(r => r.id !== id) });
  }

  return (
    <div className='border border-white/10 rounded-xl overflow-hidden'>
      <button
        type='button'
        onClick={() => setExpanded(e => !e)}
        className='w-full flex items-center justify-between px-4 py-3 bg-card-bg hover:bg-white/5 transition-colors'
      >
        <span className='text-sm font-medium text-white'>{t('characterForm.advancedTitle')}</span>
        {expanded ? <ChevronDown size={16} className='text-gray-400' /> : <ChevronRight size={16} className='text-gray-400' />}
      </button>

      {expanded && (
        <div className='p-4 space-y-4 border-t border-white/10'>
          <p className='text-xs text-gray-500'>{t('characterForm.advancedSubtitle')}</p>

          {/* Estilo de escritura */}
          <div>
            <label className='text-xs text-gray-500 mb-1.5 block'>{t('characterForm.writingStyleLabel')}</label>
            <textarea
              value={writingStyle}
              onChange={e => onChange({ writingStyle: e.target.value })}
              placeholder={t('characterForm.writingStylePlaceholder')}
              rows={3}
              className='w-full bg-app-bg text-white text-sm rounded-xl px-3 py-2.5 border border-white/10 focus:border-accent/60 outline-none resize-none placeholder-gray-700'
            />
          </div>

          {/* Reglas de comportamiento */}
          <div>
            <label className='text-xs text-gray-500 mb-1.5 block'>{t('characterForm.rulesLabel')}</label>

            <div className='space-y-3'>
              {advancedRules.map((rule, i) => (
                <div key={rule.id} className='bg-app-bg rounded-xl p-3 border border-white/10 space-y-2'>
                  <div className='flex items-center justify-between'>
                    <span className='text-xs text-gray-600'>{t('characterForm.ruleNumber', { n: i + 1 })}</span>
                    <button
                      type='button'
                      onClick={() => removeRule(rule.id)}
                      className='p-1 rounded-lg hover:bg-white/10 text-gray-500 hover:text-red-400'
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <input
                    value={rule.trigger}
                    onChange={e => updateRule(rule.id, { trigger: e.target.value })}
                    placeholder={t('characterForm.ruleTriggerPlaceholder')}
                    className='w-full bg-card-bg text-white text-sm rounded-lg px-3 py-2 border border-white/10 focus:border-accent/60 outline-none placeholder-gray-700'
                  />
                  <textarea
                    value={rule.behavior}
                    onChange={e => updateRule(rule.id, { behavior: e.target.value })}
                    placeholder={t('characterForm.ruleBehaviorPlaceholder')}
                    rows={2}
                    className='w-full bg-card-bg text-white text-sm rounded-lg px-3 py-2 border border-white/10 focus:border-accent/60 outline-none resize-none placeholder-gray-700'
                  />
                </div>
              ))}
            </div>

            <button
              type='button'
              onClick={addRule}
              className='w-full flex items-center justify-center gap-2 mt-3 py-2.5 rounded-xl border border-dashed border-white/20 text-gray-400 hover:text-white hover:border-white/40 text-sm'
            >
              <Plus size={14} /> {t('characterForm.addRule')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
