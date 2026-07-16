import { useState, useCallback } from 'react';
import es from '../i18n/es.json';
import en from '../i18n/en.json';

const DICTIONARIES = { es, en };

export function useI18n(initialLang = 'en') {
  const [lang, setLang] = useState(() => {
    return localStorage.getItem('app-language') || initialLang;
  });

  const changeLanguage = (newLang) => {
    setLang(newLang);
    localStorage.setItem('app-language', newLang);
  };
  /**
   * Traduce una clave con soporte de interpolación.
   * Uso: t('chat.placeholder', { name: 'Seraphina' })
   * Resultado: 'Habla con Seraphina...'
   */
  const t = useCallback((key, vars = {}) => {
    const dict = DICTIONARIES[lang] || DICTIONARIES['es'];
    
    // Navegar por claves anidadas: 'chat.placeholder' => dict.chat.placeholder
    const value = key.split('.').reduce((obj, k) => obj?.[k], dict);
    
    if (value === undefined) return key;
    if (typeof value !== 'string') {
      return value;
    }
    
    // Reemplazar variables {{name}} por el valor real
    return Object.entries(vars).reduce((str, [k, v]) => {
      return str.replace(new RegExp(`\\{\\{${k}\\}}`, 'g'), v);
    }, value);
  }, [lang]);

  return {
    t,
    lang,
    setLang: changeLanguage,
    availableLangs: Object.keys(DICTIONARIES),
  };
}