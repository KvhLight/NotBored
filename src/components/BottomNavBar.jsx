import React from 'react';
import { Home, MessageSquare, Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import { useApp } from '../context/AppContext';

/**
* Barra de navegación global fija en la parte inferior.
* Solo se renderiza en las vistas 'sidebar' y 'recentChats'.
*
* @param {String} activeView - Vista activa actual ('sidebar' | 'recentChats')
* @param {Function} onGoHome - Navegar a sidebar
* @param {Function} onGoRecentChats - Navegar a recentChats
* @param {Function} onNewCharacter - Abrir formulario de nuevo personaje
*/

export default function BottomNavBar({
    activeView,
    onGoHome,
    onGoRecentChats,
    onNewCharacter,
}) {
    const { t } = useApp();
    const navItems = [
        {
            id: 'home',
            icon: Home,
            label: t('nav.home'),
            action: onGoHome,
            active: activeView === 'sidebar',
        },
        {
            id: 'recentChats',
            icon: MessageSquare,
            label: t('nav.myChats'),
            action: onGoRecentChats,
            active: activeView === 'recentChats',
        },
    ];
    return (
// El NavBar ocupa posición absoluta al fondo del contenedor
        <div
            className='absolute bottom-0 left-0 right-0 z-20'
            style={{
                background: 'linear-gradient(to top, var(--color-app-bg) 70%, transparent)',
            }}
        >
            {/* Línea separadora superior */}
            <div className='h-px bg-white/10 mx-4' />
            
            <div className='grid grid-cols-3 items-center text-center px-2 pt-2 pb-6'>
            {/* Botones Home y Mis Chats */}
            {navItems.map(item => (
                <motion.button
                    key={item.id}
                    whileTap={{ scale: 0.92 }}
                    onClick={item.action}
                    className='flex flex-col items-center gap-1 px-6 py-2 rounded-2xl
                    transition-colors relative'
                >
                    {/* Indicador de activo — píldora detrás del icono */}
                    {item.active && (
                        <motion.div
                            layoutId='nav-indicator'
                            className='absolute inset-0 bg-accent/15 rounded-2xl'
                            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                        />
                    )}
                    <item.icon
                        size={20}
                        className={item.active ? 'text-accent' : 'text-gray-500'}
                    />
                    <span
                        className={`text-xs font-medium transition-colors
                        ${item.active ? 'text-accent' : 'text-gray-500'}`}
                    >
                        {item.label}
                    </span>
                </motion.button>
            ))}

            {/* Botón + — crear nuevo personaje */}
            <motion.button
                whileTap={{ scale: 0.92 }}
                whileHover={{ scale: 1.05 }}
                onClick={onNewCharacter}
                title={t('nav.newChar')}
                className='flex flex-col items-center gap-1 py-2 w-full'
            >
                <div className='w-10 h-10 bg-accent rounded-2xl flex items-center
                justify-center shadow-lg shadow-accent/30'>
                    <Plus size={20} className='text-white' />
                </div>
                <span className='text-xs font-medium text-gray-500'>
                {t('nav.newChar')}
                </span>
            </motion.button>
        </div>
    </div>
);
}