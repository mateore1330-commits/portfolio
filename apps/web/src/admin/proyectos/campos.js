import { RUTA_PANEL } from '@/admin/ruta.js'

export const rutaProyecto = (id) => `${RUTA_PANEL}/proyectos/${id}`

// Los campos del formulario de un proyecto, y el paso de lo que da la API a claves planas
// ('name.es', 'learning.en'…) y de vuelta. Los textos de error, con las mismas claves que
// los errores de la API (proyectos.py).
export const TEXTOS = [
  { campo: 'name', etiqueta: 'Nombre' },
  { campo: 'label', etiqueta: 'Tipo de proyecto', ayuda: 'Sale encima del nombre en la tarjeta.' },
  { campo: 'period', etiqueta: 'Periodo' },
  { campo: 'summary', etiqueta: 'Resumen', ayuda: 'La tarjeta de la portada. Unos 300 caracteres.', largo: true },
]

export const PARRAFOS = [
  { campo: 'description', etiqueta: 'Descripción · párrafos' },
  { campo: 'my_role', etiqueta: 'Mi papel · párrafos', ayuda: 'Solo en los proyectos en equipo.' },
  { campo: 'learning', etiqueta: 'Lo que aprendí' },
]

export const CLAVES_PARRAFOS = PARRAFOS.flatMap(({ campo }) => [`${campo}.es`, `${campo}.en`])

// Qué claves van en cada bloque, para el "N cambios" de su título.
export const BLOQUES = {
  textos: (clave) => /\.(es|en)$/.test(clave),
  ficha: (clave) => ['slug', 'posicion', 'is_team_project', 'team_size', 'commits_share', 'is_featured'].includes(clave),
  enlaces: (clave) => clave === 'demo_url' || clave === 'repo_url',
  tecnologias: (clave) => clave === 'technologies',
}

const texto = (valor) => (valor == null ? '' : String(valor))

export function aFormulario(p = {}) {
  const f = {
    status: p.status ?? 'draft',
    slug: p.slug ?? '',
    posicion: texto(p.posicion),
    is_featured: Boolean(p.is_featured),
    is_team_project: Boolean(p.is_team_project),
    team_size: texto(p.team_size),
    commits_share: texto(p.commits_share),
    demo_url: texto(p.demo_url),
    repo_url: texto(p.repo_url),
    technologies: (p.technologies ?? []).map((t) => t.id),
  }
  for (const lang of ['es', 'en']) {
    for (const { campo } of TEXTOS) f[`${campo}.${lang}`] = p[campo]?.[lang] ?? ''
    for (const { campo } of PARRAFOS) f[`${campo}.${lang}`] = p[campo]?.[lang] ?? []
  }
  return f
}

// "4" → 4 y "" → null. Lo que no es un número se manda tal cual: la API dice qué falla.
const numero = (valor) => (valor.trim() === '' ? null : /^\d+$/.test(valor.trim()) ? Number(valor) : valor)

export function aApi(f) {
  const ambos = (campo) => ({ es: f[`${campo}.es`], en: f[`${campo}.en`] })
  return {
    status: f.status,
    slug: f.slug,
    posicion: numero(f.posicion),
    is_featured: f.is_featured,
    is_team_project: f.is_team_project,
    team_size: numero(f.team_size),
    commits_share: numero(f.commits_share),
    demo_url: f.demo_url,
    repo_url: f.repo_url,
    technologies: f.technologies,
    ...Object.fromEntries([...TEXTOS, ...PARRAFOS].map(({ campo }) => [campo, ambos(campo)])),
  }
}

const IDIOMA = { es: 'español', en: 'inglés' }
const otro = (lang) => (lang === 'es' ? 'en' : 'es')

// El texto de un error de la API ('learning.en.3': 'falta') para enseñarlo en su campo.
export function mensaje(clave, codigo, extra = {}) {
  const [campo, lang, parrafo] = clave.split('.')
  if (codigo === 'falta' && parrafo !== undefined) return `Vacío en ${IDIOMA[lang]}: en ${IDIOMA[otro(lang)]} tiene texto.`
  if (codigo === 'falta') return `Para publicar, tiene que estar también en ${IDIOMA[lang]}.`
  if (codigo === 'obligatorio') return campo === 'slug' ? 'Hace falta una dirección.' : 'Hace falta para guardar, aunque sea un borrador.'
  if (codigo === 'existe') return `Ya hay un proyecto con esta dirección${extra.de ? ` (${extra.de})` : ''}.`
  if (codigo === 'formato' && campo === 'slug') return 'Solo minúsculas, números y guiones: sin tildes ni espacios.'
  if (codigo === 'url') return 'Tiene que ser una dirección completa, que empiece por https://.'
  if (codigo === 'no_existe') return 'Alguna ya no está en la lista de Conocimientos. Recarga la página.'
  if (codigo === 'numero') {
    if (campo === 'team_size') return 'Un número, de 2 en adelante.'
    if (campo === 'commits_share') return 'Un número del 0 al 100.'
    return 'Un número, de 1 en adelante.'
  }
  return 'Revisa este campo.'
}
