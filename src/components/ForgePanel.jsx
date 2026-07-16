import React, { useState } from 'react';
import { Wand2, Save, RefreshCw, Loader2, ChevronDown, ChevronUp, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../context/AppContext'; 

const IDEA_EXAMPLES = [
  'Un pirata fantasma que busca redención',
  'Una científica loca obsesionada con el tiempo',
  'Un dragón anciano cansado de ser temido',
  'Una detective cínica en una ciudad noir cyberpunk',
  'Un mago bibliotecario guardián de secretos prohibidos',
];

export default function ForgePanel({ creationMode,
  onBack }) {
  const [idea, setIdea] = useState('');
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(null);
  const [error, setError] = useState('');
  const [expandedField, setExpandedField] = useState(null);
  const [saving, setSaving] = useState(false);
  const { t } = useApp(); 
  
  const previewFields = [
    { key: 'description', label: t('forge.fields.description') },
    { key: 'personality', label: t('forge.fields.personality') },
    { key: 'scenario', label: t('forge.fields.scenario') },
    { key: 'systemPrompt', label: t('forge.fields.systemPrompt') },
    { key: 'greetingMsg', label: t('forge.fields.greetingMsg') },
    { key: 'secretMotivation', label: t('forge.fields.secretMotivation') },
  ];

  async function handleForge() {
    if (!idea.trim()) return;
    setLoading(true);
    setError('');
    setGenerated(null);
    try {
      const result = await window.electronAPI.forge.generateCharacter(idea.trim());
      if (result.success) {
        setGenerated(result.character);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('Error de conexión con la API.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!generated) return;
    setSaving(true);
    
    // Extraer solo los campos que usa el schema de personaje
    const { secretMotivation, ...charData } = generated;
    
    // Añadir la motivación secreta al systemPrompt para que el modelo la conozca
    charData.systemPrompt += `\n\nMOTIVACIÓN SECRETA (no la reveles directamente):\n${secretMotivation}`;
    
    await onSaveCharacter(charData);
    setSaving(false);
  }

  function updateField(key, value) {
    setGenerated(prev => ({ ...prev, [key]: value }));
  }

  return (
    <div className='flex flex-col h-full bg-app-bg text-white'>

      {/* Header */}
      <div className='flex items-center justify-between px-4 pt-12 pb-3 border-b border-white/10'>
        <button
          onClick={onBack}
          className='p-2 rounded-xl hover:bg-white/10 text-gray-400'
        >
          <X size={18} />
        </button>
          <h2 className='text-base font-bold text-white'>
            {t('forge.title')}
          </h2>

        {/* Espaciador para mantener el título centrado */}
        <div className='w-10' />
      </div>
      <div className='flex-1 overflow-y-auto px-4 py-4 space-y-4 hidden-scrollbar'>
        
        {/* Input de idea */}
        <div className='space-y-2'>
          <textarea
            value={idea}
            onChange={e => setIdea(e.target.value)}
            placeholder={t('forge.placeholder')}
            rows={3}
            className='w-full bg-card-bg text-white text-sm rounded-xl px-3 py-3 border border-white/10 focus:border-accent/60 outline-none resize-none placeholder-gray-700 transition-colors'
          />
        </div>
        {/* Ejemplos rápidos */}
        <div className='flex flex-wrap gap-1.5 mt-2'>
          {(t('forge.examples') || []).map((example, i) => (
            <button
              key={i}
              type='button'
              onClick={() => setIdea(example)}
              className='text-xs bg-card-bg border border-white/10 text-gray-400 px-2.5 py-1 rounded-full hover:border-accent/40 hover:text-accent transition-all'
            >
              {example}
            </button>
          ))}
        </div>
        {/* Botón Forjar */}
        <button
          type='button'
          onClick={handleForge}
          disabled={!idea.trim() || loading}
          className='w-full flex items-center justify-center gap-2 py-3 bg-accent text-white rounded-2xl text-sm font-bold hover:bg-accent/90 transition-colors disabled:opacity-40'
        >
          {loading ? (
            <>
              <Loader2 size={16} className='animate-spin' /> 
              <span>{t('forge.generating')}</span>
            </>
          ) : (
            <>
              <Wand2 size={16} /> 
              <span>{t('forge.generate')}</span>
            </>
          )}
        </button>

        {error && (
          <p className='text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2'>
            {t('forge.errorPrefix')} {error}
          </p>
        )}

        {/* Preview y edición del resultado */}
        <AnimatePresence>
          {generated && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className='space-y-3'
            >
              {/* Cabecera del personaje generado */}
              <div className='flex items-center gap-3 bg-card-bg rounded-2xl p-3 border border-accent/20'>
                <div className='w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center text-2xl select-none'>
                  {generated.avatar}
                </div>
                <div className='flex-1 min-w-0'>
                  <p className='font-bold text-white truncate'>{generated.name}</p>
                  <div className='flex flex-wrap gap-1 mt-0.5'>
                    {generated.tags?.map(tag => (
                      <span 
                        key={tag}
                        className='text-[10px] font-semibold bg-accent/20 text-accent px-2 py-0.5 rounded-full'
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                
                {/* Regenerar */}
                <button 
                  type='button'
                  onClick={handleForge}
                  className='p-2 rounded-xl hover:bg-white/10 text-gray-500 hover:text-white transition-colors'
                  title={t('forge.regenerate')}
                >
                  <RefreshCw size={14} />
                </button>
              </div>

              {/* Campos expandibles y editables */}
              {previewFields.map(({ key, label }) => (
                <div 
                  key={key} 
                  className='bg-card-bg rounded-xl border border-white/5 overflow-hidden'
                >
                  <button
                    type='button'
                    onClick={() => setExpandedField(expandedField === key ? null : key)}
                    className='w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-white/5 transition-colors'
                  >
                    <span className='text-xs font-medium text-gray-300'>{label}</span>
                    {expandedField === key ? (
                      <ChevronUp size={13} className='text-gray-500' />
                    ) : (
                      <ChevronDown size={13} className='text-gray-500' />
                    )}
                  </button>
                  
                  <AnimatePresence initial={false}>
                    {expandedField === key && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className='overflow-hidden'
                      >
                        <textarea
                          value={generated[key] || ''}
                          onChange={e => updateField(key, e.target.value)}
                          rows={4}
                          className='w-full bg-transparent text-gray-300 text-xs px-3 pb-3 outline-none resize-none leading-relaxed hidden-scrollbar'
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}

              {/* Guardar permanentemente */}
              <button 
                type='button'
                onClick={handleSave} 
                disabled={saving}
                className='w-full flex items-center justify-center gap-2 py-3 bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 rounded-2xl text-sm font-bold hover:bg-emerald-600/30 transition-colors disabled:opacity-40'
              >
                <Save size={15} />
                {saving ? t('forge.saving') : t('forge.saveToWorld')}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        
        <div className='h-6' />
      </div>
    </div>
  );
  }