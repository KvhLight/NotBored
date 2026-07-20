import	React,	{	useState,	useEffect,	useRef	}	from	'react';
import	{	History,	ArrowLeft,	Plus,	Send,	Loader2,	X,	Square,	UserCircle2,	Menu,	SkipForward	}	from	'lucide-react';
import	{	motion,	AnimatePresence	}	from	'framer-motion';
import	MessageBubble	from	'./MessageBubble';
import	PersonaPicker	from	'./PersonaPicker';
import	ChatSettingsMenu	from	'./ChatSettingsMenu';
import	{	useApp	}	from	'../context/AppContext';
import { generateMemories } from '../services/memoryAnalysis';
import { buildMemoriesBlock } from '../services/webAdapter';

export	default	function	ChatWindow({	character,	conversation,	onBack,	onNewChat,	onShowSessions	})	{
		const	[messages,	setMessages]	=	useState(conversation.messages	||	[]);
		const	[inputText,	setInputText]	=	useState('');
		const	[isStreaming,	setIsStreaming]	=	useState(false);
		const	[streamBuffer,	setStreamBuffer]	=	useState('');
		const	[error,	setError]	=	useState(null);
		const	{	t,	getChatWallpaper,	getUserContextBlock	}	=	useApp();
		const	bottomRef	=	useRef(null);
		const	inputRef	=	useRef(null);
		const	pendingAiMsgId	=	useRef(null);
  const messagesRef = useRef(messages);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  const [memoryPopup, setMemoryPopup] = useState(false);
  const [variants, setVariants] = useState([]); // respuestas alternativas del último mensaje de la IA (solo en memoria)
  const [variantIndex, setVariantIndex] = useState(0);
  const regeneratingRef = useRef(false);
		const	convId	=	conversation.id;
  useEffect(() => {
    setVariants([]);
    setVariantIndex(0);
  }, [convId]);
		const	chatWallpaper	=	getChatWallpaper(character.id);
  const [maxContextTokens, setMaxContextTokens] = useState(4000);
  const [showPersonaPicker, setShowPersonaPicker] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [activePersona, setActivePersona] = useState(null); // null = usar el perfil por defecto de Ajustes
  const [scenarioOverride, setScenarioOverride] = useState(conversation?.scenarioOverride || '');

  useEffect(() => {
    setScenarioOverride(conversation?.scenarioOverride || '');
  }, [conversation?.id, conversation?.scenarioOverride]);

  async function loadActivePersona() {
    const selection = await window.electronAPI.personas.getSelection(character.id);
    if (!selection.enabled || !selection.personaId) {
      setActivePersona(null);
      return;
    }
    const all = await window.electronAPI.personas.getAll();
    setActivePersona(all.find(p => p.id === selection.personaId) || null);
  }

  useEffect(() => {
    loadActivePersona();
  }, [character.id]);

  // Bloque de "quién eres tú" a inyectar en el prompt: la persona activa
  // para este personaje, o si no hay ninguna, el perfil por defecto de Ajustes
  function buildUserContextBlock() {
    if (activePersona) {
      return [
        '=== USUARIO ===',
        `El usuario se llama ${activePersona.name}.`,
        activePersona.description || '',
        activePersona.lore ? `Contexto/lore adicional sobre el usuario: ${activePersona.lore}` : '',
        'Recuerda esta información y trátalo acorde a ella durante toda la conversación.',
      ].filter(Boolean).join('\n');
    }
    return getUserContextBlock();
  }

  // Estimación simple de tokens (misma heurística que usa el envío real: ~4 caracteres = 1 token)
  function estimateTokens(text) {
    return Math.ceil((text || '').length / 4);
  }
  const usedTokens = messages.reduce((sum, m) => sum + estimateTokens(m.content), 0);
  const contextPercent = Math.min(100, Math.round((usedTokens / maxContextTokens) * 100));

  useEffect(() => {
    window.electronAPI.settings.get().then(s => {
      if (s?.maxContextTokens) setMaxContextTokens(s.maxContextTokens);
    });
  }, []);

  //console.log("AVATAR:", character.avatar?.slice(0, 100));
  // Mensaje de bienvenida si es nueva conversación
  useEffect(() => {
    if (messages.length === 0 && character.greetingMsg) {
      const greeting = {
        id: 'greeting', 
        role: 'assistant',
        content: character.greetingMsg, 
        timestamp: Date.now()
      };
      setMessages([greeting]);
      window.electronAPI.conversations.appendMessage(convId, greeting);
    }
  }, []);

  useEffect(() => {
    setMessages(conversation?.messages || []);
  }, [conversation]);

  // Auto-scroll al último mensaje
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamBuffer]);

  // Configurar listeners de streaming al montar
  useEffect(() => {
    let chunkCount = 0;

    async function maybeAutoGenerateMemories(finalMessages) {
      try {
        const settings = await window.electronAPI.settings.get();
        if (settings.autoMemoryEnabled === false) return;
        const interval = settings.autoMemoryInterval || 10;
        const lastCount = await window.electronAPI.conversations.getLastMemoryMessageCount(convId);
        if (finalMessages.length - lastCount < interval) return;

        const result = await generateMemories({ conversationId: convId, character, messages: finalMessages });
        if (result.success && result.added.length > 0) {
          setMemoryPopup(true);
        }
      } catch {
        // si falla la generación automática, no interrumpimos el chat por ello
      }
    }

    window.electronAPI.ai.onChunk(chunk => {
      setStreamBuffer(prev => {
        const next = prev + chunk;
        // Guardado progresivo: cada pocos fragmentos (no en cada uno, para no
        // saturar IndexedDB) persistimos lo que llevamos. Así, si la app se
        // suspende en segundo plano a mitad de la respuesta, no se pierde
        // todo — como mínimo queda lo que ya había llegado hasta ese punto.
        chunkCount++;
        if (pendingAiMsgId.current && chunkCount % 8 === 0) {
          window.electronAPI.conversations.patchMessage(convId, pendingAiMsgId.current, { content: next });
        }
        return next;
      });
    });

    window.electronAPI.ai.onDone(async () => {
      let capturedContent = '';
      let capturedMsgId = null;

      setStreamBuffer(prev => {
        const fullContent = prev;
        const msgId = pendingAiMsgId.current;
        capturedContent = fullContent;
        capturedMsgId = msgId;

        setMessages(m => [...m, {
          id: msgId,
          role: 'assistant',
          content: fullContent,
          timestamp: Date.now(),
          pending: false,
        }]);

        if (msgId) {
          window.electronAPI.conversations.patchMessage(convId, msgId, { content: fullContent, pending: false });
        }
        pendingAiMsgId.current = null;

        if (regeneratingRef.current) {
          regeneratingRef.current = false;
          setVariants(prevVariants => {
            const updated = [...prevVariants, fullContent];
            setVariantIndex(updated.length - 1);
            return updated;
          });
        }
        return '';
      });
      setIsStreaming(false);
      maybeAutoGenerateMemories([...messagesRef.current, {
        id: capturedMsgId,
        role: 'assistant',
        content: capturedContent,
      }]);
    });

    window.electronAPI.ai.onError(errMsg => {
      setError(errMsg);
      setIsStreaming(false);
      setStreamBuffer('');
      pendingAiMsgId.current = null;
    });

    return () => window.electronAPI.ai.removeListeners();
  }, [convId]);

  // Helper común: reserva el mensaje de la IA (vacío, para ir guardándolo
  // progresivamente) y le pide la respuesta. Lo usan sendMessage, regenerar,
  // y la edición de un mensaje propio (que fuerza una respuesta nueva).
  async function requestAiResponse(history, userMessage) {
    setError(null);
    setIsStreaming(true);

    const placeholder = await window.electronAPI.conversations.appendMessage(convId, {
      role: 'assistant',
      content: '',
    });
    await window.electronAPI.conversations.patchMessage(convId, placeholder.id, { pending: true });
    pendingAiMsgId.current = placeholder.id;

    const memories = await window.electronAPI.conversations.getMemories(convId);

    try {
      await window.electronAPI.ai.sendMessage({
        character,
        history,
        userMessage,
        userContextBlock: buildUserContextBlock(),
        scenarioOverride,
        memoriesBlock: buildMemoriesBlock(memories),
      });
    } catch (err) {
      // El error llega por el listener onError, no aquí
    }
  }

  async function sendMessage() {
    const text = inputText.trim();
    if (!text || isStreaming) return;

    setInputText('');
    setVariants([]);
    setVariantIndex(0);

    // Agregar mensaje del usuario a la UI
    const userMsg = { 
      id: Date.now().toString(), 
      role: 'user',
      content: text, 
      timestamp: Date.now() 
    };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);

    // Guardar en storage
    await window.electronAPI.conversations.appendMessage(convId, { role: 'user', content: text });
    if (
      conversation?.title === t('sessionList.newConversation') &&
      messages.length === 0
    ) {
      await window.electronAPI.conversations.rename(
        convId,
        text.slice(0, 40)
      );
    }

    await requestAiResponse(updatedMessages, text);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function handleStop() {
    window.electronAPI.ai.stopGeneration?.();
  }

  async function handleDeleteMessage(messageId) {
    await window.electronAPI.conversations.deleteMessage?.(convId, messageId);
    setMessages(m => m.filter(msg => msg.id !== messageId));
  }

  // Borra un mensaje del usuario Y todo lo que vino después, dejando
  // intacto lo anterior (distinto de borrar solo ese mensaje)
  async function handleDeleteFromHere(messageId) {
    const idx = messages.findIndex(m => m.id === messageId);
    if (idx === -1) return;
    const kept = messages.slice(0, idx);
    await window.electronAPI.conversations.setMessages(convId, kept);
    setMessages(kept);
  }

  async function handleEditMessage(messageId, newContent) {
    const idx = messages.findIndex(m => m.id === messageId);
    if (idx === -1) return;
    const msg = messages[idx];

    if (msg.role === 'assistant') {
      // Solo se actualiza el texto — el turno siguiente es del usuario,
      // la IA no tiene que hacer nada más
      await window.electronAPI.conversations.editMessage?.(convId, messageId, newContent);
      setMessages(m => m.map(x =>
        x.id === messageId ? { ...x, content: newContent, edited: true } : x
      ));
      return;
    }

    // Es un mensaje del usuario: se edita, se descarta todo lo que vino
    // después (incluida la respuesta antigua de la IA a ese mensaje), y se
    // pide una respuesta nueva basada en el contenido editado
    if (isStreaming) return;
    const editedMsg = { ...msg, content: newContent, edited: true };
    const truncated = [...messages.slice(0, idx), editedMsg];
    await window.electronAPI.conversations.setMessages(convId, truncated);
    setMessages(truncated);

    await requestAiResponse(truncated, newContent);
  }

  async function handleRegenerate() {
    if (isStreaming) return;
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg || lastMsg.role !== 'assistant') return;

    const withoutLast = messages.slice(0, -1);
    const lastUserMsg = withoutLast[withoutLast.length - 1];
    if (!lastUserMsg || lastUserMsg.role !== 'user') return;

    // La primera vez que regeneras esta respuesta, guardamos la actual como
    // variante 0 — así luego se puede volver a ella deslizando/con flechas
    setVariants(prev => (prev.length > 0 ? prev : [lastMsg.content]));
    regeneratingRef.current = true;

    await window.electronAPI.conversations.deleteMessage?.(convId, lastMsg.id);
    setMessages(withoutLast);

    await requestAiResponse(withoutLast, lastUserMsg.content);
  }

  // Navegar entre las variantes de la última respuesta (sin volver a
  // generar nada — solo cambia cuál se muestra y se guarda como la actual)
  function goToVariant(newIndex) {
    if (newIndex < 0 || newIndex >= variants.length) return;
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg) return;
    const content = variants[newIndex];
    setVariantIndex(newIndex);
    setMessages(m => m.map((msg, i) => (i === m.length - 1 ? { ...msg, content } : msg)));
    window.electronAPI.conversations.patchMessage(convId, lastMsg.id, { content });
  }

  // Botón "Continuar": le pide a la IA que siga la escena sin que el
  // usuario tenga que escribir/enviar nada — no se guarda ningún mensaje
  // de usuario, solo se le añade una instrucción invisible a la llamada
  async function handleContinue() {
    if (isStreaming || messages.length === 0) return;
    setVariants([]);
    setVariantIndex(0);
    await requestAiResponse(messages, '*(Continúa la escena de forma natural — el usuario no tiene nada nuevo que añadir por ahora)*');
  }

  return	(
		<div
			className={`flex	flex-col	h-full	relative	bg-app-bg	${chatWallpaper	?	'chat-wallpaper-layer'	:	''}`}
			style={chatWallpaper	?	{	backgroundImage:	`url(${chatWallpaper})`	}	:	undefined}
		>
      <div className='chat-content-layer flex flex-col h-full'>
      {/* Header */}
      <div className='flex items-center gap-3 px-4 pt-12 pb-3 bg-card-bg border-b border-white/5'>
        <button 
          onClick={onBack}
          className='p-2 rounded-xl hover:bg-white/10 text-gray-400 hover:text-white'
        >
          <ArrowLeft size={18} />
        </button>
        
        <div className='w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center overflow-hidden'>
          {character.avatar?.startsWith('data:') ? (
            <img
              src={character.avatar}
              alt={character.name}
              className='w-full h-full object-cover'
            />
          ) : (
            <span className='text-xl'>
              {character.avatar || '👤'}
            </span>
          )}
        </div>
        
        <div className='flex-1'>
          <p className='font-semibold text-white text-sm'>{character.name}</p>
          <p className='text-xs text-accent-2 flex items-center gap-1.5'>
            {isStreaming ? t('chat.typing') : t('chat.online')}
            {!isStreaming && contextPercent > 0 && (
              <span
                className={`opacity-60 ${contextPercent >= 90 ? 'text-yellow-400 opacity-100' : ''}`}
                title={t('chat.contextUsageTooltip')}
              >
                · {contextPercent}% {t('chat.contextUsage')}
              </span>
            )}
          </p>
        </div>
        
        {/* ¡NUEVO BOTÓN! Ver Historial de Líneas Temporales */}
        <button 
          onClick={onShowSessions}
          className='p-2 rounded-xl hover:bg-white/10 text-gray-400 hover:text-white'
          title={t('chat.timelineTooltip')}
        >
          <History size={18} />
        </button>

        {/* Menú de ajustes del chat (persona, escenario, wallpaper, y lo que venga) */}
        <button
          onClick={() => setShowSettingsMenu(true)}
          className='p-2 rounded-xl hover:bg-white/10 text-gray-400 hover:text-white'
          title={t('chatSettingsMenu.title')}
        >
          <Menu size={18} />
        </button>

        <button 
          onClick={onNewChat}
          className='p-2 rounded-xl hover:bg-white/10 text-gray-400 hover:text-white'
          title={t('chat.newConversation')}
        >
          <Plus size={18} />
        </button>
      </div>

      {memoryPopup && (
        <div className='mx-4 mt-2 flex items-center gap-2 bg-accent/15 border border-accent/30 rounded-xl px-3 py-2'>
          <span className='text-xs flex-1 text-white'>{t('memory.autoPopup')}</span>
          <button onClick={() => setMemoryPopup(false)} className='text-gray-400 hover:text-white p-0.5'>
            <X size={13} />
          </button>
        </div>
      )}

      {/* Messages Area */}
      <div className='flex-1 overflow-y-auto px-4 py-4 space-y-3'>
        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <MessageBubble 
              key={msg.id} 
              message={msg}
              characterAvatar={character.avatar} 
              characterName={character.name}
              isLast={i === messages.length - 1}
              onDelete={handleDeleteMessage}
              onDeleteFrom={msg.role === 'user' ? handleDeleteFromHere : undefined}
              onEdit={handleEditMessage}
              onRegenerate={msg.role === 'assistant' ? handleRegenerate : undefined}
              variantInfo={
                i === messages.length - 1 && variants.length > 1
                  ? { index: variantIndex, total: variants.length, onPrev: () => goToVariant(variantIndex - 1), onNext: () => goToVariant(variantIndex + 1) }
                  : undefined
              }
            />
          ))}

          {/* Streaming bubble */}
          {isStreaming && streamBuffer && (
            <MessageBubble
              key='streaming'
              message={{ role: 'assistant', content: streamBuffer }}
              characterAvatar={character.avatar}
              isStreaming
            />
          )}

          {/* Loading dots */}
          {isStreaming && !streamBuffer && (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }}
              className='flex items-center gap-1 px-4 py-3 bg-msg-ai rounded-2xl rounded-tl-sm w-fit'
            >
              {[0, 1, 2].map(i => (
                <motion.div 
                  key={i}
                  animate={{ y: [0, -4, 0] }}
                  transition={{ duration: 0.6, delay: i * 0.15, repeat: Infinity }}
                  className='w-1.5 h-1.5 bg-accent rounded-full' 
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <div className='text-center text-red-400 text-xs bg-red-500/10 rounded-xl px-3 py-2'>
            ⚠️ {error}
          </div>
        )}
        
        <div ref={bottomRef} />
      </div>

      {/* Input Bar */}
      <div className='px-4 pb-8 pt-3 border-t border-white/5'>
        <div className='flex items-end gap-2 bg-card-bg rounded-2xl p-2 border border-white/10 focus-within:border-accent/50 transition-colors'>
          <button
            onClick={() => setShowPersonaPicker(true)}
            className={`p-2.5 rounded-xl flex-shrink-0 transition-colors ${activePersona ? 'text-accent bg-accent/10' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
            title={t('persona.title')}
          >
            <UserCircle2 size={18} />
          </button>

          <textarea
            ref={inputRef}
            rows={1}
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('chat.placeholder', {name:character.name})}
            disabled={isStreaming}
            className='flex-1 bg-transparent text-sm text-white placeholder-gray-600 outline-none resize-none max-h-32 py-2 px-2 leading-5'
            style={{ fieldSizing: 'content' }}
          />
          
          <button 
            onClick={isStreaming ? handleStop : (inputText.trim() ? sendMessage : handleContinue)} 
            disabled={!isStreaming && !inputText.trim() && messages.length === 0}
            className='p-2.5 bg-accent rounded-xl text-white disabled:opacity-40 hover:bg-accent/80 transition-colors flex-shrink-0'
            title={isStreaming ? t('chat.stop') : (!inputText.trim() ? t('chat.continue') : undefined)}
          >
            {isStreaming ? (
              <Square size={16} />
            ) : inputText.trim() ? (
              <Send size={16} />
            ) : (
              <SkipForward size={16} />
            )}
          </button>
        </div>
        
        <p className='text-center text-xs text-gray-700 mt-2'>
          {t('chat.keyboardHint')}
        </p>
      </div>
      </div>

      <PersonaPicker
        isOpen={showPersonaPicker}
        onClose={() => setShowPersonaPicker(false)}
        characterId={character.id}
        characterName={character.name}
        onChange={() => loadActivePersona()}
      />

      <ChatSettingsMenu
        isOpen={showSettingsMenu}
        onClose={() => setShowSettingsMenu(false)}
        character={character}
        conversation={{ ...conversation, scenarioOverride }}
        activePersona={activePersona}
        onPersonaChange={() => loadActivePersona()}
        onScenarioChange={(newScenario) => setScenarioOverride(newScenario)}
        messages={messages}
      />

    </div>
  );
}