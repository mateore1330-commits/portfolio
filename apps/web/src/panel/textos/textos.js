import { RUTA_PANEL } from '@/panel/utilidades/ruta.js'

// Los textos de la web, agrupados por sección como en la maqueta (ADM-00, pantalla 7), con
// un nombre legible y el tipo de campo de cada uno:
// - linea: una línea · parrafo: un cuadro que crece (con `maximo`, contador)
// - lineas / parrafos: listas · pares: lista de dos campos por elemento
// - grupos: los títulos de cada grupo de Conocimientos · legal: título + apartados
// Un texto que no esté aquí (uno nuevo de la web) sale en "Otros", si es texto o párrafos.
const NEGRITA = 'Lo que va entre **asteriscos** sale en negrita.'

export const SECCIONES = [
  {
    id: 'portada',
    nombre: 'Portada',
    texto: 'Lo primero que se ve: tu nombre, la entradilla, las etiquetas y la ficha.',
    campos: [
      { clave: 'hero.nombre', etiqueta: 'Nombre', tipo: 'linea' },
      { clave: 'hero.entradilla', etiqueta: 'Entradilla', tipo: 'parrafo', maximo: 300, ayuda: NEGRITA },
      {
        clave: 'hero.etiquetas',
        etiqueta: 'Etiquetas de arriba',
        tipo: 'lineas',
        ayuda: 'La primera es la de «disponible», con el punto verde.',
      },
      {
        clave: 'hero.ficha',
        etiqueta: 'Ficha técnica',
        tipo: 'pares',
        pares: [
          { clave: 'clave', etiqueta: 'Dato' },
          { clave: 'valor', etiqueta: 'Valor' },
        ],
        anadir: '+ Añadir dato',
      },
    ],
  },
  {
    id: 'sobre',
    nombre: 'Sobre mí',
    texto: 'El titular, tu historia, la cita y las cifras.',
    campos: [
      { clave: 'sobre.titular', etiqueta: 'Titular', tipo: 'parrafo', ayuda: NEGRITA },
      { clave: 'sobre.cuerpo', etiqueta: 'Párrafos', tipo: 'parrafos', ayuda: NEGRITA },
      { clave: 'sobre.cita', etiqueta: 'Cita', tipo: 'parrafo' },
      {
        clave: 'sobre.cifras',
        etiqueta: 'Cifras',
        tipo: 'pares',
        pares: [
          { clave: 'valor', etiqueta: 'Cifra' },
          { clave: 'etiqueta', etiqueta: 'Qué cuenta' },
        ],
        anadir: '+ Añadir cifra',
      },
    ],
  },
  {
    id: 'conocimientos',
    nombre: 'Conocimientos',
    texto: 'El título y el subtítulo de cada grupo. Las tecnologías se editan en Conocimientos y enlaces.',
    campos: [
      {
        clave: 'conocimientos.grupos',
        tipo: 'grupos',
        grupos: { frontend: 'Frontend', backend: 'Backend', data: 'Datos', tools: 'Herramientas', design: 'Diseño', soft: 'Personales' },
      },
    ],
  },
  {
    id: 'contacto',
    nombre: 'Contacto',
    texto: 'La invitación a escribirte y el formulario.',
    campos: [
      { clave: 'contacto.titular', etiqueta: 'Titular', tipo: 'parrafo', ayuda: NEGRITA },
      { clave: 'contacto.texto', etiqueta: 'Párrafos', tipo: 'parrafos', ayuda: NEGRITA },
      { clave: 'contacto.boton', etiqueta: 'Texto del botón', tipo: 'linea' },
      { clave: 'contacto.respaldo', etiqueta: 'Texto de respaldo', tipo: 'parrafo', ayuda: 'Debajo del formulario, para quien prefiera el correo.' },
    ],
  },
  {
    id: 'pie',
    nombre: 'Pie',
    texto: 'La línea del centro del pie de página. Cada elemento va separado por «·».',
    campos: [{ clave: 'pie.texto', etiqueta: 'Texto', tipo: 'lineas' }],
  },
  {
    id: 'aviso',
    nombre: 'Aviso legal',
    texto: 'La página del aviso legal.',
    campos: [
      { clave: 'legal.actualizado', etiqueta: 'Actualizado el', tipo: 'linea', ayuda: 'Vale para las dos páginas legales.' },
      { clave: 'legal.aviso', tipo: 'legal' },
    ],
  },
  {
    id: 'privacidad',
    nombre: 'Privacidad',
    texto: 'La página de la política de privacidad.',
    campos: [{ clave: 'legal.privacidad', tipo: 'legal' }],
  },
]

export const LISTAS = ['lineas', 'parrafos', 'pares']
const IDIOMAS = ['es', 'en']

