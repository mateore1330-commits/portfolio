import { useT } from '@/idioma/useIdioma.js'
import { SECCIONES } from '@/web/estructura/secciones.js'
import '@/web/secciones/secciones.css'

// Cabecera de sección de la maqueta: "01 · Sobre mí · Quién hay detrás".
// El número sale del orden de SECCIONES: si un día se reordena el menú, se ajusta solo.
export default function CabeceraSeccion({ id }) {
  const t = useT()
  const posicion = SECCIONES.findIndex((s) => s.id === id)
  const { clave, subtitulo } = SECCIONES[posicion]

  return (
    <div className="sechead" data-revelar="">
      <span className="n" aria-hidden="true">
        {String(posicion + 1).padStart(2, '0')}
      </span>
      <h2 className="t">{t(clave)}</h2>
      {subtitulo && <span className="x">{t(subtitulo)}</span>}
    </div>
  )
}
