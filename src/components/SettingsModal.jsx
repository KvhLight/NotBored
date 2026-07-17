import	React,	{	useState,	useEffect	}	from	'react';
import	{	X,	Save,	Key,	Sliders,	Palette,	Image	as	ImageIcon,	Check,	Trash2, Wallet, Sun, Moon	}	from	'lucide-react';
import	{	motion	}	from	'framer-motion';
import	{	useApp	}	from	'../context/AppContext';
import	AvatarPicker	from	'./AvatarPicker';
import { PROVIDERS, DEFAULT_PROVIDER } from '../config/providers';

const DEFAULT_TONES = [
  'casual',
  'formal',
  'épico',
  'cariñoso',
  'sarcástico',
  'académico',
  'divertido',
  'amistoso',
  'coqueto',
  'misterioso',
  'dramático',
  'minimalista',
];
const	THEME_PRESETS	=	[
		{	id:	'violet',		label:	'Violeta',		hue:	262,	swatch:	'#7C3AED'	},
		{	id:	'blue',				label:	'Azul',					hue:	217,	swatch:	'#2563EB'	},
		{	id:	'cyan',				label:	'Cian',					hue:	189,	swatch:	'#06B6D4'	},
		{	id:	'green',			label:	'Verde',				hue:	152,	swatch:	'#10B981'	},
		{	id:	'yellow',		label:	'Amarillo',	hue:	48,		swatch:	'#F59E0B'	},
		{	id:	'orange',		label:	'Naranja',		hue:	24,		swatch:	'#EA580C'	},
		{	id:	'red',					label:	'Rojo',					hue:	0,			swatch:	'#DC2626'	},
		{	id:	'pink',				label:	'Rosa',					hue:	330,	swatch:	'#EC4899'	},
];
const	THEME_BASE_HUE	=	262;	

