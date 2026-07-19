import React, { createContext, useContext, useState, useEffect } from 'react';
import { useI18n } from '../hooks/useI18n';

const AppContext = createContext(null);
const	THEME_BASE_HUE	=	262;

export function AppProvider({ children }) {
  const { t, lang, setLang } = useI18n();
  const [userProfile, setUserProfile] = useState({
    alias: 'Viajero',
    avatar: '👤',
    gender: '', // '' = sin especificar, no se menciona a la IA
    roleTone: 'casual', // 'casual' | 'formal' | 'epic'
    temperature: 0.85,
  });

  const	[uiPrefs,	setUiPrefs]	=	useState({
		themeHue:	THEME_BASE_HUE,
		themeMode:	'dark', // 'dark' | 'light'
		appWallpaper:	null,
		chatWallpapers:	{},
	});

  // Cargar perfil y settings al iniciar
  useEffect(() => {
    window.electronAPI.settings.get().then(s => {
      if (s?.userProfile) setUserProfile(s.userProfile);
      if (s?.language) setLang(s.language);
    });
    window.electronAPI.uiPrefs.get().then(prefs => {
      if (!prefs) return;
      setUiPrefs(prev => ({ ...prev, ...prefs }));
      applyThemeToDOM(prefs.themeHue);
      applyWallpaperToDOM(prefs.appWallpaper);
      applyThemeModeToDOM(prefs.themeMode);
    });
  }, [setLang]);

  function	applyThemeToDOM(hue)	{
		const	shift	=	(hue	??	THEME_BASE_HUE)	-	THEME_BASE_HUE;
		document.documentElement.style.setProperty('--theme-hue-shift',	shift);
	}
	function	applyWallpaperToDOM(wallpaperDataUri)	{
		document.documentElement.style.setProperty(
			'--app-wallpaper-image',
			wallpaperDataUri	?	`url(${wallpaperDataUri})`	:	'none'
		);
	}
	function applyThemeModeToDOM(mode) {
		document.documentElement.setAttribute('data-theme', mode === 'light' ? 'light' : 'dark');
	}

  async function saveProfile(updates) {
    const updated = { ...userProfile, ...updates };
    setUserProfile(updated);
    await window.electronAPI.settings.update({ userProfile: updated });
  }

  async function saveLanguage(newLang) {
    setLang(newLang);
    await window.electronAPI.settings.update({ language: newLang });
  }

  async	function	saveThemeHue(hue)	{
		setUiPrefs(prev	=>	({	...prev,	themeHue:	hue	}));
		applyThemeToDOM(hue);
		await	window.electronAPI.uiPrefs.update({	themeHue:	hue	});
	}

  async function saveThemeMode(mode) {
		setUiPrefs(prev => ({ ...prev, themeMode: mode }));
		applyThemeModeToDOM(mode);
		await window.electronAPI.uiPrefs.update({ themeMode: mode });
	}

  async	function	saveAppWallpaper(dataUriOrNull)	{
				setUiPrefs(prev	=>	({	...prev,	appWallpaper:	dataUriOrNull	}));
				applyWallpaperToDOM(dataUriOrNull);
				await	window.electronAPI.uiPrefs.update({	appWallpaper:	dataUriOrNull	});
		}
	async	function	saveChatWallpaper(characterId,	dataUriOrNull)	{
		setUiPrefs(prev	=>	({
			...prev,
			chatWallpapers:	{
				...prev.chatWallpapers,
				...(dataUriOrNull
					?	{	[characterId]:	dataUriOrNull	}
					:	Object.fromEntries(
						Object.entries(prev.chatWallpapers).filter(([id])	=>	id	!==	characterId)
			  		)),
				},
		}));
		await	window.electronAPI.uiPrefs.setChatWallpaper(characterId,	dataUriOrNull);
	}
	function	getChatWallpaper(characterId)	{
		return	uiPrefs.chatWallpapers?.[characterId]	||	null;
	}
  /**
   * Genera el bloque de contexto del usuario para inyectar en system prompts.
   * DeepSeek usará esto para que los NPCs sepan con quién hablan.
   */
  function getUserContextBlock() {
    const toneMap = {
      casual: 'Trata al usuario con familiaridad y cercanía.',
      formal: 'Trata al usuario con respeto y formalidad.',
      epic: 'Trata al usuario como a un héroe legendario.',
    };
    const genderMap = {
      male: 'El usuario es un hombre.',
      female: 'El usuario es una mujer.',
      other: 'El usuario no se identifica como hombre ni mujer.',
    };

    return [
      '=== USUARIO ===',
      `El usuario se llama ${userProfile.alias}.`,
      genderMap[userProfile.gender] || '', // vacío si es 'unspecified' o no está definido — no se menciona
      toneMap[userProfile.roleTone] || toneMap.casual,
      'Recuerda su nombre y úsalo naturalmente en la conversación.',
    ].filter(Boolean).join('\n');
  }

  return (
    <AppContext.Provider value={{
      t,
		  lang,
			userProfile,
			saveProfile,
			saveLanguage,
			getUserContextBlock,
			uiPrefs,
			saveThemeHue,
			saveThemeMode,
			saveAppWallpaper,
			saveChatWallpaper,
			getChatWallpaper,
    }}>
      {children}
    </AppContext.Provider>
  );
}

// Hook de consumo de contexto
export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp debe usarse dentro de AppProvider');
  return ctx;
}