import { useEffect } from 'react'
import { useRouteError } from 'react-router'
import { ponerTitulo } from '@/idioma/documento.js'
import en from '@/idioma/en.json'
import es from '@/idioma/es.json'
import { idiomaDeRuta } from '@/idioma/idiomas.js'
import { esFalloDeCarga, estaRecargando, puedeRecargar, recargar } from '@/compartido/recargar.js'
import '@/web/paginas/paginas.css'

const TEXTOS = { es, en }

// Lo que se ve si una página falla, en la web y en el panel, en vez de la pantalla de React
// Router para programadores (#185). Si lo que falló es una pieza de una versión anterior, se
// recarga sola una vez; si no, "Recargar". Va fuera de los proveedores (pueden ser lo que
// falló), así que el idioma sale de la dirección.
export default function ErrorRuta() {
  const error = useRouteError()
  const vaARecargar = estaRecargando() || (esFalloDeCarga(error) && puedeRecargar())
  const t = TEXTOS[idiomaDeRuta(window.location.pathname)]

  useEffect(() => {
    if (!vaARecargar) ponerTitulo(`${t['fallo.titulo']} · Mateo Rodríguez`)
    else if (!estaRecargando()) recargar()
  }, [vaARecargar, t])

  if (vaARecargar) return null
  return (
    <main id="contenido" tabIndex={-1} className="pagina no-encontrada">
      <h1>{t['fallo.titulo']}</h1>
      <p>{t['fallo.texto']}</p>
      <button type="button" className="btn" onClick={recargar}>
        {t['fallo.recargar']}
      </button>
    </main>
  )
}
