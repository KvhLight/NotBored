const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const Store = require('electron-store');
const storage = require('./services/storageService');
const deepseek = require('./services/deepseekService');
const ollamaService = require('./services/ollamaService');

// Directorio de avatares locales en AppData del usuario
const AVATARS_DIR = path.join(app.getPath('userData'), 'avatars');

// Store separado solo para preferencias de UI (no mezclar con datos de personajes)
const uiStore = new Store({ name: 'ui-preferences' });
const isDev = !app.isPackaged;

function createWindow() {
  // Recuperar bounds guardados o usar valores por defecto (Desktop Layout)
  const savedBounds = uiStore.get('windowBounds', {
    width: 1100,
    height: 820,
    x: undefined, // undefined = centrar automáticamente
    y: undefined,
  });

  const win = new BrowserWindow({
    width: savedBounds.width,
    height: savedBounds.height,
    x: savedBounds.x,
    y: savedBounds.y,
    minWidth: 800,
    minHeight: 600,
    frame: true, // Barra de títulos nativa del SO
    resizable: true,
    backgroundColor: '#0F0F1A',
    titleBarStyle: 'default', // 'hiddenInset' en macOS para look premium
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, // SEGURIDAD: Activo siempre
      nodeIntegration: false, // SEGURIDAD: Inactivo siempre
    },
  });

  // ==========================================================================
  // Persistencia de dimensiones
  // ==========================================================================
  
  // Guardar bounds al redimensionar (con debounce para no saturar disco)
  let resizeTimer;
  win.on('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (!win.isMaximized() && !win.isMinimized()) {
        uiStore.set('windowBounds', win.getBounds());
      }
    }, 500);
  });

  // Guardar posición al mover
  let moveTimer;
  win.on('move', () => {
    clearTimeout(moveTimer);
    moveTimer = setTimeout(() => {
      if (!win.isMaximized()) {
        uiStore.set('windowBounds', win.getBounds());
      }
    }, 500);
  });

  // Guardar estado maximizado
  win.on('maximize', () => uiStore.set('isMaximized', true));
  win.on('unmaximize', () => uiStore.set('isMaximized', false));

  // Restaurar estado maximizado si estaba así al cerrar
  if (uiStore.get('isMaximized', false)) {
    win.maximize();
  }

  if (isDev) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  return win;
}

