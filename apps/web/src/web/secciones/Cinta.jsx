import { Fragment } from 'react'
import { useContenido } from '@/contenido/useContenido.js'
import { useElegir } from '@/idioma/useIdioma.js'
import '@/web/secciones/cinta.css'

// Las de la cinta: lo técnico. Diseño y Transversal, en una cinta de nombres técnicos, no encajan.
const CATEGORIAS = new Set(['frontend', 'backend', 'data'])

// La cinta de tecnologías que se desplaza debajo de la portada. Decorativa (aria-hidden):
// la lista de verdad está en Conocimientos. La lista va dos veces para que el bucle no
// tenga cortes; se para al pasar el ratón y, con movimiento reducido, queda quieta.
export default function Cinta() {
  const p = useElegir()
  const { technologies } = useContenido()
  const nombres = technologies
    .filter((t) => t.is_skill && CATEGORIAS.has(t.category))
    .map((t) => p(t.display_name) || t.name)

  return (
    <div className="band" aria-hidden="true">
      <div className="track">
        {[0, 1].map((vuelta) =>
          nombres.map((nombre) => (
            <Fragment key={`${vuelta}-${nombre}`}>
              <span>{nombre}</span>
              <span className="sep">/</span>
            </Fragment>
          )),
        )}
      </div>
    </div>
  )
}
