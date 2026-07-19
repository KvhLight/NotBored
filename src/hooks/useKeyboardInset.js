import { useState, useEffect } from 'react';

/**
 * Devuelve cuántos píxeles está tapando el teclado en pantalla del móvil
 * (0 si no hay teclado abierto, o si el navegador no soporta la API).
 * Se usa para añadir padding-bottom extra y que un input no quede oculto
 * detrás del teclado al escribir.
 *
 * active: pásale `false` para desactivar la escucha (por ejemplo, cuando el
 * modal que lo usa está cerrado) y evitar listeners innecesarios.
 */
export default function useKeyboardInset(active = true) {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    if (!active || typeof window === 'undefined' || !window.visualViewport) {
      setInset(0);
      return;
    }

    const vv = window.visualViewport;

    function update() {
      const covered = window.innerHeight - vv.height - vv.offsetTop;
      setInset(Math.max(0, Math.round(covered)));
    }

    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);

    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      setInset(0);
    };
  }, [active]);

  return inset;
}
