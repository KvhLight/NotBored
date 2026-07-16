import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, MessageCircle, Check, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../context/AppContext';

/**
 * Panel lateral de sesiones de un personaje.
 * @param {Object} character - Personaje activo
 * @param {String} activeId - ID de la sesión activa
 * @param {Function} onSelectSession - Callback al seleccionar sesión
 * @param {Function} onNewSession - Callback para crear nueva sesión
 * @param {Function} onClose - Cerrar el panel
 */
export default function SessionList({
  character, activeId, onSelectSession, onNewSession, onClose
}) {
  const [sessions, setSessions] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [confirmDel, setConfirmDel] = useState(null);
  const { t } = useApp();

  useEffect(() => {
    loadSessions();
  }, [character.id]);

  async function loadSessions() {
    const convs = await window.electronAPI.conversations.byCharacter(character.id);
    
    setSessions(convs);
  }

  async function handleRename(id) {
    if (!editingTitle.trim()) return;
    await window.electronAPI.conversations.rename(id, editingTitle.trim());
    setEditingId(null);
    loadSessions();
  }

  async function handleDelete(id) {
    if (confirmDel === id) {
      await window.electronAPI.conversations.delete(id);
      setConfirmDel(null);
      loadSessions();
      // Si eliminamos la sesión activa, volver al listado
      if (id === activeId) onClose();
    } else {
      setConfirmDel(id);
      setTimeout(() => setConfirmDel(null), 3000);
    }
  }
  

  function formatRelativeDate(ts) {
  const diff = Date.now() - ts;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);

  if (seconds < 10) return t('sessionList.relativeTime.now');
  if (seconds < 60) return t('sessionList.relativeTime.seconds', {count:seconds});

  if (minutes === 1) return t('sessionList.relativeTime.minute');
  if (minutes < 60) return t('sessionList.relativeTime.minutes', {count:minutes});

  if (hours === 1) return t('sessionList.relativeTime.hour');
  if (hours < 24) return t('sessionList.relativeTime.hours', {count:hours});

  if (days === 1) return t('sessionList.relativeTime.yesterday');
  if (days < 7) return t('sessionList.relativeTime.days', {count:days});

  if (weeks === 1) return t('sessionList.relativeTime.week');
  if (weeks < 5) return t('sessionList.relativeTime.weeks', {count:weeks});

  if (months === 1) return t('sessionList.relativeTime.month');
  return t('sessionList.relativeTime.months', {count:months});
  }

  function getDisplayTitle(session) {
    if (
      session.title !== t('sessionList.newConversation')&&
      session.title?.trim()
    ) {
      return session.title;
    }

    if (session.messages?.length > 0) {
      return session.messages[0].content.slice(0, 40);
    }

    return t('sessionList.newConversation');
  }

  return (
    <div className='flex flex-col h-full w-full bg-app-bg text-white'>
      
      {/* Header */}
      <div className='px-4 pt-12 pb-4 border-b border-white/5 flex flex-col gap-1'>
        <div className='flex items-center justify-between'>
          <h3 className='text-xs font-semibold text-gray-400 uppercase tracking-wider'>
            {t('sessionList.title')}
          </h3>
          <button 
            onClick={onClose}
            className='p-1 rounded-md hover:bg-white/5 text-gray-500 hover:text-white transition-colors'
          >
            <X size={14} />
          </button>
        </div>
        <span className='text-sm font-bold text-accent truncate block'>
          {character.name}
        </span>
      </div>

      {/* Session List */}
      <div className='flex-1 overflow-y-auto p-3 space-y-2 hidden-scrollbar'>
        <AnimatePresence initial={false}>
          {sessions.map((session) => (
            <motion.div
              key={session.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -10 }}
              onClick={() => onSelectSession(session)}
              className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col gap-1.5 relative group ${
                session.id === activeId
                  ? 'bg-accent/10 border-accent/30 shadow-md shadow-accent/5'
                  : 'bg-card-bg border-white/5 hover:border-white/10'
              }`}
            >
              <div className='flex items-center justify-between gap-2 w-full'>
                {/* Título editable */}
                {editingId === session.id ? (
                  <div className='flex items-center gap-1 flex-1' onClick={e => e.stopPropagation()}>
                    <input
                      type='text'
                      autoFocus
                      value={editingTitle}
                      onChange={e => setEditingTitle(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleRename(session.id);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      className='flex-1 bg-app-bg text-white text-xs rounded-lg px-2 py-1 border border-accent/60 outline-none'
                    />
                    <button 
                      onClick={() => handleRename(session.id)}
                      className='p-1 text-emerald-400 hover:bg-emerald-400/10 rounded-md transition-colors'
                    >
                      <Check size={14} />
                    </button>
                    <button 
                      onClick={() => setEditingId(null)}
                      className='p-1 text-red-400 hover:bg-red-400/10 rounded-md transition-colors'
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <span className='text-xs font-semibold truncate flex-1 pr-12 group-hover:text-accent transition-colors'>
                    {getDisplayTitle(session) || t('sessionList.untitled')}
                  </span>
                )}

                {/* Acciones flotantes integradas (visibles en Hover) */}
                {editingId !== session.id && (
                  <div 
                    className='absolute right-2 top-2 hidden group-hover:flex items-center gap-0.5 bg-card-bg/90 backdrop-blur-sm pl-1 rounded-md'
                    onClick={e => e.stopPropagation()}
                  >
                    <button 
                      onClick={() => { 
                        setEditingId(session.id);
                        setEditingTitle(session.title || ''); 
                      }}
                      className='p-1.5 rounded-md hover:bg-white/5 text-gray-400 hover:text-white transition-colors'
                      title={t('sessionList.renameTooltip')}
                    >
                      <Edit2 size={12} />
                    </button>
                    <button 
                      onClick={() => handleDelete(session.id)}
                      className={`p-1.5 rounded-md transition-all ${
                        confirmDel === session.id
                          ? 'bg-red-500/20 text-red-400 ring-1 ring-red-500/30'
                          : 'hover:bg-red-500/10 text-gray-400 hover:text-red-400'
                      }`}
                      title={confirmDel === session.id ? t('sessionList.confirmDeleteTooltip') : t('sessionList.deleteTooltip')}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                )}
              </div>

              <p className='text-xs text-gray-400 truncate'>
                {session.messages?.length > 0
                  ? session.messages[session.messages.length - 1].content
                  : t('sessionList.noMessages')}
              </p>
              {/* Metadatos de la Sesión -posiblemente inutil, eliminar si ocupa demasiado proceso de memoria */}
              <div className='flex items-center gap-1.5 text-[10px] text-gray-500 font-medium'>
                <MessageCircle size={10} className='text-gray-600' />
                <span>{session.messages?.length || 0} {t('sessionList.messagesCount')}</span>
                <span>•</span>
                <span className='truncate'>{formatRelativeDate(session.lastActivity || Date.now())}</span>
              </div>

            </motion.div>
          ))}
        </AnimatePresence>

        {/* Estado Vacío */}
        {sessions.length === 0 && (
          <div className='flex flex-col items-center justify-center p-8 text-center border border-dashed border-white/5 rounded-2xl bg-card-bg/30 mt-4'>
            <MessageCircle size={24} className='text-gray-700 mb-2' />
            <p className='text-xs font-medium text-gray-500'>{t('sessionList.emptyState')}</p>
          </div>
        )}
      </div>

      {/* Footer Button: Nueva Línea Temporal */}
      <div className='p-3 border-t border-white/5 bg-app-bg'>
        <button
          type='button'
          onClick={onNewSession}
          className='w-full bg-accent hover:bg-accent-hover text-white text-xs font-semibold py-2.5 rounded-xl flex items-center justify-center gap-1.5 shadow-lg shadow-accent/10 transition-all active:scale-[0.98]'
        >
          <Plus size={14} />
          {t('sessionList.newTimelineBtn')}
        </button>
      </div>

    </div>
  );
}