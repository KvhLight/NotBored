import React from 'react';
import { motion } from 'framer-motion';
import { useApp } from '../context/AppContext';


export default function MessageBubble({ message, characterAvatar, isStreaming, characterName }) {
  const isUser = message.role === 'user';
  const { t } = useApp();
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
      {/* Bubble */}
      <div className={`max-w-[78%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
        isUser
          ? 'bg-msg-user text-white rounded-br-sm'
          : 'bg-msg-ai text-gray-100 rounded-bl-sm border border-white/5'
      }`}
      >
        <p className='whitespace-pre-wrap break-words'>
          {renderContent(message.content)}
          
          {isStreaming && (
            <span className='inline-block w-0.5 h-3.5 bg-accent ml-0.5 animate-pulse align-middle' />
          )}
        </p>

        {/* Timestamp */}
        {message.timestamp && (
          <p className='text-xs mt-1 opacity-40 text-right'>
            {new Date(message.timestamp).toLocaleTimeString([], {
              hour: '2-digit', 
              minute: '2-digit'
            })}
          </p>
        )}
      </div>

    </motion.div>
  );
}