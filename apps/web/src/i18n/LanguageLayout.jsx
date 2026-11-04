import { useEffect, useLayoutEffect, useRef } from 'react'
import { Outlet, useLocation, useNavigate, useNavigationType } from 'react-router'
import { actualizarAlternativas, ponerDescripcion, restaurarAncla } from '@/i18n/documento.js'
import { leerGuardado, rutaEn } from '@/i18n/idiomas.js'
import { LanguageContext } from '@/i18n/LanguageContext.js'
import { useContent } from '@/content/useContent.js'
import { useLang, usePick, useT } from '@/i18n/useLang.js'
import Cursor from '@/layout/Cursor.jsx'
import Footer from '@/layout/Footer.jsx'
import Header from '@/layout/Header.jsx'
import ProgressRail from '@/layout/ProgressRail.jsx'
import Revelado from '@/layout/Revelado.jsx'
import { cargarMedicion } from '@/medir.js'
import '@/i18n/language-switch.css'
import '@/layout/layout.css'

// El idioma lo decide la ruta: este layout lo recibe y lo reparte al resto, junto
// con la cabecera y el raíl, que están en todas las páginas (también en la 404).
export default function LanguageLayout({ lang }) {
  // Medir las visitas (ADM-10): solo la web pública carga Umami; el panel, nunca.
  useEffect(() => cargarMedicion(), [])

  return (
    <LanguageContext.Provider value={lang}>
      <Documento />
      <Header />
      <ProgressRail />
      <div className="con-rail">
        <Outlet />
        <Footer />
      </div>
      <Revelado />
      <Cursor />
      <div className="grano" aria-hidden="true" />
    </LanguageContext.Provider>
  )
}

// Lleva el foco a un elemento sin mover la página (de eso se encarga ScrollRestoration). Una
// sección no recibe el foco por sí sola: se le deja recibirlo solo por código (tabindex -1).
function enfocar(elemento) {
  if (!elemento) return
  if (!elemento.hasAttribute('tabindex')) elemento.setAttribute('tabindex', '-1')
  elemento.focus({ preventScroll: true })
}

// Solo la primera página de la visita puede redirigir al idioma recordado.
let primeraPagina = true

function Documento() {
  const lang = useLang()
  const t = useT()
  const p = usePick()
  const { site_texts: textos } = useContent()
  // La descripción de siempre: la entradilla de la portada, sin las marcas **.
  const descripcion = p(textos['hero.entradilla']).replace(/\*\*|`/g, '')
  const { pathname, hash } = useLocation()
  const navigate = useNavigate()
  const tipo = useNavigationType()
  const anterior = useRef(pathname)

  // Si la última vez se eligió inglés y se entra en la portada, se va a /en.
  // Nunca desde otra ruta: un enlace compartido a la versión española se respeta.
  useEffect(() => {
    const esPrimera = primeraPagina
    primeraPagina = false
    if (esPrimera && pathname === '/' && leerGuardado() === 'en') {
      navigate('/en', { replace: true })
    }
  }, [pathname, navigate])

  useEffect(() => {
    document.documentElement.lang = lang
    // Los de siempre; una página que tenga los suyos (la de un proyecto) los pone después.
    document.title = t('meta.titulo')
    ponerDescripcion(descripcion)
    actualizarAlternativas(pathname)
  }, [lang, t, pathname, descripcion])

  // Al ir a otra página con un enlace, el foco pasa al contenido nuevo, para el lector de
  // pantalla; y al ir a una sección (el menú), a esa sección (#158). (El scroll lo lleva
  // ScrollRestoration, en App: arriba al entrar, la sección del #, donde estabas al volver.)
  // Al cambiar solo de idioma no se toca nada.
  useLayoutEffect(() => {
    const cambioDePagina = anterior.current !== pathname
    const cambioDeIdioma = cambioDePagina && rutaEn('es', anterior.current) === rutaEn('es', pathname)
    anterior.current = pathname
    if (tipo !== 'PUSH' || cambioDeIdioma) return
    if (hash) {
      enfocar(document.getElementById(decodeURIComponent(hash.slice(1))))
    } else if (cambioDePagina) {
      enfocar(document.getElementById('contenido'))
    }
  }, [pathname, hash, tipo])

  // Antes de pintar: si venimos del selector, volver a la sección que se estaba viendo.
  useLayoutEffect(() => {
    restaurarAncla()
  }, [lang])

  return null
}
