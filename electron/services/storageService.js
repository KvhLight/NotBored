
const Store = require('electron-store');
const { v4: uuidv4 } = require('uuid');

// electron-store crea automáticamente un JSON cifrado en:
// Windows: %APPDATA%\deepseek-roleplay\config.json
// macOS: ~/Library/Application Support/deepseek-roleplay/config.json
// Linux: ~/.config/deepseek-roleplay/config.json
const	store	=	new	Store({
		name:	'roleplay-data',
		defaults:	{
				characters:	[],
				conversations:	[],
				settings:	{
						provider:	'ollama',
						apiKey:	'',
						model:	'llama3.2:3b',
						maxContextTokens:	4000,
						temperature:	0.85,
						maxTokens:	1000,
				},
				uiPreferences:	{
						themeHue:	262,												//	hue	base	del	theme	(262	=	violeta	original)
						appWallpaper:	null,							//	null	|	'data:image/...'	|	{	type:	'color',	value:	'#...'	}
						chatWallpapers:	{},							//	{	[characterId]:	'data:image/...'	}
				},
		},
});

/* ==========================================================================
   CHARACTERS CRUD
   ========================================================================== */

function getAllCharacters() {
  return store.get('characters', []);
}

function getCharacterById(id) {
  const chars = getAllCharacters();
  return chars.find(c => c.id === id) || null;
}

function createCharacter(data) {
  const chars = getAllCharacters();
  const newChar = {
    id: uuidv4(),
    name: data.name || 'Sin nombre',
    avatar: data.avatar || 'n',
    description: data.description || '',
    personality: data.personality || '',
    scenario: data.scenario || '',
    systemPrompt: data.systemPrompt || '',
    greetingMsg: data.greetingMsg || '',
    tags: data.tags || [],
    isNSFW: data.isNSFW || false,
    isFavorite:	data.isFavorite	||	false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  chars.push(newChar);
  store.set('characters', chars);
  return newChar;
}

function updateCharacter(id, updates) {
  const chars = getAllCharacters();
  const idx = chars.findIndex(c => c.id === id);
  if (idx === -1) throw new Error(`Character ${id} not found`);

  chars[idx] = { ...chars[idx], ...updates, updatedAt: Date.now() };
  store.set('characters', chars);
  return chars[idx];
}

function deleteCharacter(id) {
  const chars = getAllCharacters().filter(c => c.id !== id);
  store.set('characters', chars);

  // También eliminar conversaciones del personaje
  const convs = getAllConversations().filter(c => c.characterId !== id);
  store.set('conversations', convs);
  return true;
}

/* ==========================================================================
   CONVERSATIONS
   ========================================================================== */

function getAllConversations() {
  return store.get('conversations', []);
}

function getConversationsByCharacter(characterId) {
  return getAllConversations()
    .filter(c => c.characterId === characterId)
    .sort((a, b) => b.lastActivity - a.lastActivity);
}

function createConversation(characterId) {
  const convs = getAllConversations();
  const newConv = {
    id: uuidv4(),
    characterId,
    title: 'New Conversation',
    messages: [],
    createdAt: Date.now(),
    lastActivity: Date.now(),
  };

  convs.push(newConv);
  store.set('conversations', convs);
  return newConv;
}

function appendMessage(conversationId, message) {
  const convs = getAllConversations();
  const idx = convs.findIndex(c => c.id === conversationId);
  if (idx === -1) throw new Error('Conversation not found');

  const newMsg = {
    id: uuidv4(),
    role: message.role,
    content: message.content,
    timestamp: Date.now(),
  };

  convs[idx].messages.push(newMsg);
  convs[idx].lastActivity = Date.now();

  // Auto-título desde el primer mensaje del user
  if (message.role === 'user' && convs[idx].title === 'New Conversation') {
    convs[idx].title = message.content.slice(0, 40) + '...';
  }

  store.set('conversations', convs);
  return newMsg;
}

function deleteConversation(id) {
  const convs = getAllConversations().filter(c => c.id !== id);
  store.set('conversations', convs);
  return true;
}

/* ==========================================================================
   SETTINGS
   ========================================================================== */

function getSettings() {
  const settings = store.get('settings');

  return {
    provider: 'ollama',
    model: 'llama3.2:3b',
    ...settings,
  };
}

function updateSettings(updates) {
  const current = getSettings();
  store.set('settings', { ...current, ...updates });
  return getSettings();
}

function renameConversation(id, newTitle) {
  const convs = getAllConversations();
  const idx = convs.findIndex(c => c.id === id);
  
  if (idx === -1) {
    throw new Error('Conversation not found');
  }
  
  convs[idx].title = newTitle;
  store.set('conversations', convs);
  
  return convs[idx];
}
/*	==========================================================================
UI	PREFERENCES	(Tema,	Wallpapers)
==========================================================================	*/
function	getUiPreferences()	{
  return	store.get('uiPreferences',	{
    themeHue:	262,
    appWallpaper:	null,
    chatWallpapers:	{},
  });
}
function	updateUiPreferences(updates)	{
  const	current	=	getUiPreferences();
  const	merged	=	{	...current,	...updates	};
  store.set('uiPreferences',	merged);
  return	merged;
}
function	setChatWallpaper(characterId,	wallpaperValue)	{
  const	current	=	getUiPreferences();
  const	chatWallpapers	=	{	...current.chatWallpapers	};
  if	(wallpaperValue	===	null)	{
    delete	chatWallpapers[characterId];
  }	else	{
    chatWallpapers[characterId]	=	wallpaperValue;
  }
  return	updateUiPreferences({	chatWallpapers	});
}

/* ==========================================================================
   EXPORTS
   ========================================================================== */

module.exports	=	{
getAllCharacters,
getCharacterById,
createCharacter,
updateCharacter,
deleteCharacter,
getAllConversations,
getConversationsByCharacter,
createConversation,
appendMessage,
deleteConversation,
getSettings,
updateSettings,
renameConversation,
getUiPreferences,
updateUiPreferences,
setChatWallpaper,
};