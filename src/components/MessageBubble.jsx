import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Pencil, Trash2, RotateCcw, Check, X, Copy, Scissors, ChevronLeft, ChevronRight } from 'lucide-react';
import { useApp } from '../context/AppContext';


export default function MessageBubble({
  message,
  characterAvatar,
  isStreaming,
  characterName,
  isLast,
  onDelete,
  onDeleteFrom,
  onEdit,
  onRegenerate,
  variantInfo,
}) {
  const isUser = message.role === 'user';
  const { t } = useApp();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const [showActions, setShowActions] = useState(false);
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard?.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  // Renderiza *texto* en cursiva (estilizado) para acciones de roleplay
  function renderContent(text) {
    const parts = text.split(/(\*[^*]+\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('*') && part.endsWith('*')) {
        return (
          <em key={i} className='text-gray-400 not-italic font-normal'>
            {part.slice(1, -1)}
          </em>
        );
      }
      return <span key={i}>{part}</span>;
    });
  }

  function handleSaveEdit() {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== message.content) {
      onEdit?.(message.id, trimmed);
    }
    setEditing(false);
  }

  const canShowActions = !isStreaming && !editing && (onDelete || onDeleteFrom || onEdit || onRegenerate);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex items-end gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}
    >
    {/* Avatar del AI */}
    {!isUser && (
        <div className='w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center overflow-hidden flex-shrink-0 mb-0.5'>
          {characterAvatar?.startsWith('data:') ? (
            <img
              src={characterAvatar}
              alt={t('chat.avatarAlt').replace('{{name}}', characterName || 'AI')}
              className='w-full h-full object-cover'
            />
          ) : (
            <span className='text-sm'>
              {characterAvatar || '👤'}
            </span>
          )}
        </div>
      )}

      <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-[78%]`}>
        {/* Bubble — tocarla muestra/oculta las acciones (editar/borrar/regenerar) */}
        <div
          onClick={() => canShowActions && setShowActions(p => !p)}
          className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
            isUser
              ? 'bg-msg-user text-white rounded-br-sm'
              : 'bg-msg-ai text-gray-100 rounded-bl-sm border border-white/5'
          }`}
        >
          {editing ? (
            <div className='flex flex-col gap-2 min-w-[180px]'>
              <textarea
                autoFocus
                value={draft}
                onChange={e => setDraft(e.target.value)}
                rows={Math.min(6, Math.max(2, draft.split('\n').length))}
                className='bg-black/20 rounded-lg p-2 text-sm text-white outline-none resize-none w-full'
              />
              <div className='flex justify-end gap-2'>
                <button
                  onClick={() => { setDraft(message.content); setEditing(false); }}
                  className='p-1.5 rounded-lg hover:bg-white/10 text-gray-300'
                >
                  <X size={14} />
                </button>
                <button
                  onClick={handleSaveEdit}
                  className='p-1.5 rounded-lg hover:bg-white/10 text-green-400'
                >
                  <Check size={14} />
                </button>
              </div>
            </div>
          ) : (
            <p className='whitespace-pre-wrap break-words'>
              {renderContent(message.content)}

              {isStreaming && (
                <span className='inline-block w-0.5 h-3.5 bg-accent ml-0.5 animate-pulse align-middle' />
              )}
            </p>
          )}

          {message.pending && !isStreaming && (
            <p className='text-xs mt-1 text-yellow-400/80'>
              ⚠️ Respuesta interrumpida — puede estar incompleta
            </p>
          )}

          {/* Timestamp */}
          {message.timestamp && !editing && (
            <p className='text-xs mt-1 opacity-40 text-right'>
              {message.edited ? '✎ ' : ''}
              {new Date(message.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
          )}
        </div>

        {/* Acciones: aparecen al tocar la burbuja */}
        {showActions && canShowActions && (
          <div className='flex items-center gap-1 mt-1 px-1'>
            {onEdit && (
              <button
                onClick={() => { setEditing(true); setShowActions(false); }}
                className='p-1.5 rounded-lg hover:bg-white/10 text-gray-500 hover:text-white'
                title={t('messageActions.edit')}
              >
                <Pencil size={12} />
              </button>
            )}
            {!isUser && isLast && onRegenerate && (
              <button
                onClick={() => { onRegenerate(); setShowActions(false); }}
                className='p-1.5 rounded-lg hover:bg-white/10 text-gray-500 hover:text-white'
                title={t('messageActions.regenerate')}
              >
                <RotateCcw size={12} />
              </button>
            )}
            <button
              onClick={() => { handleCopy(); }}
              className='p-1.5 rounded-lg hover:bg-white/10 text-gray-500 hover:text-white'
              title={copied ? t('messageActions.copied') : t('messageActions.copy')}
            >
              {copied ? <Check size={12} className='text-green-400' /> : <Copy size={12} />}
            </button>
            {onDelete && (
              <button
                onClick={() => { onDelete(message.id); setShowActions(false); }}
                className='p-1.5 rounded-lg hover:bg-white/10 text-gray-500 hover:text-red-400'
                title={t('messageActions.delete')}
              >
                <Trash2 size={12} />
              </button>
            )}
            {isUser && onDeleteFrom && (
              <button
                onClick={() => { onDeleteFrom(message.id); setShowActions(false); }}
                className='p-1.5 rounded-lg hover:bg-white/10 text-gray-500 hover:text-red-400'
                title={t('messageActions.deleteFrom')}
              >
                <Scissors size={12} />
              </button>
            )}
          </div>
        )}

        {variantInfo && (
          <div className='flex items-center gap-2 mt-1 px-1'>
            <button
              onClick={variantInfo.onPrev}
              disabled={variantInfo.index === 0}
              className='p-1 rounded-lg hover:bg-white/10 text-gray-500 hover:text-white disabled:opacity-30'
            >
              <ChevronLeft size={13} />
            </button>
            <span className='text-xs text-gray-600'>{variantInfo.index + 1}/{variantInfo.total}</span>
            <button
              onClick={variantInfo.onNext}
              disabled={variantInfo.index === variantInfo.total - 1}
              className='p-1 rounded-lg hover:bg-white/10 text-gray-500 hover:text-white disabled:opacity-30'
            >
              <ChevronRight size={13} />
            </button>
          </div>
        )}
      </div>

    </motion.div>
  );
}
