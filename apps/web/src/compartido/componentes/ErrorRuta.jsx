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
// recarga sola una vez y, si vuelve a fallar, "Algo no ha cargado · Recargar". Cualquier
// otro fallo: "Algo ha fallado · Recargar". Va fuera de los proveedores (pueden ser lo que
// falló), así que el idioma sale de la dirección.
export default function ErrorRuta() {
  const error = useRouteError()
  const deCarga = esFalloDeCarga(error)
  const vaARecargar = estaRecargando() || (deCarga && puedeRecargar())
  const t = TEXTOS[idiomaDeRuta(window.location.pathname)]
  const titulo = t[deCarga ? 'fallo.titulo' : 'fallo.otro_titulo']

  useEffect(() => {
    if (!vaARecargar) ponerTitulo(`${titulo} · Mateo Rodríguez`)
    else if (!estaRecargando()) recargar()
  }, [vaARecargar, titulo])

  if (vaARecargar) return null
  return (
    <main id="contenido" tabIndex={-1} className="pagina no-encontrada">
      <h1>{titulo}</h1>
      <p>{t[deCarga ? 'fallo.texto' : 'fallo.otro_texto']}</p>
      <button type="button" className="btn" onClick={recargar}>
        {t['fallo.recargar']}
      </button>
    </main>
  )
}
