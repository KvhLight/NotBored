import React from 'react';
import { Minus, Square, X } from 'lucide-react';

export default function TitleBar({ title = 'DeepSeek Roleplay' }) {
  return (
    // 'drag' permite arrastrar la ventana. Fijado arriba con z-index alto.
    <div className='flex items-center justify-between h-8 bg-card-bg border-b border-white/5 px-3 select-none drag w-full z-50'>
      
      {/* Título de la aplicación */}
      <span className='text-xs font-medium text-gray-400'>
        {title}
      </span>

      {/* Botones de control — 'no-drag' para que reciban los clics correctamente */}
      <div className='flex items-center gap-0.5 no-drag'>
        <button 
          onClick={() => window.electronAPI.window.minimize()}
          className='w-7 h-7 rounded-md flex items-center justify-center text-gray-500 hover:bg-white/10 hover:text-white transition-colors'
          title='Minimizar'
        >
          <Minus size={12} />
        </button>

        <button 
          onClick={() => window.electronAPI.window.maximize()}
          className='w-7 h-7 rounded-md flex items-center justify-center text-gray-500 hover:bg-white/10 hover:text-white transition-colors'
          title='Maximizar'
        >
          <Square size={10} />
        </button>

        <button 
          onClick={() => window.electronAPI.window.close()}
          className='w-7 h-7 rounded-md flex items-center justify-center text-gray-500 hover:bg-red-500 hover:text-white transition-colors'
          title='Cerrar'
        >
          <X size={12} />
        </button>
      </div>

    </div>
  );
}