// Inicialización de App, creación de directorios y registro de acciones
app.whenReady().then(() => {
  // Asegurar de forma síncrona que el almacenamiento multimedia exista antes de pintar la UI
  if (!fs.existsSync(AVATARS_DIR)) {
    fs.mkdirSync(AVATARS_DIR, { recursive: true });
  }

  const win = createWindow();

  // IPC para controles de ventana desde React (útil en layouts custom)
  ipcMain.on('window:minimize', () => win.minimize());
  ipcMain.on('window:maximize', () => {
    win.isMaximized() ? win.unmaximize() : win.maximize();
  });
  ipcMain.on('window:close', () => win.close());
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

/* ==========================================================================
   IPC HANDLERS — Characters
   ========================================================================== */

ipcMain.handle('characters:getAll', () => storage.getAllCharacters());
ipcMain.handle('characters:getById', (_, id) => storage.getCharacterById(id));
ipcMain.handle('characters:create', (_, data) => storage.createCharacter(data));
ipcMain.handle('characters:update', (_, id, updates) => storage.updateCharacter(id, updates));
ipcMain.handle('characters:delete', (_, id) => storage.deleteCharacter(id));

/* ==========================================================================
   IPC HANDLERS — Conversations
   ========================================================================== */

ipcMain.handle('conversations:byCharacter', (_, charId) => storage.getConversationsByCharacter(charId));
ipcMain.handle('conversations:create', (_, charId) => storage.createConversation(charId));
ipcMain.handle('conversations:appendMessage', (_, convId, msg) => storage.appendMessage(convId, msg));
ipcMain.handle('conversations:delete', (_, id) => storage.deleteConversation(id));
ipcMain.handle('conversations:rename', (_, id, newTitle) => storage.renameConversation(id, newTitle));

/* ==========================================================================
   IPC HANDLERS — DeepSeek API (Streaming)
   ========================================================================== */

ipcMain.handle('ai:sendMessage', async (event, { character, history, userMessage }) => {
  const win = BrowserWindow.getAllWindows()[0];

  return new Promise((resolve, reject) => {
    deepseek.streamMessage(
      character,
      history,
      userMessage,
      // onChunk: enviar cada token al Renderer
      (chunk) => win.webContents.send('ai:chunk', chunk),
      // onDone
      () => {
        win.webContents.send('ai:done');
        resolve({ success: true });
      },
      // onError
      (err) => {
        win.webContents.send('ai:error', err.message);
        reject(err);
      }
    );
  });
});

/* ==========================================================================
   IPC HANDLERS — Settings
   ========================================================================== */

ipcMain.handle('settings:get', () => storage.getSettings());
ipcMain.handle('settings:update', (_, updates) => storage.updateSettings(updates));

/*	==========================================================================
IPC	HANDLERS	—	UI	Preferences	(Tema	y	Wallpapers)
==========================================================================	*/
ipcMain.handle('uiPrefs:get',	()	=>	storage.getUiPreferences());
ipcMain.handle('uiPrefs:update',	(_,	updates)	=>	storage.updateUiPreferences(updates));
ipcMain.handle('uiPrefs:setChatWallpaper',	(_,	charId,	value)	=>
  storage.setChatWallpaper(charId,value)
);

/* ==========================================================================
   IPC HANDLERS — Image & Asset Management (Multimodal Ready)
   ========================================================================== */

// Abrir diálogo nativo del sistema operativo para seleccionar imagen
ipcMain.handle('image:selectFile', async () => {
  const win = BrowserWindow.getAllWindows()[0];
  const result = await dialog.showOpenDialog(win, {
    title: 'Seleccionar imagen de avatar',
    properties: ['openFile'],
    filters: [
      { name: 'Imágenes', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'] }
    ],
  });
  
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

// Copiar archivo de imagen al almacenamiento interno aislado de AppData
ipcMain.handle('image:saveAvatar', async (_, sourcePath, characterId) => {
  const ext = path.extname(sourcePath);
  const filename = `avatar_${characterId}${ext}`;
  const destPath = path.join(AVATARS_DIR, filename);
  
  fs.copyFileSync(sourcePath, destPath);
  
  // Retornar string con protocolo local seguro file:// para que Chromium la renderice sin errores de CORS
  return `file://${destPath.replace(/\\/g, '/')}`;
});

// Convertir buffer local a Base64 con prefijo MIME (útil para inyección en payloads DeepSeek-VL)
ipcMain.handle('image:toBase64', async (_, filePath) => {
  const stats = fs.statSync(filePath);
  const sizeMB = stats.size / (1024 * 1024);
  
  if (sizeMB > 6) {
    throw new Error('Imagen demasiado grande (máximo 6MB para Base64)');
  }
  
  const buffer = fs.readFileSync(filePath);
  const ext = path.extname(filePath).slice(1).toLowerCase();
  const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
  
  return `data:${mime};base64,${buffer.toString('base64')}`;
});

// Buscar y purgar cualquier avatar en disco vinculado al id del personaje eliminado
ipcMain.handle('image:deleteAvatar', async (_, characterId) => {
  if (!fs.existsSync(AVATARS_DIR)) return true;
  
  const files = fs.readdirSync(AVATARS_DIR)
    .filter(f => f.startsWith(`avatar_${characterId}`));
    
  files.forEach(f => fs.unlinkSync(path.join(AVATARS_DIR, f)));
  return true;
});
/* ==========================================================================
   IPC HANDLERS — Forge (Generador Automático de Fichas con IA)
   ========================================================================== */

ipcMain.handle('forge:generateCharacter', async (_, idea) => {
  try {
    // Tomar configuración fresca del almacenamiento local
    const settings = storage.getSettings();
    //console.log('FORGE SETTINGS:', settings);
    const {
      provider,
      model,
      apiKey
    } = settings;

    
    if (provider !== 'ollama' && !apiKey) {
      throw new Error('API Key no configurada.');
    }

    // Instanciar un cliente OpenAI local dedicado a la generación estructurada
    const OpenAI = require('openai');
    let client = null;
    if (provider !== 'ollama') {
      const OpenAI = require('openai');

      client = new OpenAI({
        apiKey,
        baseURL: 'https://api.deepseek.com/v1',
        timeout: 45000,
      });
    }

    const systemPrompt = `
You are an expert RPG and video game narrative designer. 
Your sole task is to generate deeply detailed NPC lorecards based on vague user ideas.
You must always strictly return a single, valid JSON object. 
Do NOT include markdown blocks (like \`\`\`json), no pre-text, no post-text, no conversational filler. Just raw JSON.
`.trim();

    const userPrompt = `
Generate a full, high-quality NPC lorecard for this idea: "${idea}"
Fill all fields with rich, creative, and immersive content.

You MUST respond using this exact JSON structure:
{
  "name": "Full memorable and immersive name",
  "avatar": "A single representative emoji",
  "description": "Detailed physical description and background history (at least 3 sentences)",
  "personality": "3-5 deeply nuanced personality traits, including flaws or inner contradictions",
  "scenario": "The specific world, era, location or context where this character exists",
  "systemPrompt": "In-depth first-person roleplay instructions for the AI detailing voice, speech patterns, quirks, and constraints (1 paragraphs)",
  "greetingMsg": "First message from the character to initiate the chat, containing immersive actions wrapped in *asterisks*",
  "tags": ["tag1", "tag2", "tag3"],
  "secretMotivation": "A hidden core motivation or dark secret the player could discover over time"
}
`.trim();

    let raw = '';
    if (provider === 'ollama') {
        //console.log('FORGE PROVIDER:', provider);
        console.log('FORGE MODEL:', model);
        //console.log('ENVIANDO A OLLAMA');

      const ollamaResponse = await fetch(
        'http://127.0.0.1:11434/api/generate',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
          model,
          prompt: `${systemPrompt}\n\n${userPrompt}`,
          stream: false
        })
        }
      );
      //console.log('FETCH COMPLETADO');

      const data = await ollamaResponse.json();

      //console.log('JSON RECIBIDO');
      raw = data.response || '';
      //console.log('RAW RESPONSE:');
      //console.log(raw);
      if (!ollamaResponse.ok) {
        throw new Error(
          `Ollama respondió ${ollamaResponse.status}: ${
            data.error || 'error desconocido'
          }`
        );
      }
    } else {

      const response = await client.chat.completions.create({
        model: model || 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.95,
        max_tokens: 800
      });
      raw = response.choices[0]?.message?.content || '';
    }
    // Sanitización robusta contra formateos accidentales de markdown (backticks)
    const clean = raw
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();
    //console.log('RAW:', raw);
    //console.log('CLEAN:', clean);

    if (!clean) {
      throw new Error('La IA devolvió una respuesta vacía.');
    }

    const parsed = JSON.parse(clean);
    
    // Asegurar que contenga campos mínimos obligatorios por si la IA altera las llaves
    if (!parsed.name || !parsed.systemPrompt) {
      throw new Error('Estructura de ficha incompleta.');
    }

    return { success: true, character: parsed };

  } catch (error) {
    console.error('Error en Forge Engine:', error);
    return { 
      success: false, 
      error: `Error al forjar personaje: ${error.message || 'La IA no devolvió un JSON válido. Reintenta.'}` 
    };
  }
});

/* ==========================================================================
   IPC HANDLERS — OLLAMA
   ========================================================================== */


ipcMain.handle(
  'ollama:getModels',
  async () => {
    return await ollamaService.getInstalledModels();
  }
);