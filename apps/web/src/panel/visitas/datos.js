// Lo que comparten Visitas y la tarjeta del Inicio (ADM-10): cómo se llaman los eventos, los
// dispositivos y los países, y cómo se escriben las cifras.

export const PERIODOS = [
  { id: '7d', nombre: '7 días', anteriores: 'los 7 días anteriores' },
  { id: '30d', nombre: '30 días', anteriores: 'los 30 días anteriores' },
  { id: '12m', nombre: '12 meses', anteriores: 'los 12 meses anteriores' },
]

// Como en la maqueta: "Correo copiado o pulsado" junta dos eventos.
export const EVENTOS = [
  { nombre: 'Formulario enviado', eventos: ['formulario-enviado'] },
  { nombre: 'CV descargado', eventos: ['cv-descargado'] },
  { nombre: 'Correo copiado o pulsado', eventos: ['correo-copiado', 'correo-pulsado'] },
  { nombre: 'Perfil abierto', eventos: ['perfil-abierto'] },
  { nombre: 'Demo abierta', eventos: ['demo-abierta'] },
  { nombre: 'Repositorio abierto', eventos: ['repo-abierto'] },
]

const VALORES = { es: 'ES', en: 'EN', linkedin: 'LinkedIn', github: 'GitHub' }
const DISPOSITIVOS = { desktop: 'Ordenador', laptop: 'Ordenador', mobile: 'Móvil', tablet: 'Tablet' }
const PAISES = new Intl.DisplayNames(['es'], { type: 'region' })
const NUMERO = new Intl.NumberFormat('es-ES')
const DIA = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' })
const MES = new Intl.DateTimeFormat('es-ES', { month: 'short', year: '2-digit' })

export const numero = (n) => NUMERO.format(n)

export function total(eventos, nombres) {
  return eventos.filter((e) => nombres.includes(e.evento)).reduce((suma, e) => suma + e.total, 0)
}

// "ES 7 · EN 2", "CleanFlow 6 · MIR Llamado 4". proyectos: { slug: nombre }.
export function desglose(eventos, nombres, proyectos = {}) {
  const juntos = {}
  for (const e of eventos.filter((x) => nombres.includes(x.evento))) {
    for (const d of e.detalle) juntos[d.nombre] = (juntos[d.nombre] ?? 0) + d.total
  }
  return Object.entries(juntos)
    .sort(([, a], [, b]) => b - a)
    .map(([valor, n]) => `${VALORES[valor] ?? proyectos[valor] ?? valor} ${n}`)
    .join(' · ')
}

// "+18 %" (o null si antes no había nada con que comparar).
export function variacion(ahora, antes) {
  if (!antes) return null
  const cambio = Math.round(((ahora - antes) / antes) * 100)
  return `${cambio > 0 ? '+' : ''}${cambio} %`
}

// Segundos → "1:46".
export function minutos(segundos) {
  const s = Math.round(segundos)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export const pais = (codigo) => {
  try {
    return PAISES.of(codigo) ?? codigo
  } catch {
    return codigo || 'Desconocido'
  }
}

export const dispositivo = (tipo) => DISPOSITIVOS[tipo] ?? tipo

// "2026-10-02" → "2 oct"; "2026-10" → "oct 26".
export function fecha(casilla) {
  const [a, m, d] = casilla.split('-').map(Number)
  return d ? DIA.format(new Date(a, m - 1, d)) : MES.format(new Date(a, m - 1, 1))
}

// Los dispositivos juntos (ordenador = desktop + laptop).
export function juntarDispositivos(filas) {
  const juntos = {}
  for (const f of filas) juntos[dispositivo(f.nombre)] = (juntos[dispositivo(f.nombre)] ?? 0) + f.total
  return Object.entries(juntos)
    .map(([nombre, n]) => ({ nombre, total: n }))
    .sort((a, b) => b.total - a.total)
}
