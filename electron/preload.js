const { contextBridge, ipcRenderer } = require('electron');

// Expone la API a window.electronAPI en el Renderer
contextBridge.exposeInMainWorld('electronAPI', {
  
  /* ==========================================================================
     Characters
     ========================================================================== */
  characters: {
    getAll: () => ipcRenderer.invoke('characters:getAll'),
    getById: (id) => ipcRenderer.invoke('characters:getById', id),
    create: (data) => ipcRenderer.invoke('characters:create', data),
    update: (id, data) => ipcRenderer.invoke('characters:update', id, data),
    delete: (id) => ipcRenderer.invoke('characters:delete', id),
  },

    /* ==========================================================================
     Ventana controles
     ========================================================================== */
  window: {
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),
  },

  /* ==========================================================================
     Conversations
     ========================================================================== */
  conversations: {
    byCharacter: (charId) => ipcRenderer.invoke('conversations:byCharacter', charId),
    create: (charId) => ipcRenderer.invoke('conversations:create', charId),
    appendMessage: (convId, msg) => ipcRenderer.invoke('conversations:appendMessage', convId, msg),
    delete: (id) => ipcRenderer.invoke('conversations:delete', id),
    rename: (id, title) => ipcRenderer.invoke('conversations:rename', id, title),
  },

  /* ==========================================================================
     AI / DeepSeek
     ========================================================================== */
  ai: {
    sendMessage: (payload) => ipcRenderer.invoke('ai:sendMessage', payload),
    
    // Listeners de streaming
    onChunk: (callback) => {
      ipcRenderer.on('ai:chunk', (_, chunk) => callback(chunk));
    },
    onDone: (callback) => {
      ipcRenderer.on('ai:done', () => callback());
    },
    onError: (callback) => {
      ipcRenderer.on('ai:error', (_, msg) => callback(msg));
    },
    
    // Limpia listeners para evitar memory leaks
    removeListeners: () => {
      ipcRenderer.removeAllListeners('ai:chunk');
      ipcRenderer.removeAllListeners('ai:done');
      ipcRenderer.removeAllListeners('ai:error');
    },
  },

  /* ==========================================================================
     Settings
     ========================================================================== */
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    update: (data) => ipcRenderer.invoke('settings:update', data),
  },

  /*	==========================================================================
    UI	Preferences	(Tema,	Wallpapers)
  ==========================================================================	*/
  uiPrefs:	{
    get:	()	=>	ipcRenderer.invoke('uiPrefs:get'),
    update:	(data)	=>	ipcRenderer.invoke('uiPrefs:update',	data),
    setChatWallpaper:	(charId,	value)	=>
    ipcRenderer.invoke('uiPrefs:setChatWallpaper',	charId,	value),
  },

   /* ==========================================================================
     Imagen de personaje
     ========================================================================== */

  image: {
  selectFile: () => ipcRenderer.invoke('image:selectFile'),
  saveAvatar: (src, charId) => ipcRenderer.invoke('image:saveAvatar', src, charId),
  toBase64: (filePath) => ipcRenderer.invoke('image:toBase64', filePath),
  deleteAvatar: (charId) => ipcRenderer.invoke('image:deleteAvatar', charId),
  },

   /* ==========================================================================
     Forja personaje automatico
     ========================================================================== */

  forge: {
  generateCharacter: (idea) => ipcRenderer.invoke('forge:generateCharacter', idea),
  },

  /* ==========================================================================
     Busqueda de modelos en OLLAMA
     ========================================================================== */

  ollama: {
  getModels: () =>
    ipcRenderer.invoke('ollama:getModels')
  },
});