export default function SettingsModal({ onClose }) {
  const [apiKeys,     setApiKeys]     = useState({});
  const [temperature, setTemperature] = useState(0.85);
  const [maxTokens,   setMaxTokens]   = useState(1000);
  const [maxContext,  setMaxContext]   = useState(4000);
  const [success,     setSuccess]     = useState('');
  const [error,       setError]       = useState('');
  const [section, setSection] = useState('main');
  const [provider, setProvider] = useState(DEFAULT_PROVIDER);
  const [model, setModel] = useState(PROVIDERS[DEFAULT_PROVIDER].defaultModel || '');
  const [availableModels, setAvailableModels] = useState([]);
 	const	[themeHue,	setThemeHue]	=	useState(THEME_BASE_HUE);
	const [appWallpaper, setAppWallpaper] = useState(null);
  const [wallpaperPreview, setWallpaperPreview] = useState(null); // imagen pendiente
  const [previousWallpaper, setPreviousWallpaper] = useState(null); // para revert
  const [wallpaperLoading, setWallpaperLoading] = useState(false);
  const [wallpaperError, setWallpaperError] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false); // modal confirm
  const [confirmTarget, setConfirmTarget] = useState(null); // 'apply'|'remove'|'revert'
  const {
    t,
    lang,
    userProfile,
    saveProfile,
    saveLanguage,
    uiPrefs,
    saveThemeMode,
  } = useApp();
  const [toneInput, setToneInput] = useState(userProfile.roleTone || '');
  const [toneSuggestions, setToneSuggestions] = useState([]);

  // Texto "primario" reactivo al modo claro/oscuro. Los textos de este modal
  // usaban `text-white` fijo, por lo que en modo claro quedaban invisibles
  // (blanco sobre fondo claro). El resto de la app usa colores que ya
  // reaccionan al tema; aquí lo resolvemos localmente con el mismo dato
  // (uiPrefs.themeMode) que ya tenemos disponible.
  const isLightMode = uiPrefs.themeMode === 'light';
  const textPrimary = isLightMode ? 'text-gray-900' : 'text-white';
  const textSecondary =
  isLightMode
    ? 'text-gray-600'
    : 'text-gray-400';

  // Cargar settings actuales al abrir
  useEffect(() => {
    async function loadSettings() {

      const models =
        await window.electronAPI.ollama.getModels();
      setAvailableModels(models);
      //console.log('MODELS:', models);
      const s =
        await window.electronAPI.settings.get();

      // Migración: si venías de una versión anterior con un solo `apiKey`,
      // lo colocamos bajo su proveedor dentro del mapa apiKeys.
      const loadedKeys = { ...(s.apiKeys || {}) };
      if (s.apiKey && !loadedKeys[s.provider]) loadedKeys[s.provider] = s.apiKey;
      setApiKeys(loadedKeys);
      setTemperature(s.temperature || 0.85);
      setMaxTokens(s.maxTokens || 1000);
      setMaxContext(s.maxContextTokens || 4000);
      setProvider(s.provider || DEFAULT_PROVIDER);
      setModel(s.model || PROVIDERS[s.provider || DEFAULT_PROVIDER]?.defaultModel || '');
      const	uiPrefs	=	await	window.electronAPI.uiPrefs.get();
			setThemeHue(uiPrefs.themeHue	??	THEME_BASE_HUE);
			setAppWallpaper(uiPrefs.appWallpaper	??	null);
			setPreviousWallpaper(uiPrefs.previousWallpaper ?? null); 
      applyThemeHue(uiPrefs.themeHue	??	THEME_BASE_HUE);
    }

    loadSettings();
  }, []);

  function	applyThemeHue(hue)	{
		const	shift	=	hue	-	THEME_BASE_HUE;
		document.documentElement.style.setProperty('--theme-hue-shift',	shift);
	}
	async	function	handleSelectThemePreset(hue)	{
		setThemeHue(hue);
		applyThemeHue(hue);
		await	window.electronAPI.uiPrefs.update({	themeHue:	hue	});
	}
  async	function	handleHueSlider(value)	{
		const	hue	=	parseInt(value);
		setThemeHue(hue);
		applyThemeHue(hue);
	}
	async	function	handleHueSliderCommit()	{
		await	window.electronAPI.uiPrefs.update({	themeHue	});
	}
	async	function	handleSelectAppWallpaperImage()	{
		setWallpaperLoading(true);
		setWallpaperError('');
		try	{
			const	filePath	=	await	window.electronAPI.image.selectFile();
			if	(!filePath)	{	setWallpaperLoading(false);	return;	}
			const	dataUri	=	await	window.electronAPI.image.toBase64(filePath);
			setAppWallpaperPreview(dataUri);
			//	Nota:	se	aplica	vía	estado	global	en	AppContext	(ver	sección	7.2),
			//	aquí	solo	persistimos.
		}	catch	(err)	{
		  setWallpaperError(err.message);
	  }	finally	{
  		setWallpaperLoading(false);
		}
	}
  async function handleApplyWallpaper() {
    if(!wallpaperPreview) return;
    setPreviousWallpaper(appWallpaper);
    setAppWallpaper(wallpaperPreview);
    setWallpaperPreview(null);
    document.documentElement.style.setProperty(
      '--app-wallpaper-image',`url(${wallpaperPreview})`
    );
    await window.electronAPI.uiPrefs.update({
      appWallpaper: wallpaperPreview,
      previousWallpaper: appWallpaper,
    });
  }
  async function handleCancelWallpaperPreview() {
    setWallpaperPreview(null);
  }
  function handleRemoveWallpaper(){
    setConfirmTarget('remove');
    setShowConfirmModal(true);
  }
  function handleRevertWallpaper(){
    setConfirmTarget('revert');
    setShowConfirmModal(true);
  }
  async function handleConfirmAction() {
    setShowConfirmModal(false);
    if (confirmTarget==='remove'){
      setPreviousWallpaper(appWallpaper);
      setAppWallpaper(null);
      document.documentElement.style.setProperty(
        '--app-wallpaper-image', 'none'
      );
      await window.electronAPI.uiPrefs.update({
        appWallpaper: null,
        previousWallpaper:appWallpaper,
      });
    } else if (confirmTarget==='revert'){
      const prev =previousWallpaper;
      setAppWallpaper(prev);
      setPreviousWallpaper(null);
      document.documentElement.style.setProperty(
        '--app-wallpaper-image', prev? `url(${prev})`:'none'
      );
      await window.electronAPI.uiPrefs.update({
        appWallpaper: prev,
        previousWallpaper: null,
      });
    }
    setConfirmTarget(null);
  }
  function handleCancelAction(){
    setShowConfirmModal(false);
    setConfirmTarget(null);
  }
	async	function	handleClearAppWallpaper()	{
		setAppWallpaper(null);
		await	window.electronAPI.uiPrefs.update({	appWallpaper:	null	});
	}


  async function handleExportBackup() {
    const result = await window.electronAPI.data.exportAll();
    if (result?.success) {
      setError('');
      setSuccess(t('settings.exportSuccess'));
      setTimeout(() => setSuccess(''), 3000);
    } else {
      setError(result?.error || t('settings.exportError'));
    }
  }

  async function handleImportBackup() {
    const result = await window.electronAPI.data.importAll();
    if (result?.success) {
      setError('');
      setSuccess(t('settings.importSuccess'));
      setTimeout(() => window.location.reload(), 1200);
    } else if (result?.canceled) {
      // el usuario cerró el selector de archivo sin elegir nada, no pasa nada
    } else {
      setError(result?.error || t('settings.importError'));
    }
  }

  async function saveSettings() {
    const currentProviderMeta = PROVIDERS[provider] || {};
    const currentKey = apiKeys[provider] || '';

    // Validar API Key solo si el proveedor activo la necesita (ej. Ollama no)
    if (currentProviderMeta.requiresApiKey && currentKey.trim().length < 10) {
      setError(t('ai.invalidKey', { provider: currentProviderMeta.label }));
      return;
    }

    await window.electronAPI.settings.update({
      apiKey: currentKey, // legacy: mantiene compatibilidad con la app de escritorio
      apiKeys,
      temperature,
      maxTokens,
      maxContextTokens: maxContext,
      provider,
      model,
    });
    setError('');
    setSuccess(t('ai.sucesfullSave'));
    setTimeout(() => setSuccess(''), 3000);
  }

  return (
    <div className='absolute inset-0 bg-black/60 backdrop-blur-sm z-50
                    flex items-center justify-center p-4'>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className='w-full bg-card-bg rounded-2xl border border-white/10 overflow-hidden'
      >
        {/* Header */}
        <div className='flex items-center justify-between px-4 py-3
                        border-b border-white/10'>
          <div className='flex items-center gap-2'>
            <Sliders size={16} className='text-accent' />
            <h2 className={`text-sm font-bold ${textPrimary}`}>{t('settings.title')}</h2>
          </div>
          <button onClick={onClose}
            className='p-1.5 rounded-lg hover:bg-white/10 textSecondary'>
            <X size={16} />
          </button>
        </div>

        <div className='p-4 space-y-4	max-h-[70vh]	overflow-y-auto	thin-scrollbar'>
          
          {section === 'main' && (
            <div className='space-y-3'>
              <button
                onClick={() => setSection('profile')}
                className='w-full flex items-center justify-between p-4 rounded-xl bg-card-bg border border-white/10 hover:bg-white/5'
              >
                <span className={textPrimary}>👤 {t('settings.profile')}</span>
                <span>›</span>
              </button>
              <button
		  					onClick={()	=>	setSection('appearance')}
								className='w-full flex items-center justify-between p-4 rounded-xl bg-card-bg border border-white/10 hover:bg white/5'
							>
	  						<span className={textPrimary}>	{t('settings.appearance')}</span>
								<span>›</span>
  						</button>
              <button
                onClick={() => setSection('language')}
                className='w-full flex items-center justify-between p-4 rounded-xl bg-card-bg border border-white/10 hover:bg-white/5'
              >
                <span className={textPrimary}>🌍 {t('settings.language')}</span>
                <span>›</span>
              </button>

              <button
                onClick={() => setSection('ai')}
                className='w-full flex items-center justify-between p-4 rounded-xl bg-card-bg border border-white/10 hover:bg-white/5'
              >
                <span className={textPrimary}>🤖 {t('settings.ai')}</span>
                <span>›</span>
              </button>

              {/* Solo aparece en la versión web (PWA) — Electron guarda los datos de otra forma */}
              {window.electronAPI?.data && (
                <button
                  onClick={() => setSection('backup')}
                  className='w-full flex items-center justify-between p-4 rounded-xl bg-card-bg border border-white/10 hover:bg-white/5'
                >
                  <span className={textPrimary}>💾 {t('settings.backup')}</span>
                  <span>›</span>
                </button>
              )}
            </div>
          )}
          	{/*	Apariencia	—	NUEVA	SECCIÓN	*/}
										{section	===	'appearance'	&&	(
												<>
														<button
																onClick={()	=>	setSection('main')}
																className='text-sm	textSecondary	hover:text-white'
														>
																←	{t('settings.back')}
														</button>
								{/* Interruptor Claro / Oscuro */}
								<div className='border border-white/10 rounded-xl p-3 mt-3'>
									<h3 className={`flex items-center gap-2 text-sm font-semibold ${textPrimary} mb-1`}>
										<Sun size={14} className='text-accent' />
										{t('appearance.brightnessTitle')}
									</h3>
									<p className='text-xs text-gray-500 mb-3'>
										{t('appearance.brightnessSubtitle')}
									</p>
									<div className='grid grid-cols-2 gap-2'>
										<button
											onClick={() => saveThemeMode('dark')}
											className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm transition-all ${(uiPrefs.themeMode || 'dark') === 'dark' ? `border-white/60 bg-white/5 ${textPrimary}` : 'border-white/10 textSecondary hover:border-white/30'}`}
										>
											<Moon size={14} /> {t('appearance.dark')}
										</button>
										<button
											onClick={() => saveThemeMode('light')}
											className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm transition-all ${uiPrefs.themeMode === 'light' ? `border-accent bg-accent/10 ${textPrimary}` : 'border-white/10 textSecondary hover:border-white/30'}`}
										>
											<Sun size={14} /> {t('appearance.light')}
										</button>
									</div>
								</div>
														{/*	Selector	de	Theme	(color)	*/}
														<div	className='border	border-white/10	rounded-xl	p-3	mt-3'>
																<h3	className={`flex	items-center	gap-2	text-sm	font-semibold	${textPrimary}	mb-1`}>
																		<Palette	size={14}	className='text-accent'	/>
																		{t('appearance.themeTitle')}
																</h3>
																<p	className='text-xs	text-gray-500	mb-3'>
																		{t('appearance.themeSubtitle')}
																</p>
																<div	className='grid	grid-cols-4	gap-2'>
																		{THEME_PRESETS.map(preset	=>	{
																				const	isActive	=	themeHue	===	preset.hue;
																				return	(
																						<button
																								key={preset.id}
																								onClick={()	=>	handleSelectThemePreset(preset.hue)}
																								title={preset.label}
																								className={`relative	flex	flex-col	items-center	gap-1	p-2	rounded-xl	border	transition-all
																										${isActive	?	'border-white/60	bg-white/5'	:	'border-white/10	hover:border-white/30'}`}
																						>
																								<span
																										className='w-7	h-7	rounded-full	flex	items-center	justify-center'
																										style={{	backgroundColor:	preset.swatch	}}
																								>
																										{isActive	&&	<Check	size={14}	className='text-white'	/>}
																								</span>
																								<span	className='text-[10px]	textSecondary'>{preset.label}</span>
																						</button>
																				);
																		})}
																</div>
																{/*	Slider	de	ajuste	fino	del	tono	(opcional,	para	quien	quiera	un	tono	custom)	*/}
																<div	className='mt-4'>
																		<label	className='text-xs	text-gray-500	mb-1.5	block'>
																				{t('appearance.fineTune')}	<span	className='text-accent'>{themeHue}°</span>
																		</label>
																		<input
																				type='range'
																				min='0'
																				max='359'
																				step='1'
																				value={themeHue}
																				onChange={e	=>	handleHueSlider(e.target.value)}
																				onMouseUp={handleHueSliderCommit}
																				onTouchEnd={handleHueSliderCommit}
																				className='w-full'
																				style={{
																						accentColor:	`hsl(${themeHue}	83%	58%)`,
																						background:	'linear-gradient(to	right,	red,	yellow,	lime,	cyan,	blue,	magenta,	red)',
																						height:	'6px',
																						borderRadius:	'999px',
																				}}
																		/>
																</div>
														</div>
														{/*	Selector	de	fondo	de	pantalla	de	la	APP	*/}
														<div className='border border-white/10 rounded-xl p-3 mt-3'>
                        <h3 className={`flex items-center gap-2 text-sm font-semibold ${textPrimary} mb-1`}>
                        <ImageIcon size={14} className='text-accent' />
                        {t('appearance.wallpaperTitle')}
                        </h3>
                        <p className='text-xs text-gray-500 mb-3'>{t('appearance.wallpaperSubtitle')}</p>
                        {/* Preview del wallpaper actual aplicado */}
                        {appWallpaper && !wallpaperPreview && (
                        <div className='w-full h-24 rounded-xl overflow-hidden mb-2 border
                        border-white/10 relative group'>
                        <img src={appWallpaper} alt='wallpaper'
                        className='w-full h-full object-cover' />
                        <div className='absolute inset-0 bg-black/40 opacity-0
                        group-hover:opacity-100 transition-opacity
                        flex items-center justify-center gap-2'>
                        <span className='text-xs text-white'>
                        {t('appearance.currentWallpaper')}
                        </span>
                        </div>
                        </div>
                        )}
                        {/* Preview de la imagen PENDIENTE de confirmar */}
                        {wallpaperPreview && (
                        <div className='mb-3'>
                        <p className='text-xs text-yellow-400 mb-1.5'>
                        {t('appearance.previewPending')}
                        </p>
                        <div className='w-full h-24 rounded-xl overflow-hidden
                        border border-yellow-400/40'>
                        <img src={wallpaperPreview} alt='preview'
                        className='w-full h-full object-cover' />
                        </div>
                        {/* Botones Aplicar y Cancelar */}
                        <div className='flex gap-2 mt-2'>
                        <button type='button' onClick={handleApplyWallpaper}
                        className='flex-1 bg-accent text-white text-xs font-semibold
                        py-2 rounded-xl hover:bg-accent/80 transition-colors'>
                        {t('appearance.applyWallpaper')}
                        </button>
                        <button type='button' onClick={handleCancelWallpaperPreview}
                        className='flex-1 bg-card-bg textSecondary text-xs font-semibold
                        py-2 rounded-xl border border-white/10
                        hover:bg-white/5 transition-colors'>
                        {t('appearance.cancelWallpaper')}
                        </button>
                        </div>
                        </div>
                        )}
                        {/* Botones principales */}
                        <div className='flex gap-2'>
                        <button type='button' disabled={wallpaperLoading}
                        onClick={handleSelectAppWallpaperImage}
                        className='flex-1 bg-app-bg border border-dashed border-white/20
                        hover:border-accent/60 text-gray-300 hover:text-white
                        rounded-xl p-3 flex items-center justify-center gap-2
                        text-xs font-medium transition-all disabled:opacity-50'>
                        <ImageIcon size={14} />
                        {wallpaperLoading
                        ? t('appearance.loading')
                        : t('appearance.chooseImage')}
                        </button>
                        {/* Boton quitar — pide confirmacion */}
                        {appWallpaper && !wallpaperPreview && (
                        <button type='button' onClick={handleRemoveWallpaper}
                        title={t('appearance.removeWallpaper')}
                        className='px-3 rounded-xl border border-white/10 textSecondary
                        hover:text-red-400 hover:border-red-500/40
                        transition-colors'>
                        <Trash2 size={14} />
                        </button>
                        )}
                        {/* Boton revertir al anterior */}
                        {previousWallpaper && !wallpaperPreview && (
                        <button type='button' onClick={handleRevertWallpaper}
                        title={t('appearance.revertWallpaper')}
                        className='px-3 rounded-xl border border-white/10 textSecondary
                        hover:text-accent-2 hover:border-accent-2/40
                        transition-colors'>
                        <RotateCcw size={14} />
                        </button>
                        )}
                        </div>
                        {wallpaperError && (
                        <p className='text-xs text-red-400 mt-2'>{wallpaperError}</p>
                        )}
                        </div>
                        {/* Modal de confirmacion para quitar/revertir */}
                        {showConfirmModal && (
                        <div className='absolute inset-0 bg-black/70 backdrop-blur-sm z-10
                        flex items-center justify-center p-4'>
                        <div className='bg-card-bg border border-white/10 rounded-2xl p-4
                        w-full max-w-xs'>
                        <p className={`text-sm font-semibold ${textPrimary} mb-2`}>
                        {confirmTarget === 'remove'
                        ? t('appearance.confirmRemoveTitle')
                        : t('appearance.confirmRevertTitle')}
                        </p>
                        <p className='text-xs textSecondary mb-4'>
                        {confirmTarget === 'remove'
                        ? t('appearance.confirmRemoveDesc')
                        : t('appearance.confirmRevertDesc')}
                        </p>
                        <div className='flex gap-2'>
                        <button onClick={handleConfirmAction}
                        className='flex-1 bg-red-500/20 text-red-400
                        border border-red-500/30 rounded-xl py-2
                        text-xs font-semibold hover:bg-red-500/30
                        transition-colors'>
                        {t('appearance.confirmYes')}
                        </button>
                        <button onClick={handleCancelAction}
                        className='flex-1 bg-card-bg textSecondary
                        border border-white/10 rounded-xl py-2
                        text-xs font-semibold hover:bg-white/5
                        transition-colors'>
                        {t('appearance.confirmNo')}
                        </button>
                        </div>
                        </div>
                        </div>
                        )}
												</>
										)}

          {/* Perfil */}
          {section === 'profile' &&(
            <>
            <button
              onClick={() => setSection('main')}
              className={`text-sm textSecondary ${isLightMode ? 'hover:text-gray-900' : 'hover:text-white'}`}
            >
              ← {t('settings.back')}
            </button> 
            <div className='border border-white/10 rounded-xl p-3'>
              <p className='text-xs text-gray-500 mb-3'>
                  {t('profile.autoSave')}
              </p>
              <h3 className={`flex items-center gap-2 text-sm font-semibold ${textPrimary} mb-3`}>
                {userProfile.avatar?.startsWith('data:') ? (
                  <img
                    src={userProfile.avatar}
                    alt='avatar'
                    className='w-6 h-6 rounded-full object-cover'
                  />
                ) : (
                  <span>{userProfile.avatar || '👤'}</span>
                )}

                {t('profile.title')}
              </h3>

              <label className='text-xs text-gray-500 mb-1.5 block'>
                {t('profile.IAname')}
              </label>

              <input
                value={userProfile.alias}
                onChange={e => saveProfile({ alias: e.target.value })}
                placeholder={t('profile.namePlaceholder')}
                className={`w-full bg-app-bg ${textPrimary} text-sm rounded-xl px-3 py-2.5 border border-white/10 focus:border-accent/60 outline-none`}
              />
            </div>
            <AvatarPicker
              value={userProfile.avatar}
              onChange={(newAvatar) =>
                saveProfile({
                  avatar: newAvatar
                })
              }
            />
            <div className='mt-4'>
              <label className='text-xs text-gray-500 mb-1.5 block'>
                {t('profile.tone')}
              </label>

              <input
                value={toneInput}
                onChange={(e) => {
                  const value = e.target.value;
                  setToneInput(value);

                  if (!value.trim()) {
                    setToneSuggestions([]);
                    return;
                  }

                  setToneSuggestions(
                    DEFAULT_TONES.filter(t =>
                      t.toLowerCase().includes(value.toLowerCase())
                    )
                  );
                }}
                onBlur={() => {
                  if (toneInput.trim()) {
                    saveProfile({
                      roleTone: toneInput.trim()
                    });
                  }
                }}
                placeholder={t('profile.tonePlaceholder')}
                className={`w-full bg-app-bg ${textPrimary} text-sm rounded-xl px-3 py-2.5 border border-white/10 focus:border-accent/60 outline-none`}
              />
              {toneSuggestions.length > 0 && (
                <div className='mt-2 bg-card-bg border border-white/10 rounded-xl overflow-hidden'>
                  {toneSuggestions.map(tone => (
                    <button
                      key={tone}
                      type='button'
                      onClick={() => {
                        setToneInput(tone);
                        saveProfile({
                          roleTone: tone
                        });
                        setToneSuggestions([]);
                      }}
                      className='block w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-white/5'
                    >
                      {tone}
                    </button>
                  ))}
                </div>
              )}
            </div>
            </>
          )}
          {section === 'ai' && (
            <>
              <button
                onClick={() => setSection('main')}
                className={`text-sm textSecondary ${isLightMode ? 'hover:text-gray-900' : 'hover:text-white'}`}
              >
                ← {t('settings.back')}
              </button>
              <label className='text-xs text-gray-500 mb-1.5 block'>
                {t('ai.provider')}
              </label>

              <select
                value={provider}
                onChange={(e) => {
                  const newProvider = e.target.value;
                  const meta = PROVIDERS[newProvider];

                  setProvider(newProvider);

                  if (meta.models === null) {
                    // Modelos dinámicos (ej. Ollama): usar el primero disponible
                    setModel(availableModels[0] || '');
                  } else {
                    setModel(meta.defaultModel || meta.models[0] || '');
                  }
                }}
                className={`w-full bg-app-bg ${textPrimary} text-sm rounded-xl px-3 py-2.5 border border-white/10`}
              >
                {Object.entries(PROVIDERS).map(([id, meta]) => (
                  <option key={id} value={id}>{meta.label}</option>
                ))}
              </select>
              <label className='text-xs text-gray-500 mb-1.5 block'>
                {t('ai.model')}
              </label>
              {/* {console.log('CURRENT MODEL:', model)} */}
              <select
                value={model}
                onChange={e =>
                  setModel(
                    e.target.value
                  )
                }
                className={`w-full bg-app-bg ${textPrimary} text-sm rounded-xl px-3 py-2.5 border border-white/10`}
              >
                {(PROVIDERS[provider].models === null ? availableModels : PROVIDERS[provider].models)
                  .map(modelName => (
                    <option key={modelName} value={modelName}>
                      {modelName}
                    </option>
                  ))}
              </select>
              {/* API Key — solo se muestra si el proveedor la necesita */}
              {PROVIDERS[provider].requiresApiKey && (
                <div>
                  <label className='text-xs text-gray-500 mb-1.5 flex items-center gap-1'>
                    <Key size={11} /> {t('ai.key')} ({PROVIDERS[provider].label})
                  </label>
                  <input
                    type='password'
                    value={apiKeys[provider] || ''}
                    onChange={e => setApiKeys(prev => ({ ...prev, [provider]: e.target.value }))}
                    placeholder={PROVIDERS[provider].keyPlaceholder || 'sk-...'}
                    className={`w-full bg-app-bg ${textPrimary} text-sm rounded-xl px-3 py-2.5
                              border border-white/10 focus:border-accent/60 outline-none
                              placeholder-gray-700 font-mono`}
                  />
                  <p className='text-xs text-gray-600 mt-1'>
                    {t('ai.hint')}
                  </p>
                </div>
              )}

              {/* Temperature */}
              <div>
                <label className='text-xs text-gray-500 mb-1.5 block'>
                  {t('ai.temperature')} <span className='text-accent'>{temperature}</span>
                </label>
                <input type='range' min='0' max='1' step='0.05'
                  value={temperature}
                  onChange={e => setTemperature(parseFloat(e.target.value))}
                  className='w-full accent-violet-500'
                />
                <div className='flex justify-between text-xs text-gray-700 mt-0.5'>
                  <span>{t('ai.tempRange0')}</span>
                  <span>{t('ai.tempRange1')}</span>
                </div>
              </div>

              {/* Max Tokens respuesta */}
              <div>
                <label className='text-xs text-gray-500 mb-1.5 block'>
                  {t('ai.tokenAnswer')} <span className='text-accent'>{maxTokens}</span>
                </label>
                <input type='range' min='200' max='4000' step='100'
                  value={maxTokens}
                  onChange={e => setMaxTokens(parseInt(e.target.value))}
                  className='w-full accent-violet-500'
                />
              </div>

              {/* Max Context */}
              <div>
                <label className='text-xs text-gray-500 mb-1.5 block'>
                  {t('ai.tokenContext')}  <span className='text-accent'>{maxContext}</span>
                </label>
                <input type='range' min='2000' max='32000' step='1000'
                  value={maxContext}
                  onChange={e => setMaxContext(parseInt(e.target.value))}
                  className='w-full accent-violet-500'
                />
              </div>

              {/* Feedback */}
              {error   && <p className='text-red-400 text-xs bg-red-500/10 rounded-lg px-3 py-2'>{error}</p>}
              {success && <p className='text-green-400 text-xs bg-green-500/10 rounded-lg px-3 py-2'>{success}</p>}

              {/* Botón guardar */}
              <button onClick={saveSettings}
                className='w-full bg-accent text-white text-sm font-medium py-2.5
                          rounded-xl hover:bg-accent/80 transition-colors flex items-center
                          justify-center gap-2'>
                <Save size={14} />{t('ai.save')} 
              </button>
            </>
          )}

          {section === 'language' && (
            <>
              <button
                onClick={() => setSection('main')}
                className='text-sm textSecondary hover:text-white mb-4'
              >
                ← {t('settings.back')}
              </button>

              <h3 className={`text-lg font-semibold ${textPrimary} mb-4`}>
                {t('settings.language')}
              </h3>

              <div className='space-y-3'>

                <button
                  onClick={() => saveLanguage('en')}
                  className={`w-full flex items-center justify-between p-4 rounded-xl border transition-colors ${
                    lang === 'en'
                      ? 'border-accent bg-accent/10'
                      : 'border-white/10 bg-card-bg hover:bg-white/5'
                  }`}
                >
                  <span className={textPrimary}>🇺🇸 English</span>
                  {lang === 'en' && <span>✓</span>}
                </button>

                <button
                  onClick={() => saveLanguage('es')}
                  className={`w-full flex items-center justify-between p-4 rounded-xl border transition-colors ${
                    lang === 'es'
                      ? 'border-accent bg-accent/10'
                      : 'border-white/10 bg-card-bg hover:bg-white/5'
                  }`}
                >
                  <span className={textPrimary}>🇪🇸 Español</span>
                  {lang === 'es' && <span>✓</span>}
                </button>
                
              </div>
            </>
          )}

          {section === 'backup' && (
            <>
              <button
                onClick={() => setSection('main')}
                className='text-sm textSecondary hover:text-white mb-4'
              >
                ← {t('settings.back')}
              </button>

              <h3 className={`text-lg font-semibold ${textPrimary} mb-2`}>
                💾 {t('settings.backup')}
              </h3>
              <p className='text-xs text-gray-500 mb-4'>
                {t('settings.backupDesc')}
              </p>

              <div className='space-y-3'>
                <button
                  onClick={handleExportBackup}
                  className='w-full flex items-center justify-center gap-2 p-4 rounded-xl
                            bg-accent hover:bg-accent/80 transition-colors text-white'
                >
                  <Save size={14} /> {t('settings.exportBackup')}
                </button>

                <button
                  onClick={handleImportBackup}
                  className={`w-full flex items-center justify-center gap-2 p-4 rounded-xl
                            border border-white/10 bg-card-bg hover:bg-white/5 transition-colors ${textPrimary}`}
                >
                  📥 {t('settings.importBackup')}
                </button>

                <p className='text-xs text-gray-600'>
                  {t('settings.importWarning')}
                </p>
              </div>
            </>
          )}



        </div>
      </motion.div>
    </div>
  );
}