import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, MessageCircle, MoreHorizontal, RotateCcw, GitBranch, X, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../context/AppContext';
import { getTaxonomy } from '../constants/taxonomy';

/**
* Pantalla de perfil de personaje.
* Se muestra ANTES del ChatWindow al hacer click en un personaje.
*
* @param {Object} character - Objeto personaje completo
* @param {Array} conversations - Conversaciones existentes del personaje
* @param {Function} onBack - Volver al Sidebar
* @param {Function} onStartChat - Iniciar/continuar chat (conv existente o nueva)
* @param {Function} onResetChat - Borrar conv actual y crear una nueva
* @param {Function} onNewTimeline - Crear nueva conv SIN borrar las anteriores
*/
export default function CharacterProfile({
    character,
    conversations,
    onBack,
    onStartChat,
    onResetChat,
    onNewTimeline,
    onTagClick, 
    onToggleFavorite,
}) {
const { t } = useApp();
const [showMenu, setShowMenu] = useState(false);
const menuRef = useRef(null);

// Determinar si hay conversaciones previas con mensajes reales
const hasConversations = conversations.length > 0 &&
    conversations.some(c => c.messages.length > 0);

// Cerrar el menú al hacer click fuera
useEffect(() => {
    function handleClickOutside(e) {
        if (menuRef.current && !menuRef.current.contains(e.target)) {
            setShowMenu(false);
        }
    }
    document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

// Determinar si el avatar es una imagen real o un emoji
const isImage = character.avatar?.startsWith('data:') ||
    character.avatar?.startsWith('file://');

return (
    <div className='flex flex-col h-full bg-app-bg overflow-hidden'>
        {/* nn Botón volver — flotante sobre la imagen nn */}
        <button
            onClick={onBack}
            className='absolute top-12 left-4 z-20 p-2 rounded-xl
            bg-black/40 backdrop-blur-sm text-white
            hover:bg-black/60 transition-colors'
        >
            <ArrowLeft size={18} />
        </button>
        {/*	nn	Botón	de	Favorito	—	flotante,	esquina	opuesta	nn	*/}
		<button
				onClick={()	=>	onToggleFavorite?.(character)}
				title={character.isFavorite	?	'Quitar	de	favoritos'	:	'Marcar	como	favorito'}
				className={`absolute	top-12	right-4	z-20	p-2	rounded-xl
				backdrop-blur-sm	transition-colors
                ${character.isFavorite
                    ?	'bg-black/40	text-yellow-400'
                    :	'bg-black/40	text-white	hover:text-yellow-400'}`}
            >
                <Star	size={18}	fill={character.isFavorite	?	'currentColor'	:	'none'}	/>
        </button>
        {/* nn Área scrolleable (imagen + texto) nn */}
        <div className='flex-1 overflow-y-auto'>
            {/* nn ZONA SUPERIOR: Avatar nn */}
            <div className='relative w-full h-[55%] min-h-[300px]'>
                {/* Fondo — imagen real o emoji con gradiente de color */}
                {isImage ? (
                    <img
                        src={character.avatar}
                        alt={character.name}
                        className='absolute inset-0 w-full h-full object-cover object-top'
                    />
            ) : (
                // Fondo con gradiente para emoji
                <div className='absolute inset-0 bg-gradient-to-br
                from-accent/40 via-card-bg to-app-bg
                flex items-center justify-center'>
                    <span
                        className='text-[110px] select-none'
                        style={{ filter: 'drop-shadow(0 8px 32px rgba(124,58,237,0.4))' }}
                    >
                        {character.avatar || 'n'}
                    </span>
                </div>
            )}
            {/* Degradado inferior — funde la imagen con el fondo de texto */}
            <div
                className='absolute bottom-0 left-0 right-0 h-40 pointer-events-none'
                style={{
                    background: `
                    linear-gradient(
                        to bottom,
                        transparent 0%,
                        var(--color-card-bg) 70%,
                        var(--color-card-bg) 100%
                    )
                    `
                }}
            />
            {/* Nombre del personaje sobre el degradado inferior */}
            <div className='absolute bottom-4 left-4 right-4 z-10'>
                <h1 className='text-2xl font-bold text-white drop-shadow-lg'>
                    {character.name}
                </h1>
                {/* Contador de conversaciones */}
                {conversations.length > 0 && (
                    <p className='text-xs text-accent-2 mt-0.5 flex items-center gap-1'>
                        <MessageCircle size={11} />
                        {conversations.length}{' '}
                        {conversations.length === 1
                            ? t('characterProfile.conversations')
                            : t('characterProfile.conversations_plural')}
                    </p>
                )}
                {!hasConversations && (
                    <p className='text-xs text-gray-500 mt-0.5'>
                        {t('characterProfile.firstMeet')}
                    </p>
                )}
            </div>
        </div>

        {/* nn ZONA INFERIOR: Información del personaje nn */}
        <div className='px-4 pb-32 space-y-5 mt-2'>
        {/* Tags */}
            {character.tags?.length > 0 && (
                <div>
                    <p className='text-xs text-gray-600 uppercase tracking-widest mb-2'>
                        {t('characterProfile.tags')}
                    </p>
                    <div className='flex flex-wrap gap-1.5'>
                        {character.tags.map(tag => {
                            const tax = getTaxonomy(tag);
                            return (
                                <button
                                    key={tag}
                                    onClick={() => {console.log('CLICKED TAG:', tag); onTagClick?.(tag);}}
                                    className='text-xs px-2.5 py-1 rounded-full font-medium transition-all hover:scale-105 cursor-pointer'
                                    style={{
                                        backgroundColor: `${tax.color}20`,
                                        color: tax.color,
                                        border: `1px solid ${tax.color}40`,
                                    }}
                                >
                                    {tax.label}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Descripción */}
            <div>
                <p className='text-xs text-gray-600 uppercase tracking-widest mb-2'>
                    {t('characterProfile.description')}
                </p>
                <p className='text-sm text-gray-300 leading-relaxed'>
                    {character.description ||
                        t('characterProfile.noDescription')}
                </p>
            </div>
            {/* Personalidad */}
            {character.personality && (
                <div>
                    <p className='text-xs text-gray-600 uppercase tracking-widest mb-2'>
                        {t('characterProfile.personality')}
                    </p>
                    <p className='text-sm text-gray-300 leading-relaxed'>
                        {character.personality}
                    </p>
                </div>
            )}
            {/* Escenario / Lore */}
            {character.scenario && (
                <div>
                    <p className='text-xs text-gray-600 uppercase tracking-widest mb-2'>
                        {t('characterProfile.scenario')}
                    </p>
                    <p className='text-sm text-gray-300 leading-relaxed'>
                        {character.scenario}
                    </p>
                </div>
            )}
        </div>
    </div>
    {/* nn BARRA FIJA INFERIOR — Botones de acción nn */}
    {/* Esta zona NO scrollea — está fija al fondo de la pantalla */}
    <div
        className='absolute bottom-0 left-0 right-0 px-4 pb-8 pt-4'
        style={{
            background: `
                linear-gradient(
                    to bottom,
                    transparent 0%,
                    var(--color-card-bg) 70%,
                    var(--color-card-bg) 100%
                )
                `,
        }}
    >
        <div className='flex items-center gap-2'>
            {/* Botón principal — ocupa todo el ancho si no hay conversaciones,
            o el ancho disponible si hay menú ... */}
            <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={onStartChat}
                className='flex-1 flex items-center justify-center gap-2 py-3.5
                bg-accent text-white rounded-2xl font-semibold text-sm
                hover:bg-accent/80 transition-colors shadow-lg
                shadow-accent/30'
            >
                <MessageCircle size={16} />
                {hasConversations
                    ? t('characterProfile.continueChat')
                    : t('characterProfile.startTalking')}
            </motion.button>
            {/* Botón ... — solo visible si ya hay conversaciones */}
            {hasConversations && (
                <div className='relative' ref={menuRef}>
                    <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={() => setShowMenu(p => !p)}
                        className='w-12 h-12 flex items-center justify-center
                        bg-card-bg rounded-2xl border border-white/10
                        text-gray-400 hover:text-white hover:border-white/30
                        transition-colors'
                        title={t('characterProfile.optionsMenu')}
                    >
                        <MoreHorizontal size={18} />
                    </motion.button>
                    {/* Menú desplegable — aparece hacia arriba */}
                    <AnimatePresence>
                        {showMenu && (
                            <motion.div
                                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 8, scale: 0.95 }}
                                transition={{ duration: 0.15 }}
                                className='absolute bottom-14 right-0 w-56
                                bg-card-bg border border-white/10 rounded-2xl
                                overflow-hidden shadow-2xl shadow-black/50 z-30'
                            >
                                {/* Opción 1: Reiniciar chat */}
                                <button
                                    onClick={() => { setShowMenu(false); onResetChat(); }}
                                    className='w-full flex items-start gap-3 px-4 py-3
                                    hover:bg-white/5 transition-colors text-left
                                    border-b border-white/5'
                                >
                                    <RotateCcw size={15} className='text-red-400 mt-0.5 flex-shrink-0' />
                                    <div>
                                        <p className='text-sm font-medium text-white'>
                                            {t('characterProfile.resetChat')}
                                        </p>
                                        <p className='text-xs text-gray-500 mt-0.5 leading-tight'>
                                            {t('characterProfile.resetChatDesc')}
                                        </p>
                                    </div>
                                </button>
                                {/* Opción 2: Nueva línea temporal */}
                                <button
                                    onClick={() => { setShowMenu(false); onNewTimeline(); }}
                                    className='w-full flex items-start gap-3 px-4 py-3
                                    hover:bg-white/5 transition-colors text-left'
                                >
                                    <GitBranch size={15} className='text-accent-2 mt-0.5 flex-shrink-0' />
                                    <div>
                                        <p className='text-sm font-medium text-white'>
                                            {t('characterProfile.newTimeline')}
                                        </p>
                                        <p className='text-xs text-gray-500 mt-0.5 leading-tight'>
                                            {t('characterProfile.newTimelineDesc')}
                                        </p>
                                    </div>
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            )}
        </div>
    </div>
</div>
);
}