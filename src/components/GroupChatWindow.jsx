import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Users, Send, Square, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import MessageBubble from './MessageBubble';
import SpeakerPicker from './SpeakerPicker';
import MemoryPanel from './MemoryPanel';
import { useApp } from '../context/AppContext';
import { generateMemories } from '../services/memoryAnalysis';
import { buildMemoriesBlock } from '../services/webAdapter';
import { buildGroupHistory, buildGroupSystemContext, resolveSpeakerName, suggestNextSpeaker } from '../services/groupChat';

export default function GroupChatWindow({ group, characters, conversation, onBack }) {
  const { t, userProfile, getUserContextBlock } = useApp();
  const [messages, setMessages] = useState(conversation.messages || []);
  const [inputText, setInputText] = useState('');
  const [inputMode, setInputMode] = useState('picker'); // 'picker' | 'keyboard'
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeSpeakerId, setActiveSpeakerId] = useState(null); // quién está "escribiendo" ahora
  const [streamBuffer, setStreamBuffer] = useState('');
  const [showSpeakerPicker, setShowSpeakerPicker] = useState(false);
  const [suggestedSpeakerId, setSuggestedSpeakerId] = useState(null);
  const [showMemoryPanel, setShowMemoryPanel] = useState(false);
  const [memoryPopup, setMemoryPopup] = useState(false);
  const [error, setError] = useState(null);

  const convId = conversation.id;
  const bottomRef = useRef(null);
  const pendingMsgId = useRef(null);
  const messagesRef = useRef(messages);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamBuffer]);

  // ---- Listeners de streaming (comparten la misma IA que el chat 1 a 1) ----
  useEffect(() => {
    let chunkCount = 0;

    async function maybeAutoGenerateMemories(finalMessages) {
      try {
        const settings = await window.electronAPI.settings.get();
        if (settings.autoMemoryEnabled === false) return;
        const interval = settings.autoMemoryInterval || 10;
        const lastCount = await window.electronAPI.groupConversations.getLastMemoryMessageCount(convId);
        if (finalMessages.length - lastCount < interval) return;
        const activeCharacter = characters.find(c => c.id === activeSpeakerId) || characters[0];
        const result = await generateMemories({ conversationId: convId, character: activeCharacter, messages: finalMessages, isGroup: true });
        if (result.success && result.added.length > 0) setMemoryPopup(true);
      } catch {
        // si falla, no interrumpimos el chat por ello
      }
    }

    window.electronAPI.ai.onChunk(chunk => {
      setStreamBuffer(prev => {
        const next = prev + chunk;
        chunkCount++;
        if (pendingMsgId.current && chunkCount % 8 === 0) {
          window.electronAPI.groupConversations.patchMessage(convId, pendingMsgId.current, { content: next });
        }
        return next;
      });
    });

    window.electronAPI.ai.onDone(async () => {
      let capturedContent = '';
      let capturedMsgId = null;
      let capturedSpeaker = null;

      setStreamBuffer(prev => {
        capturedContent = prev;
        capturedMsgId = pendingMsgId.current;
        capturedSpeaker = activeSpeakerId;

        setMessages(m => [...m, {
          id: capturedMsgId,
          role: 'assistant',
          speakerId: capturedSpeaker,
          content: capturedContent,
          timestamp: Date.now(),
          pending: false,
        }]);

        if (capturedMsgId) {
          window.electronAPI.groupConversations.patchMessage(convId, capturedMsgId, { content: capturedContent, pending: false });
        }
        pendingMsgId.current = null;
        return '';
      });

      setIsStreaming(false);
      setActiveSpeakerId(null);
      maybeAutoGenerateMemories([...messagesRef.current, {
        id: capturedMsgId, role: 'assistant', speakerId: capturedSpeaker, content: capturedContent,
      }]);
    });

    window.electronAPI.ai.onError(errMsg => {
      setError(errMsg);
      setIsStreaming(false);
      setActiveSpeakerId(null);
      setStreamBuffer('');
      pendingMsgId.current = null;
    });

    return () => window.electronAPI.ai.removeListeners();
  }, [convId, characters, activeSpeakerId]);

  function charById(id) {
    return characters.find(c => c.id === id);
  }

  function speakerDisplayName(speakerId) {
    if (speakerId === 'user') return userProfile?.alias || t('group.you');
    return charById(speakerId)?.name || t('group.someone');
  }

  async function openSpeakerPicker() {
    setShowSpeakerPicker(true);
    setSuggestedSpeakerId(null);
    const id = await suggestNextSpeaker({ messages, characters, group });
    setSuggestedSpeakerId(id);
  }

  async function handleSelectSpeaker(speakerId) {
    setShowSpeakerPicker(false);
    if (speakerId === 'user') {
      setInputMode('keyboard');
    } else {
      await handleCharacterSpeak(speakerId);
    }
  }

  async function sendUserMessage() {
    const text = inputText.trim();
    if (!text || isStreaming) return;
    setInputText('');
    const newMsg = await window.electronAPI.groupConversations.appendMessage(convId, {
      role: 'user',
      speakerId: 'user',
      content: text,
    });
    setMessages(m => [...m, newMsg]);
    setInputMode('picker');
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendUserMessage();
    }
  }

  async function getUserContextBlockFor(characterId) {
    const selection = await window.electronAPI.personas.getSelection(characterId);
    if (selection.enabled && selection.personaId) {
      const all = await window.electronAPI.personas.getAll();
      const persona = all.find(p => p.id === selection.personaId);
      if (persona) {
        return [
          '=== USUARIO ===',
          `El usuario se llama ${persona.name}.`,
          persona.description || '',
          'Recuerda esta información y trátalo acorde a ella durante toda la conversación.',
        ].filter(Boolean).join('\n');
      }
    }
    return getUserContextBlock();
  }

  async function handleCharacterSpeak(characterId) {
    if (isStreaming) return;
    const character = charById(characterId);
    if (!character) return;

    setError(null);
    setIsStreaming(true);
    setActiveSpeakerId(characterId);

    const otherCharacters = characters.filter(c => c.id !== characterId);
    const nameResolver = (speakerId) => resolveSpeakerName(speakerId, {
      characters,
      userDisplayName: userProfile?.alias || t('group.you'),
    });

    const fullHistory = buildGroupHistory({ messages, currentCharacterId: characterId, nameResolver });
    const lastEntry = fullHistory[fullHistory.length - 1];
    const history = fullHistory.slice(0, -1);
    const userMessage = lastEntry?.content || '*(La escena empieza ahora — actúa con naturalidad)*';

    const memories = await window.electronAPI.groupConversations.getMemories(convId);
    const scenarioOverride = buildGroupSystemContext({ group, otherCharacters, currentCharacter: character });
    const userContextBlock = await getUserContextBlockFor(characterId);

    const placeholder = await window.electronAPI.groupConversations.appendMessage(convId, {
      role: 'assistant',
      speakerId: characterId,
      content: '',
    });
    await window.electronAPI.groupConversations.patchMessage(convId, placeholder.id, { pending: true });
    pendingMsgId.current = placeholder.id;

    try {
      await window.electronAPI.ai.sendMessage({
        character,
        history,
        userMessage,
        userContextBlock,
        scenarioOverride,
        memoriesBlock: buildMemoriesBlock(memories),
      });
    } catch {
      // el error llega por el listener onError
    }
  }

  function handleStop() {
    window.electronAPI.ai.stopGeneration?.();
  }

  async function handleDeleteMessage(messageId) {
    await window.electronAPI.groupConversations.deleteMessage?.(convId, messageId);
    setMessages(m => m.filter(msg => msg.id !== messageId));
  }

  return (
    <div className='flex flex-col h-full relative bg-app-bg'>
      {/* Header */}
      <div className='flex items-center gap-3 px-4 pt-12 pb-3 bg-card-bg border-b border-white/5'>
        <button onClick={onBack} className='p-2 rounded-xl hover:bg-white/10 text-gray-400'>
          <ArrowLeft size={18} />
        </button>

        <div className='flex -space-x-2 flex-shrink-0'>
          {characters.slice(0, 3).map(c => (
            <div key={c.id} className='w-8 h-8 rounded-full bg-accent/20 border-2 border-card-bg flex items-center justify-center overflow-hidden'>
              {c.avatar?.startsWith('data:') ? (
                <img src={c.avatar} alt={c.name} className='w-full h-full object-cover' />
              ) : (
                <span className='text-sm'>{c.avatar || '👤'}</span>
              )}
            </div>
          ))}
        </div>

        <div className='flex-1 min-w-0'>
          <p className='font-semibold text-white text-sm truncate'>{group.name}</p>
          <p className='text-xs text-accent-2'>
            {isStreaming ? t('group.someoneIsTyping', { name: speakerDisplayName(activeSpeakerId) }) : t('group.membersCount', { count: characters.length })}
          </p>
        </div>

        <button onClick={() => setShowMemoryPanel(true)} className='p-2 rounded-xl hover:bg-white/10 text-gray-400'>
          <Users size={18} />
        </button>
      </div>

      {memoryPopup && (
        <div className='mx-4 mt-2 flex items-center gap-2 bg-accent/15 border border-accent/30 rounded-xl px-3 py-2'>
          <span className='text-xs flex-1 text-white'>{t('memory.autoPopup')}</span>
          <button onClick={() => setMemoryPopup(false)} className='text-gray-400 hover:text-white p-0.5'>×</button>
        </div>
      )}

      {/* Mensajes */}
      <div className='flex-1 overflow-y-auto px-4 py-4 space-y-3'>
        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <div key={msg.id}>
              {msg.role === 'assistant' && (
                <p className='text-xs text-gray-600 mb-1 ml-10'>{speakerDisplayName(msg.speakerId)}</p>
              )}
              <MessageBubble
                message={msg}
                characterAvatar={charById(msg.speakerId)?.avatar}
                characterName={speakerDisplayName(msg.speakerId)}
                isLast={i === messages.length - 1}
                onDelete={handleDeleteMessage}
              />
            </div>
          ))}

          {isStreaming && streamBuffer && (
            <div>
              <p className='text-xs text-gray-600 mb-1 ml-10'>{speakerDisplayName(activeSpeakerId)}</p>
              <MessageBubble
                message={{ role: 'assistant', content: streamBuffer }}
                characterAvatar={charById(activeSpeakerId)?.avatar}
                characterName={speakerDisplayName(activeSpeakerId)}
                isStreaming
              />
            </div>
          )}
          {isStreaming && !streamBuffer && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className='flex items-center gap-1 px-4 py-3 bg-msg-ai rounded-2xl rounded-tl-sm w-fit ml-10'>
              {[0, 1, 2].map(i => (
                <motion.div key={i} animate={{ y: [0, -4, 0] }} transition={{ duration: 0.6, delay: i * 0.15, repeat: Infinity }} className='w-1.5 h-1.5 bg-accent rounded-full' />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <div className='text-center text-red-400 text-xs bg-red-500/10 rounded-xl px-3 py-2'>{error}</div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Barra inferior: botón de elegir quién habla, o teclado si te toca a ti */}
      <div className='px-4 pb-4 pt-2'>
        {inputMode === 'picker' ? (
          <button
            onClick={openSpeakerPicker}
            disabled={isStreaming}
            className='w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-card-bg border border-white/10 text-white disabled:opacity-50 hover:border-accent/50 transition-colors'
          >
            {isStreaming ? <Loader2 size={16} className='animate-spin text-accent' /> : <Users size={16} className='text-accent' />}
            {isStreaming ? t('group.waitingForResponse') : t('group.chooseWhoSpeaks')}
          </button>
        ) : (
          <div className='flex items-end gap-2 bg-card-bg rounded-2xl p-2 border border-accent/50'>
            <textarea
              autoFocus
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('group.typePlaceholder', { name: group.name })}
              className='flex-1 bg-transparent text-sm text-white placeholder-gray-600 outline-none resize-none max-h-32 py-2 px-2 leading-5'
              style={{ fieldSizing: 'content' }}
            />
            <button
              onClick={sendUserMessage}
              disabled={!inputText.trim()}
              className='p-2.5 bg-accent rounded-xl text-white disabled:opacity-40 hover:bg-accent/80 transition-colors flex-shrink-0'
            >
              <Send size={16} />
            </button>
          </div>
        )}

        {isStreaming && (
          <button
            onClick={handleStop}
            className='w-full flex items-center justify-center gap-2 mt-2 py-2 rounded-xl text-xs text-gray-400 hover:text-white'
          >
            <Square size={12} /> {t('chat.stop')}
          </button>
        )}
      </div>

      <SpeakerPicker
        isOpen={showSpeakerPicker}
        onClose={() => setShowSpeakerPicker(false)}
        characters={characters}
        userLabel={userProfile?.alias || t('group.you')}
        suggestedSpeakerId={suggestedSpeakerId}
        onSelect={handleSelectSpeaker}
      />

      <MemoryPanel
        isOpen={showMemoryPanel}
        onClose={() => setShowMemoryPanel(false)}
        conversationId={convId}
        character={{ name: group.name }}
        messages={messages}
        isGroup
      />
    </div>
  );
}
