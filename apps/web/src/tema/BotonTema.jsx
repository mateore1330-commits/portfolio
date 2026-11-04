import { useSyncExternalStore } from 'react'
import { useT } from '@/idioma/useIdioma.js'
import { useTema } from '@/tema/useTema.js'

const consulta = '(prefers-color-scheme: dark)'
const suscribir = (aviso) => {
  const media = matchMedia(consulta)
  media.addEventListener('change', aviso)
  return () => media.removeEventListener('change', aviso)
}
const sistemaOscuro = () => matchMedia(consulta).matches

// Alterna claro ↔ oscuro partiendo del tema que se ve ahora, aunque sea el del
// sistema. La elección se recuerda (ProveedorTema, SETUP-04).
export default function BotonTema() {
  const { theme, setTheme } = useTema()
  const t = useT()
  const oscuro = useSyncExternalStore(suscribir, sistemaOscuro)
  const visible = theme === 'system' ? (oscuro ? 'dark' : 'light') : theme
  const siguiente = visible === 'dark' ? 'light' : 'dark'

  return (
    <button
      type="button"
      className="tmode"
      onClick={() => setTheme(siguiente)}
      aria-label={t(siguiente === 'dark' ? 'tema.a_oscuro' : 'tema.a_claro')}
    >
      {t('tema.boton')}
    </button>
  )
}
