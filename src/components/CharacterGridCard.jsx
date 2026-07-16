import React, { useState } from 'react';
import { Edit2, Trash2, Star } from 'lucide-react';
import { motion } from 'framer-motion';
import { getTaxonomy } from '../constants/taxonomy';

/**
* Tarjeta cuadrada para el grid 2 columnas del Sidebar.
*
* @param {Object} character - Objeto personaje
* @param {Number} index - Índice para la animación de entrada
* @param {Function} onSelect - Click principal que abre CharacterProfile
* @param {Function} onEdit - Editar personaje
* @param {Function} onDelete - Eliminar (con confirmación doble)
* @param {Function} onTagClick - Click en un tag -> activa filtro
*/
export default function CharacterGridCard({
    character,
    index,
    onSelect,
    onEdit,
    onDelete,
    onTagClick,
    onToggleFavorite,
}) {
    const [confirmDel, setConfirmDel] = useState(false);
    const isImage = character.avatar?.startsWith('data:') ||
        character.avatar?.startsWith('file://');

    function handleDelete(e) {
        e.stopPropagation();
        if (confirmDel) {
            onDelete(character.id);
        } else {
            setConfirmDel(true);
            setTimeout(() => setConfirmDel(false), 3000);
        }
    }
    function handleTagClick(e, tagId) {
        e.stopPropagation(); // <- CRITICO: evita abrir el perfil
        onTagClick?.(tagId);
    }
    function	handleToggleFavorite(e)	{
        e.stopPropagation();
        onToggleFavorite?.(character);
    }
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.04 }}
            onClick={() => onSelect(character)}
            className='relative rounded-2xl overflow-hidden cursor-pointer
            border border-white/5 hover:border-accent/40
            transition-all group bg-card-bg'
            style={{ aspectRatio: '1 / 1' }}
        >
            {/* nn Zona superior: Avatar (60% de la tarjeta) nn */}
            <div className='absolute inset-x-0 top-0 h-[62%]'>
                {isImage ? (
                    <img
                        src={character.avatar}
                        alt={character.name}
                        className='w-full h-full object-cover object-center'
                    />
                ) : (
                    // Fondo con gradiente de color para emoji
                    <div
                        className='w-full h-full flex items-center justify-center
                        bg-gradient-to-br from-accent/30 via-card-bg to-app-bg'
                    >
                        <span className='text-5xl select-none'>{character.avatar || 'X'}</span>
                    </div>
                )}
                {/* Degradado que funde el avatar con la zona de texto */}
                <div
                    className='absolute bottom-0 left-0 right-0 h-12 pointer-events-none'
                    style={{
                        background: 'linear-gradient(to bottom, transparent, var(--color-card-bg))',
                    }}
                />
            </div>

            {/* nn Zona inferior: Nombre y Tags (38% de la tarjeta) nn */}
            <div className='absolute inset-x-0 bottom-0 h-[42%] px-2.5 pb-2.5 pt-1
            flex flex-col justify-end gap-1 z-10'>
                
                {/* Nombre del personaje */}
                <p className='text-sm font-semibold text-white truncate px-1'>
                    {character.name}
                </p>

                {/* Tags con desvanecimiento por degradado */}
                {character.tags?.length > 0 && (
                    <div className='relative w-full overflow-hidden pt-0.5'>
                        {/* Contenedor de tags en una sola línea sin wrap */}
                        <div className='flex gap-1 overflow-x-auto thin-scrollbar pr-6'>
                            {character.tags.map(tag => {
                                const tax = getTaxonomy(tag);
                                return (
                                    <button
                                        key={tag}
                                        onClick={(e)=> handleTagClick(e,tag)}
                                        title={tax.label}
                                        className='text-[10px] px-1.5 py-0.5 rounded-full
                                        whitespace-nowrap flex-shrink-0 font-medium'
                                        style={{
                                            backgroundColor: `${tax.color}22`,
                                            color: tax.color,
                                            border: `1px solid ${tax.color}35`,
                                        }}
                                    >
                                        {tax.label}
                                    </button>
                                );
                            })}
                        </div>
                        {/* Degradado derecho que desvanece los tags que no caben */}
                        <div
                            className='absolute top-0 right-0 bottom-0 w-6 pointer-events-none'
                            style={{
                                background: 'linear-gradient(to right, transparent, var(--color-card-bg))',
                            }}
                        />
                    </div>
                )}
            </div>

            {/*	nn	Botón	de	Favorito	—	siempre	visible	si	es	favorito,	si	no	solo	en	hover	nn	*/}
			  <button
                onClick={handleToggleFavorite}
                title={character.isFavorite	?	'Quitar	de	favoritos'	:	'Marcar	como	favorito'}
                className={`absolute	top-2	left-2	w-7	h-7	rounded-lg	backdrop-blur-sm
                flex	items-center	justify-center	z-20	transition-all
                ${character.isFavorite
                    ?	'opacity-100	bg-black/50	text-yellow-400'
                    :	'opacity-0	group-hover:opacity-100	bg-black/50	text-gray-300	hover:text-yellow-400'}`}
              >
                <Star	size={14}	fill={character.isFavorite	?	'currentColor'	:	'none'}	/>
              </button>
              {/*	nn	Botones	de	acción	—	visibles	al	hover	nn	*/}
		      <div
    			className='absolute	top-2	right-2	flex	flex-col	gap-1	z-20
                opacity-0	group-hover:opacity-100	transition-opacity'
              >
                <button
                  onClick={e	=>	{	e.stopPropagation();	onEdit(character);	}}
                  className='w-7	h-7	rounded-lg	bg-black/50	backdrop-blur-sm
                  flex	items-center	justify-center	text-gray-300
                  hover:text-accent	hover:bg-accent/20	transition-colors'
                  >
                    <Edit2	size={12}	/>
                </button>
                <button
                  onClick={handleDelete}
                  className={`w-7	h-7	rounded-lg	backdrop-blur-sm	flex	items-center
                  justify-center	transition-colors
                  ${confirmDel
                    ?	'bg-red-500/40	text-red-300'
                    :	'bg-black/50	text-gray-300	hover:bg-red-500/20	hover:text-red-400'}`}
                >
                  <Trash2	size={12}	/>
                </button>
              </div>
            </motion.div>
        );
}