// Las secciones con lo que hay de verdad: un texto configurado que no existe no sale, y
// uno que existe sin configurar va a "Otros".
export function seccionesDe(textos) {
  const conocidas = new Set(SECCIONES.flatMap((s) => s.campos.map((c) => c.clave)))
  const secciones = SECCIONES.map((s) => ({ ...s, campos: s.campos.filter((c) => c.clave in textos) }))
  const otros = Object.keys(textos)
    .filter((clave) => !conocidas.has(clave))
    .map((clave) => {
      const v = textos[clave].es
      if (typeof v === 'string') return { clave, etiqueta: clave, tipo: 'parrafo' }
      if (Array.isArray(v) && v.every((x) => typeof x === 'string')) return { clave, etiqueta: clave, tipo: 'parrafos' }
      return null
    })
    .filter(Boolean)
  if (otros.length) secciones.push({ id: 'otros', nombre: 'Otros', texto: 'Textos nuevos de la web.', campos: otros })
  return secciones.filter((s) => s.campos.length > 0)
}

// --- De la API al formulario (claves planas) y de vuelta -------------------------------
export function aFormulario(textos, secciones) {
  const f = {}
  for (const { campos } of secciones) {
    for (const c of campos) {
      for (const lang of IDIOMAS) {
        const v = textos[c.clave][lang]
        const base = `${c.clave}.${lang}`
        if (c.tipo === 'grupos') {
          for (const g of Object.keys(v)) for (const sub of Object.keys(v[g])) f[`${base}.${g}.${sub}`] = v[g][sub]
        } else if (c.tipo === 'legal') {
          f[`${base}.titulo`] = v.titulo
          f[`${base}.bloques`] = v.bloques
        } else f[base] = v
      }
    }
  }
  return f
}

function unIdioma(c, f, lang, guardado) {
  const base = `${c.clave}.${lang}`
  if (c.tipo === 'grupos') {
    return Object.fromEntries(
      Object.entries(guardado).map(([g, subs]) => [g, Object.fromEntries(Object.keys(subs).map((s) => [s, f[`${base}.${g}.${s}`]]))]),
    )
  }
  if (c.tipo === 'legal') return { titulo: f[`${base}.titulo`], bloques: f[`${base}.bloques`] }
  return f[base]
}

// Los textos del formulario con la forma de la API. claves: solo esas (las cambiadas).
export function aApi(f, secciones, textosGuardados, claves) {
  const salida = {}
  for (const { campos } of secciones) {
    for (const c of campos) {
      if (claves && !claves.includes(c.clave)) continue
      salida[c.clave] = Object.fromEntries(IDIOMAS.map((l) => [l, unIdioma(c, f, l, textosGuardados[c.clave][l])]))
    }
  }
  return salida
}

// Las claves del formulario que son listas: cuentan un cambio por elemento.
export const clavesDeListas = (secciones) =>
  secciones.flatMap(({ campos }) =>
    campos
      .filter((c) => LISTAS.includes(c.tipo) || c.tipo === 'legal')
      .flatMap((c) => IDIOMAS.map((l) => (c.tipo === 'legal' ? `${c.clave}.${l}.bloques` : `${c.clave}.${l}`))),
  )

const IDIOMA = { es: 'español', en: 'inglés' }

// El texto de un error de la API, por su ruta ("hero.ficha.en.1.valor": "falta").
export function mensaje(ruta, codigo) {
  const partes = ruta.split('.')
  const lang = partes.find((p) => p === 'es' || p === 'en')
  const otro = lang === 'es' ? 'en' : 'es'
  if (codigo === 'falta' && lang) return `Vacío en ${IDIOMA[lang]}: en ${IDIOMA[otro]} tiene texto.`
  if (codigo === 'obligatorio') return 'No puede quedar vacío.'
  if (codigo === 'fecha') return 'Pon una fecha válida (y que «hasta» no sea antes que «desde»).'
  if (codigo === 'no_existe') return 'Ya no existe en la web. Elige otro o recarga la página.'
  return 'No se ha podido guardar: recarga la página y vuelve a probar.'
}

// Los errores de una lista, por elemento: { índice: mensaje } (el primero de cada uno).
export function erroresDeLista(errores, clave) {
  const salida = {}
  for (const [ruta, codigo] of Object.entries(errores)) {
    if (!ruta.startsWith(`${clave}.`)) continue
    const i = ruta.slice(clave.length + 1).split('.')[0]
    salida[i] ??= mensaje(ruta, codigo)
  }
  return salida
}

export const RUTA_TEXTOS = `${RUTA_PANEL}/textos`

// Los mensajes entre la pestaña de Textos y la de su vista previa (VistaPreviaTextos.jsx).
export const MENSAJE_LISTA = 'vista-previa-textos:lista'
export const MENSAJE_TEXTOS = 'vista-previa-textos:textos'
