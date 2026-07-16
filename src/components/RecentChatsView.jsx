import React, { useEffect, useState } from 'react';
import { MessageCircle, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { useApp } from '../context/AppContext';
import { getTaxonomy } from '../constants/taxonomy';

/**
 * Vista de chats recientes.
 * Muestra cada personaje UNA SOLA VEZ, ordenado por actividad más reciente.
 *
 * @param {Array} characters - Todos los personajes
 * @param {Function} onSelectCharacter - Click en personaje → CharacterProfile
 */
export default function RecentChatsView({ characters, onSelectCharacter }) {
    const { t } = useApp();
    const [recentItems, setRecentItems] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        buildRecentList();
    }, [characters]);

    async function buildRecentList() {
        setLoading(true);
        const items = [];

        for (const char of characters) {
            // Obtener conversaciones de este personaje
            const convs = await window.electronAPI.conversations.byCharacter(char.id);
            // Filtrar solo las que tienen mensajes reales (excluir convs vacías)
            const withMessages = convs.filter(c => c.messages && c.messages.length > 0);
            
            if (withMessages.length === 0) continue; // Sin historial → no aparece

            // Tomar la más reciente (byCharacter ya las devuelve ordenadas por lastActivity)
            const latestConv = withMessages[0];
            // Obtener el último mensaje para mostrarlo como preview
            const lastMsg = latestConv.messages[latestConv.messages.length - 1];

            items.push({
                character: char,
                conversation: latestConv,
                lastMessage: lastMsg,
                lastActivity: latestConv.lastActivity,
                totalConvs: withMessages.length,
            });
        }

        // Ordenar por actividad más reciente primero
        items.sort((a, b) => b.lastActivity - a.lastActivity);
        setRecentItems(items);
        setLoading(false);
    }

    // Formatea timestamp relativo legible
    function formatRelativeTime(ts) {
        const diff = Date.now() - ts;
        const mins = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (mins < 1) return t('sessionList.relativeTime.now');
        if (mins < 60) return t('sessionList.relativeTime.minutes', { count: mins });
        if (hours < 24) return t('sessionList.relativeTime.hours', { count: hours });
        if (days < 2) return t('sessionList.relativeTime.yesterday');
        return t('sessionList.relativeTime.days', { count: days });
    }

    // Determina si el avatar es imagen o emoji
    const isImage = (avatar) =>
        avatar?.startsWith('data:') || avatar?.startsWith('file://');

    return (
        <div className='flex flex-col h-full bg-app-bg'>
            {/* Header */}
            <div className='px-4 pt-12 pb-4 bg-gradient-to-b from-card-bg to-transparent'>
                <h1 className='text-xl font-bold text-white'>
                    {t('recentChats.title')}
                </h1>
                <p className='text-xs text-gray-500 mt-0.5'>
                    {recentItems.length > 0
                        ? `${recentItems.length} ${
                              recentItems.length === 1
                                  ? t('recentChats.conversations')
                                  : t('recentChats.conversations_plural')
                          }`
                        : ''}
                </p>
            </div>

            {/* Lista de chats recientes */}
            {/* Padding inferior para que el NavBar no tape el último ítem */}
            <div className='flex-1 overflow-y-auto px-4 pb-28 space-y-2'>
                {/* Estado vacío */}
                {!loading && recentItems.length === 0 && (
                    <div className='flex flex-col items-center justify-center h-full text-center py-20 text-gray-600'>
                        <MessageCircle size={40} className='mb-4 opacity-30' />
                        <p className='text-sm font-medium'>{t('recentChats.empty')}</p>
                        <p className='text-xs mt-1'>{t('recentChats.emptyHint')}</p>
                    </div>
                )}

                {/* Skeleton loader mientras carga */}
                {loading && Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className='flex items-center gap-3 bg-card-bg rounded-2xl p-3 border border-white/5 animate-pulse'>
                        <div className='w-14 h-14 rounded-xl bg-white/5 flex-shrink-0' />
                        <div className='flex-1 space-y-2'>
                            <div className='h-3 bg-white/5 rounded-full w-3/4' />
                            <div className='h-2.5 bg-white/5 rounded-full w-full' />
                            <div className='h-2 bg-white/5 rounded-full w-1/3' />
                        </div>
                    </div>
                ))}

                {/* Items de chat reciente */}
                {!loading && recentItems.map(({ character, conversation, lastMessage, lastActivity, totalConvs }, i) => (
                    <motion.div
                        key={character.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        onClick={() => onSelectCharacter(character)}
                        className='flex items-center gap-3 bg-card-bg rounded-2xl p-3 border border-white/5 cursor-pointer hover:border-accent/30 hover:bg-white/5 transition-all'
                    >
                        {/* Avatar del personaje */}
                        <div className='w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-accent/10 flex items-center justify-center'>
                            {isImage(character.avatar) ? (
                                <img src={character.avatar} alt={character.name} className='w-full h-full object-cover' />
                            ) : (
                                <span className='text-3xl'>{character.avatar || '👤'}</span>
                            )}
                        </div>

                        {/* Info */}
                        <div className='flex-1 min-w-0'>
                            {/* Fila 1: nombre + tiempo */}
                            <div className='flex items-baseline justify-between gap-2'>
                                <p className='font-semibold text-white text-sm truncate'>
                                    {character.name}
                                </p>
                                <p className='text-xs text-gray-600 flex-shrink-0'>
                                    {formatRelativeTime(lastActivity)}
                                </p>
                            </div>

                            {/* Fila 2: preview del último mensaje */}
                            <p className='text-xs text-gray-500 truncate mt-0.5'>
                                {lastMessage?.role === 'user' ? '➤ ' : ''}
                                {lastMessage?.content?.slice(0, 60) || '...'}
                            </p>

                            {/* Fila 3: tags y contador de convs */}
                            <div className='flex items-center gap-1.5 mt-1'>
                                {/* Tags del personaje (máx 2) */}
                                {character.tags?.slice(0, 2).map(tag => {
                                    const tax = getTaxonomy(tag);
                                    return (
                                        <span key={tag} className='text-[10px] px-1.5 py-0.5 rounded-full font-medium'
                                            style={{
                                                backgroundColor: `${tax.color}20`,
                                                color: tax.color,
                                                border: `1px solid ${tax.color}35`,
                                            }}
                                        >
                                            {tax.label}
                                        </span>
                                    );
                                })}

                                {/* Si hay más de 1 conversación, mostrar contador */}
                                {totalConvs > 1 && (
                                    <span className='text-[10px] text-gray-600'>
                                        +{totalConvs - 1} {t('recentChats.conversations')}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Flecha */}
                        <ChevronRight size={14} className='text-gray-700 flex-shrink-0' />
                    </motion.div>
                ))}
            </div>
        </div>
    );
}