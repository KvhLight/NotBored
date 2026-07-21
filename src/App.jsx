import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import Sidebar from './components/Sidebar';
import ChatWindow from './components/ChatWindow';
import CharacterForm from './components/CharacterForm';
import SessionList from './components/SessionList';
import SettingsModal from './components/SettingsModal';
import CharacterProfile from './components/CharacterProfile';
import BottomNavBar from './components/BottomNavBar';
import RecentChatsView from './components/RecentChatsView';
import ForgePanel from './components/ForgePanel';
import { useApp } from './context/AppContext';
import { PROVIDERS } from './config/providers';


export default function App() {
  const [characters, setCharacters] = useState([]);
  const [selectedCharacter, setSelectedCharacter] = useState(null);
  const [activeConversation, setActiveConversation] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingCharacter, setEditingCharacter] = useState(null);
  const [view, setView] = useState('sidebar'); // 'sidebar' | 'chat' | 'sessions'
  const [characterConvs, setCharacterConvs] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showSessions, setShowSessions] = useState(false);
  const showNavBar = (view === 'sidebar' || view === 'recentChats') && !showForm;
  const [creationMode, setCreationMode] = useState('form');
  const [showForge, setShowForge] = useState(false);
  const { t } = useApp();
  const [activeTagFilter, setActiveTagFilter] = useState(null);
  const [showAiBanner, setShowAiBanner] = useState(false);
  const [importMessage, setImportMessage] = useState(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  
  // Cargar personajes al inicio
  useEffect(() => {
    loadCharacters();
    checkAiConfigured();

    const goOffline = () => setIsOffline(true);
    const goOnline = () => setIsOffline(false);
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  async function checkAiConfigured() {
    try {
      const settings = await window.electronAPI.settings.get();
      const meta = PROVIDERS[settings.provider] || {};
      const hasKey = !meta.requiresApiKey || !!(settings.apiKeys && settings.apiKeys[settings.provider]);
      setShowAiBanner(!hasKey);
    } catch {
      // si algo falla comprobándolo, mejor no molestar con un aviso incorrecto
    }
  }

  async function loadCharacters() {
    const chars = await window.electronAPI.characters.getAll();
    setCharacters(chars);
  }

  async function handleImportCharacter() {
    const result = await window.electronAPI.characters.import();
    if (result.canceled) return;
    if (result.success) {
      await loadCharacters();
      setImportMessage({ type: 'success', text: t('sidebar.importSuccess', { name: result.character.name }) });
    } else {
      setImportMessage({ type: 'error', text: result.error || t('sidebar.importError') });
    }
    setTimeout(() => setImportMessage(null), 4000);
  }

  async function handleSelectCharacter(character) {
    //console.log('LOADING CONVERSATIONS FOR:', character.name);
    
    // Crear nueva conversación o retomar la más reciente
    const convs = await window.electronAPI.conversations.byCharacter(character.id);
    //console.log('FOUND CONVERSATIONS:', convs);
    setSelectedCharacter(character);
    setCharacterConvs(convs);
    setView('profile');
  }

  async function handleStartOrContinueChat() {
    let conv;
    const convs = await window.electronAPI.conversations.byCharacter(
      selectedCharacter.id
    );
    const hasReal = convs.some(c => c.messages.length > 0);
    if (hasReal) {
    // Retomar la conversación más reciente con mensajes
      conv = convs.find(c => c.messages.length > 0) || convs[0];
    } else {
    // Crear nueva conversación
      conv = await window.electronAPI.conversations.create(selectedCharacter.id);
    }
    setActiveConversation(conv);
    setView('chat');
  }

  async function handleResetChat() {
    const convs = await window.electronAPI.conversations.byCharacter(
      selectedCharacter.id
    );
    // Borrar todas las conversaciones existentes
    for (const conv of convs) {
      await window.electronAPI.conversations.delete(conv.id);
    }
    // Crear una nueva conversación limpia
    const newConv = await window.electronAPI.conversations.create(
      selectedCharacter.id
    );
    setActiveConversation(newConv);
    setCharacterConvs([newConv]);
    setView('chat');
  }

  async function handleNewTimeline() {
    const newConv = await window.electronAPI.conversations.create(
      selectedCharacter.id
    );
    setActiveConversation(newConv);
    setView('chat');
  }

  function handleNewChat(character) {
    window.electronAPI.conversations.create(character.id).then(conv => {
      setActiveConversation(conv);
      setView('chat');
    });
  }

  function handleEditCharacter(character) {
    setEditingCharacter(character);
    setShowForm(true);
  }

  async function handleSaveCharacter(data) {
    if (editingCharacter) {
      await window.electronAPI.characters.update(editingCharacter.id, data);
    } else {
      await window.electronAPI.characters.create(data);
    }
    await loadCharacters();
    setShowForm(false);
    setEditingCharacter(null);
  }

  async function handleDeleteCharacter(id) {
    await window.electronAPI.characters.delete(id);
    await loadCharacters();
    
    if (selectedCharacter?.id === id) {
      setSelectedCharacter(null);
      setView('sidebar');
    }
  }
  async	function	handleToggleFavorite(character)	{
				const	updated	=	await	window.electronAPI.characters.update(character.id,	{
						isFavorite:	!character.isFavorite,
				});
				await	loadCharacters();
				//	Si	estamos	viendo	el	perfil	de	este	personaje,	refrescar	su	estado	local	también
				if	(selectedCharacter?.id	===	character.id)	{
						setSelectedCharacter(updated);
				}
		}

  return (
    // Contenedor principal — pantalla completa en móvil real;
    // la "maqueta de móvil" de tamaño fijo solo se aplica en desktop (sm: y superior)
    <div className='flex items-center justify-center min-h-dvh bg-gray-950'>
      <div className='relative w-full h-dvh sm:w-[430px] sm:h-[920px] bg-app-bg overflow-hidden sm:rounded-3xl sm:shadow-2xl sm:border sm:border-white/5 app-wallpaper-layer'>

        {isOffline && (
          <div className='absolute top-0 left-0 right-0 z-50 bg-yellow-600/90 backdrop-blur-sm
                          text-white text-xs text-center py-2 px-3'>
            {t('app.offlineBanner')}
          </div>
        )}

        <AnimatePresence mode='wait'>
          
          {/* VISTA: SIDEBAR */}
          {view === 'sidebar' && !showForm && (
            <motion.div
              key='sidebar'
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className='absolute inset-0'
            >
              {showAiBanner && (
                <div className='absolute top-12 left-3 right-3 z-20 flex items-center gap-2
                                bg-accent/15 border border-accent/30 rounded-xl px-3 py-2.5 backdrop-blur-sm'>
                  <span className='text-sm flex-1 text-white'>
                    {t('app.aiBannerText')}
                  </span>
                  <button
                    onClick={() => { setShowSettings(true); setShowAiBanner(false); }}
                    className='text-xs font-semibold bg-accent text-white px-2.5 py-1.5 rounded-lg hover:bg-accent/80'
                  >
                    {t('app.aiBannerCta')}
                  </button>
                  <button
                    onClick={() => setShowAiBanner(false)}
                    className='text-gray-400 hover:text-white p-1'
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
              {importMessage && (
                <div className={`absolute top-12 left-3 right-3 z-20 flex items-center gap-2 rounded-xl px-3 py-2.5 backdrop-blur-sm ${
                  importMessage.type === 'success' ? 'bg-green-600/20 border border-green-500/30' : 'bg-red-600/20 border border-red-500/30'
                }`}>
                  <span className='text-sm flex-1 text-white'>{importMessage.text}</span>
                  <button onClick={() => setImportMessage(null)} className='text-gray-400 hover:text-white p-1'>
                    <X size={14} />
                  </button>
                </div>
              )}
              <Sidebar
                characters={characters}
                activeTagFilter={activeTagFilter}
                onTagFilterApplied={() => setActiveTagFilter(null)}  // ← verificar que existe
                onSelectCharacter={handleSelectCharacter}
                onEditCharacter={(char) => { setEditingCharacter(char); setShowForm(true); }}
                onDeleteCharacter={handleDeleteCharacter}
                onOpenSettings={() => setShowSettings(true)}
                onImportCharacter={handleImportCharacter}
                onToggleFavorite={handleToggleFavorite}
              />
            </motion.div>
          )}

          {view === 'recentChats' && !showForm && (
            <motion.div
              key='recentChats'
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className='absolute inset-0'
            >
              <RecentChatsView
                characters={characters}
                onSelectCharacter={(char) => { setSelectedCharacter(char); setView('profile'); }}
              />
            </motion.div>
          )}
              
          {/* VISTA: PROFILE ‹ NUEVA */}
          {view === 'profile' && selectedCharacter && (
            <motion.div key='profile'
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }} className='absolute inset-0'>
              <CharacterProfile
                character={selectedCharacter}
                conversations={characterConvs}
                onBack={() => setView('sidebar')}
                onStartChat={handleStartOrContinueChat}
                onResetChat={handleResetChat}
                onNewTimeline={handleNewTimeline}
                onTagClick={(tag) => {
                  setActiveTagFilter(tag);   // ← guarda el tag pendiente
                  setView('sidebar');
                }}
                onToggleFavorite={handleToggleFavorite}
              />
            </motion.div>
          )}

          {/* VISTA: CHAT */}
          {view === 'chat' && selectedCharacter && activeConversation && (
            <motion.div 
              key='chat'
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className='absolute inset-0'
            >
              <ChatWindow
                character={selectedCharacter}
                conversation={activeConversation}
                onBack={() => setView('profile')}
                onNewChat={() => handleNewChat(selectedCharacter)}
                onShowSessions={() => setView('sessions')}
              />
            </motion.div>
          )}

          {/* VISTA: CREACIÓN */}
          {showForm && (
            <motion.div
              key='creation'
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 30 }}
              className='absolute inset-0'
            >
              {!editingCharacter && (
                <div className='px-4 pt-12'>
                <div className='flex bg-card-bg rounded-full p-1 mb-4'>
                  <button
                    type='button'
                    onClick={() => setCreationMode('form')}
                    className={`
                      flex-1 py-2 rounded-full text-sm
                      ${
                        creationMode === 'form'
                          ? 'bg-accent text-white'
                          : 'text-gray-400'
                      }
                    `}
                  >
                    {t('characterForm.form')}
                  </button>

                  <button
                    type='button'
                    onClick={() => setCreationMode('forge')}
                    className={`
                      flex-1 py-2 rounded-full text-sm
                      ${
                        creationMode === 'forge'
                          ? 'bg-accent text-white'
                          : 'text-gray-400'
                      }
                    `}
                  >
                    {t('characterForm.forge')}
                  </button>
                </div>
                </div>
              )}

              {creationMode === 'forge' ? (
                <ForgePanel
                  onSaveCharacter={handleSaveCharacter}
                  onBack={() => {
                    setShowForm(false);
                    setCreationMode(null);
                    setView('sidebar');
                  }}
                />
              ) : (
                <CharacterForm
                  character={editingCharacter}
                  characters={characters}
                  onSave={handleSaveCharacter}
                  onCancel={() => {
                    setShowForm(false);
                    setEditingCharacter(null);
                  }}
                />
              )}
            </motion.div>
          )}

        </AnimatePresence>

        {/* 3. Modal renderizado de forma condicional antes del cierre del div principal */}
        {showSettings && (
          <SettingsModal onClose={() => setShowSettings(false)} />
        )}
        {/* Contenedor condicional para renderizar el panel lateral de líneas temporales */}
        {view === 'sessions' && selectedCharacter && (
          <SessionList
            character={selectedCharacter}
            activeId={activeConversation?.id}
            onSelectSession={(conv) => {
              setActiveConversation(conv);
              setView('chat');
            }}
            onNewSession={async () => {
              const newConv = await window.electronAPI.conversations.create(selectedCharacter.id);
              setActiveConversation(newConv);
              setView('chat');
            }}
            onClose={() => setView('chat')}
          />
        )}
        {/* Barra de Navegación Global Inferior (Módulo 3) */}
        {showNavBar && (
          <BottomNavBar
            activeView={view}
            onGoHome={() => setView('sidebar')}
            onGoRecentChats={() => setView('recentChats')}
            onNewCharacter={() => {
              setEditingCharacter(null);
              setShowForm(true);
            }}
          />
        )}
      </div>
    </div>
  );
}