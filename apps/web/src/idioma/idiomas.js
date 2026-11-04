// Utilidades de idioma sin estado: qué idiomas hay, cómo se traduce una ruta y
// cómo se elige el idioma de un campo de contenido.

export const IDIOMAS = ['es', 'en']
export const POR_DEFECTO = 'es'
export const CLAVE_GUARDADA = 'lang'

export const otro = (lang) => (lang === 'es' ? 'en' : 'es')

// El idioma sale de la URL: /en y lo que cuelga de ella es inglés; todo lo demás, español.
export const idiomaDeRuta = (pathname) =>
  pathname === '/en' || pathname.startsWith('/en/') ? 'en' : 'es'

// La misma página en el otro idioma: /proyectos ↔ /en/proyectos, / ↔ /en.
export function rutaEn(lang, pathname) {
  const resto = idiomaDeRuta(pathname) === 'en' ? pathname.slice(3) || '/' : pathname
  if (lang === 'es') return resto
  return resto === '/' ? '/en' : `/en${resto}`
}

// Un campo de contenido es {"es": …, "en": …}. Si falta el idioma pedido, se usa el
// otro: nunca un hueco. Con un campo nulo devuelve '' en vez de romper la página.
export function pick(campo, lang) {
  if (campo === null || campo === undefined) return ''
  if (typeof campo !== 'object' || Array.isArray(campo)) return campo
  return campo[lang] ?? campo[otro(lang)] ?? ''
}

export function leerGuardado() {
  try {
    const valor = localStorage.getItem(CLAVE_GUARDADA)
    return IDIOMAS.includes(valor) ? valor : null
  } catch {
    return null
  }
}

export function guardar(lang) {
  try {
    localStorage.setItem(CLAVE_GUARDADA, lang)
  } catch {
    // Sin almacenamiento (ventana privada): el idioma no se recuerda, y ya está.
  }
}

// Formato de números por idioma. En español, el separador de miles solo a partir de
// cinco cifras ("1160", "12.400"), como pide la RAE; en inglés, siempre ("1,160").
// Uno por idioma y reutilizado: así es el mismo objeto en cada render.
const FORMATOS = new Map()
export function formatoNumero(lang) {
  if (!FORMATOS.has(lang)) {
    FORMATOS.set(lang, new Intl.NumberFormat(lang, lang === 'es' ? { useGrouping: 'min2' } : {}))
  }
  return FORMATOS.get(lang)
}
