import	React,	{	useState,	useEffect,	useRef	}	from	'react';
import	{	History,	ArrowLeft,	Plus,	Send,	Loader2,	Image	as	ImageIcon,	Trash2,	X,	Square	}	from	'lucide-react';
import	{	motion,	AnimatePresence	}	from	'framer-motion';
import	MessageBubble	from	'./MessageBubble';
import	{	useApp	}	from	'../context/AppContext';

export	default	function	ChatWindow({	character,	conversation,	onBack,	onNewChat,	onShowSessions	})	{
		const	[messages,	setMessages]	=	useState(conversation.messages	||	[]);
		const	[inputText,	setInputText]	=	useState('');
		const	[isStreaming,	setIsStreaming]	=	useState(false);
		const	[streamBuffer,	setStreamBuffer]	=	useState('');
		const	[error,	setError]	=	useState(null);
		const	[showWallpaperMenu,	setShowWallpaperMenu]	=	useState(false);
		const	[wallpaperLoading,	setWallpaperLoading]	=	useState(false);
		const	{	t,	getChatWallpaper,	saveChatWallpaper	}	=	useApp();
		const	bottomRef	=	useRef(null);
		const	inputRef	=	useRef(null);
		const	convId	=	conversation.id;
		const	chatWallpaper	=	getChatWallpaper(character.id);
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
    window.electronAPI.ai.onChunk(chunk => {
      setStreamBuffer(prev => prev + chunk);
    });

    window.electronAPI.ai.onDone(async () => {
      setStreamBuffer(prev => {
        // Guardar mensaje completo al terminar el stream
        const fullContent = prev;
        const aiMsg = { role: 'assistant', content: fullContent };
        
        setMessages(m => [...m, {
          ...aiMsg, 
          id: Date.now().toString(), 
          timestamp: Date.now()
        }]);
        
        window.electronAPI.conversations.appendMessage(convId, aiMsg);
        return '';
      });
      setIsStreaming(false);
    });

    window.electronAPI.ai.onError(errMsg => {
      setError(errMsg);
      setIsStreaming(false);
      setStreamBuffer('');
    });

    return () => window.electronAPI.ai.removeListeners();
  }, [convId]);

  async function sendMessage() {
    const text = inputText.trim();
    if (!text || isStreaming) return;

    setError(null);
    setInputText('');
    setIsStreaming(true);

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
   
    // Llamar a la API con el historial actualizado
    try {
      await window.electronAPI.ai.sendMessage({
        character,
        history: updatedMessages,
        userMessage: text,
      });
    } catch (err) {
      // El error llega por el listener onError, no aquí
    }
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

  async function handleEditMessage(messageId, newContent) {
    await window.electronAPI.conversations.editMessage?.(convId, messageId, newContent);
    setMessages(m => m.map(msg =>
      msg.id === messageId ? { ...msg, content: newContent, edited: true } : msg
    ));
  }

  async function handleRegenerate() {
    if (isStreaming) return;
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg || lastMsg.role !== 'assistant') return;

    // Quitar la última respuesta de la IA y volver a pedirla
    await window.electronAPI.conversations.deleteMessage?.(convId, lastMsg.id);
    const withoutLast = messages.slice(0, -1);
    setMessages(withoutLast);

    const lastUserMsg = withoutLast[withoutLast.length - 1];
    if (!lastUserMsg || lastUserMsg.role !== 'user') return;

    setError(null);
    setIsStreaming(true);
    try {
      await window.electronAPI.ai.sendMessage({
        character,
        history: withoutLast,
        userMessage: lastUserMsg.content,
      });
    } catch (err) {
      // El error llega por el listener onError
    }
  }

  async	function	handleSelectChatWallpaper()	{
		setWallpaperLoading(true);
		try	{
  		const	filePath	=	await	window.electronAPI.image.selectFile();
			if	(!filePath)	{	setWallpaperLoading(false);	return;	}
		  	const	dataUri	=	await	window.electronAPI.image.toBase64(filePath);
				await	saveChatWallpaper(character.id,	dataUri);
		}	catch	(err)	{
			setError(err.message);
		}	finally	{
			setWallpaperLoading(false);
			setShowWallpaperMenu(false);
		}
	}
	async	function	handleClearChatWallpaper()	{
		await	saveChatWallpaper(character.id,	null);
		setShowWallpaperMenu(false);
	}

  return	(
		<div
			className={`flex	flex-col	h-full	bg-app-bg	${chatWallpaper	?	'chat-wallpaper-layer'	:	''}`}
			style={chatWallpaper	?	{	backgroundImage:	`url(${chatWallpaper})`	}	:	undefined}
		>
      
      {/* Header */}
      <div className='flex items-center gap-3 px-4 pt-12 pb-3 bg-gradient-to-b from-card-bg to-transparent border-b border-white/5'>
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
          <p className='text-xs text-accent-2'>
            {isStreaming ? t('chat.typing') : t('chat.online')}
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
        
          <div	className='relative'>
										<button
												onClick={()	=>	setShowWallpaperMenu(p	=>	!p)}
												className='p-2	rounded-xl	hover:bg-white/10	text-gray-400	hover:text-white'
												title={t('chat.wallpaperTooltip')}
										>
												<ImageIcon	size={18}	/>
										</button>
										<AnimatePresence>
												{showWallpaperMenu	&&	(
														<motion.div
																initial={{	opacity:	0,	y:	8,	scale:	0.95	}}
																animate={{	opacity:	1,	y:	0,	scale:	1	}}
																exit={{	opacity:	0,	y:	8,	scale:	0.95	}}
																transition={{	duration:	0.15	}}
																className='absolute	top-12	right-0	w-52	bg-card-bg	border	border-white/10
																rounded-2xl	overflow-hidden	shadow-2xl	shadow-black/50	z-30'
														>
																<button
																		disabled={wallpaperLoading}
																		onClick={handleSelectChatWallpaper}
																		className='w-full	flex	items-center	gap-2	px-4	py-3	text-left	text-sm
																		text-gray-200	hover:bg-white/5	transition-colors	disabled:opacity-50'
																>
																		<ImageIcon	size={14}	className='text-accent'	/>
																		{wallpaperLoading	?	t('appearance.loading')	:	t('chat.setWallpaper')}
																</button>
																{chatWallpaper	&&	(
																		<button
																				onClick={handleClearChatWallpaper}
																				className='w-full	flex	items-center	gap-2	px-4	py-3	text-left	text-sm
																				text-red-400	hover:bg-red-500/10	transition-colors	border-t	border-white/5'
																		>
																				<Trash2	size={14}	/>
																				{t('chat.removeWallpaper')}
																		</button>
																)}
														</motion.div>
												)}
										</AnimatePresence>
								</div>

        <button 
          onClick={onNewChat}
          className='p-2 rounded-xl hover:bg-white/10 text-gray-400 hover:text-white'
          title={t('chat.newConversation')}
        >
          <Plus size={18} />
        </button>
      </div>

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
              onEdit={msg.role === 'user' ? handleEditMessage : undefined}
              onRegenerate={msg.role === 'assistant' ? handleRegenerate : undefined}
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
            onClick={isStreaming ? handleStop : sendMessage} 
            disabled={!isStreaming && !inputText.trim()}
            className='p-2.5 bg-accent rounded-xl text-white disabled:opacity-40 hover:bg-accent/80 transition-colors flex-shrink-0'
            title={isStreaming ? 'Parar' : undefined}
          >
            {isStreaming ? (
              <Square size={16} />
            ) : (
              <Send size={16} />
            )}
          </button>
        </div>
        
        <p className='text-center text-xs text-gray-700 mt-2'>
          {t('chat.keyboardHint')}
        </p>
      </div>

    </div>
  );
}