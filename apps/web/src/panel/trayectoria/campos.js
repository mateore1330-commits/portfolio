import { RUTA_PANEL } from '@/panel/utilidades/ruta.js'

// Empleos y formación (ADM-06): lo que distingue a uno de otro, el paso de la API a claves
// planas ('position.es', 'description.en'…) y de vuelta, y los textos de error.
export const RUTA_TRAYECTORIA = `${RUTA_PANEL}/trayectoria`

export const TIPOS = {
  empleo: {
    api: '/jobs',
    ruta: `${RUTA_TRAYECTORIA}/empleo`,
    nombre: 'empleo',
    nuevo: 'Nuevo empleo',
    titulo: 'position',
    textos: [{ campo: 'position', etiqueta: 'Puesto' }],
    parrafos: [
      { campo: 'description', etiqueta: 'Descripción · párrafos' },
      { campo: 'achievements', etiqueta: 'Logros', lineas: true },
    ],
    ahora: 'Actualmente',
    o: 'o', // empleo: borrado, oculto
  },
  formacion: {
    api: '/education',
    ruta: `${RUTA_TRAYECTORIA}/formacion`,
    nombre: 'formación',
    nuevo: 'Nueva formación',
    titulo: 'title',
    textos: [{ campo: 'title', etiqueta: 'Título' }],
    parrafos: [{ campo: 'description', etiqueta: 'Descripción · párrafos' }],
    ahora: 'En curso',
    o: 'a', // formación: borrada, oculta
  },
}

export const clavesParrafos = (tipo) => tipo.parrafos.flatMap(({ campo }) => [`${campo}.es`, `${campo}.en`])

const texto = (valor) => (valor == null ? '' : String(valor))
const mes = (iso) => (iso ? iso.slice(0, 7) : '')

export function aFormulario(tipo, d = {}) {
  const f = {
    is_visible: d.is_visible ?? true,
    location: texto(d.location),
    start_date: mes(d.start_date),
    end_date: mes(d.end_date),
  }
  if (tipo === TIPOS.empleo) {
    f.company = texto(d.company)
    f.tools = texto(d.tools)
  } else {
    f.kind = d.kind ?? 'program'
    f.institution = texto(d.institution)
    f.hours = texto(d.hours)
    f.certificate_url = texto(d.certificate_url)
    f.certificate_file = d.certificate_file ?? null
  }
  for (const lang of ['es', 'en']) {
    for (const { campo } of tipo.textos) f[`${campo}.${lang}`] = d[campo]?.[lang] ?? ''
    for (const { campo } of tipo.parrafos) f[`${campo}.${lang}`] = d[campo]?.[lang] ?? []
  }
  return f
}

const numero = (valor) => (valor.trim() === '' ? null : /^\d+$/.test(valor.trim()) ? Number(valor) : valor)

export function aApi(tipo, f) {
  const ambos = (campo) => ({ es: f[`${campo}.es`], en: f[`${campo}.en`] })
  const salida = {
    is_visible: f.is_visible,
    location: f.location,
    start_date: f.start_date,
    end_date: f.end_date,
    ...Object.fromEntries([...tipo.textos, ...tipo.parrafos].map(({ campo }) => [campo, ambos(campo)])),
  }
  if (tipo === TIPOS.empleo) return { ...salida, company: f.company, tools: f.tools }
  return {
    ...salida,
    kind: f.kind,
    institution: f.institution,
    hours: numero(f.hours),
    certificate_url: f.certificate_url,
    certificate_file: f.certificate_file,
  }
}

// "jun 2022 – abr 2026", "nov 2026 – actualidad" o "—" si no tiene fechas.
const MES = new Intl.DateTimeFormat('es-ES', { month: 'short', year: 'numeric' })
const corto = (iso) => MES.format(new Date(`${iso.slice(0, 10)}T12:00:00`)).replace('.', '')
export function fechas(desde, hasta) {
  if (!desde) return '—'
  return `${corto(desde)} – ${hasta ? corto(hasta) : 'actualidad'}`
}

const IDIOMA = { es: 'español', en: 'inglés' }

export function mensaje(clave, codigo) {
  const [campo, lang, parrafo] = clave.split('.')
  const otro = lang === 'es' ? 'en' : 'es'
  if (codigo === 'falta' && parrafo !== undefined) return `Vacío en ${IDIOMA[lang]}: en ${IDIOMA[otro]} tiene texto.`
  if (codigo === 'falta') return `Para que se vea en la web, tiene que estar también en ${IDIOMA[lang]}.`
  if (codigo === 'obligatorio') return campo === 'start_date' ? 'Pon la fecha de inicio.' : 'Hace falta para guardar.'
  if (codigo === 'antes') return 'Es anterior al inicio.'
  if (codigo === 'fecha') return 'No es una fecha válida.'
  if (codigo === 'url') return 'Tiene que ser una dirección completa, que empiece por https://.'
  if (codigo === 'numero') return campo === 'hours' ? 'Un número de horas, de 1 en adelante.' : 'Un número, de 1 en adelante.'
  return 'Revisa este campo.'
}
