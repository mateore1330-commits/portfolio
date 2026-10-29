import { useT } from '@/i18n/useLang.js'
import { SECCIONES } from '@/layout/secciones.js'
import '@/sections/sections.css'

// Cabecera de sección de la maqueta: "01 · Sobre mí · Quién hay detrás".
// El número sale del orden de SECCIONES: si un día se reordena el menú, se ajusta solo.
export default function SectionHead({ id }) {
  const t = useT()
  const posicion = SECCIONES.findIndex((s) => s.id === id)
  const { clave, subtitulo } = SECCIONES[posicion]

  return (
    <div className="sechead">
      <span className="n" aria-hidden="true">
        {String(posicion + 1).padStart(2, '0')}
      </span>
      <h2 className="t">{t(clave)}</h2>
      {subtitulo && <span className="x">{t(subtitulo)}</span>}
    </div>
  )
}
