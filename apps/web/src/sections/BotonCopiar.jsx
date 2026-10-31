import { useEffect, useRef, useState } from 'react'
import { useT } from '@/i18n/useLang.js'

const DURACION_MS = 2000

// Copia un texto (el correo) y dice "¡Copiado!" dos segundos. Existe porque el enlace
// mailto: depende de que cada ordenador tenga una app de correo; si no la tiene, no pasa
// nada al pulsarlo. Copiar funciona siempre. Sin portapapeles disponible, no se pinta.
export default function BotonCopiar({ texto, etiqueta, nombre }) {
  const t = useT()
  const [copiado, setCopiado] = useState(false)
  const temporizador = useRef(0)

  useEffect(() => () => clearTimeout(temporizador.current), [])

  if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return null

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto)
    } catch {
      return
    }
    setCopiado(true)
    clearTimeout(temporizador.current)
    temporizador.current = setTimeout(() => setCopiado(false), DURACION_MS)
  }

  return (
    <button type="button" className={copiado ? 'copiar hecho' : 'copiar'} onClick={copiar} aria-label={copiado ? undefined : nombre}>
      <svg viewBox="0 0 12 12" aria-hidden="true">
        <rect x="3.5" y="3.5" width="7" height="7" />
        <path d="M8.5 3.5V1.5h-7v7h2" />
      </svg>
      <span aria-live="polite">{copiado ? t('contacto.copiado') : etiqueta}</span>
    </button>
  )
}
