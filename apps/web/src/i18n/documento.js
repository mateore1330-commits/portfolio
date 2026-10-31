// Lo que el idioma cambia fuera de React: los <link hreflang> del <head> y la
// posición de la página al cambiar de idioma.
import { rutaEn } from '@/i18n/idiomas.js'

const SITIO = (import.meta.env.VITE_SITE_URL ?? 'https://mateorodriguez.solutions').replace(/\/$/, '')

// Cada versión apunta a la otra, y x-default a la española. Así Google sabe que
// / y /en son la misma página en dos idiomas. El enlace canónico, a la página actual.
// (En el build, scripts/paginas-estaticas.mjs ya los escribe en el HTML de cada página;
// esto los mantiene al día al navegar sin recargar.)
export function actualizarAlternativas(pathname) {
  let canonico = document.head.querySelector('link[rel="canonical"]')
  if (!canonico) {
    canonico = document.createElement('link')
    canonico.rel = 'canonical'
    document.head.append(canonico)
  }
  canonico.href = SITIO + pathname

  for (const [hreflang, lang] of [['es', 'es'], ['en', 'en'], ['x-default', 'es']]) {
    let link = document.head.querySelector(`link[rel="alternate"][hreflang="${hreflang}"]`)
    if (!link) {
      link = document.createElement('link')
      link.rel = 'alternate'
      link.hreflang = hreflang
      document.head.append(link)
    }
    link.href = SITIO + rutaEn(lang, pathname)
  }
}

// Al cambiar de idioma no se recuerdan los píxeles (el inglés y el español ocupan
// distinto), sino qué sección se estaba viendo y a qué distancia del borde superior.
let ancla = null

export function guardarAncla() {
  for (const seccion of document.querySelectorAll('main section[id]')) {
    const { top, bottom } = seccion.getBoundingClientRect()
    if (bottom > 0) {
      ancla = { id: seccion.id, distancia: top }
      return
    }
  }
  ancla = null
}

export function restaurarAncla() {
  if (!ancla) return
  const seccion = document.getElementById(ancla.id)
  if (seccion) {
    const top = seccion.getBoundingClientRect().top + window.scrollY - ancla.distancia
    // instant: base.css pone scroll-behavior: smooth, y aquí no se quiere animación.
    window.scrollTo({ top, behavior: 'instant' })
  }
  ancla = null
}

// El título de la pestaña.
export function ponerTitulo(texto) {
  document.title = texto
}

// La descripción de la página (<meta name="description">), o ninguna con null.
export function ponerDescripcion(texto) {
  let meta = document.head.querySelector('meta[name="description"]')
  if (!texto) {
    meta?.remove()
    return
  }
  if (!meta) {
    meta = document.createElement('meta')
    meta.name = 'description'
    document.head.append(meta)
  }
  meta.content = texto
}
