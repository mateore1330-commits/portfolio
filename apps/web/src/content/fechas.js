// Fechas de empleos y formación, como "jun 2022 – abr 2026" o "may – oct 2026".
// Vienen como días sueltos ("2022-06-01") y solo importan el mes y el año: se leen en
// UTC para que la zona horaria del visitante no las mueva un mes.

const leer = (iso) => new Date(`${iso}T00:00:00Z`)
const FORMATOS = new Map()

function formatos(lang) {
  if (!FORMATOS.has(lang)) {
    FORMATOS.set(lang, {
      mesAnio: new Intl.DateTimeFormat(lang, { month: 'short', year: 'numeric', timeZone: 'UTC' }),
      mes: new Intl.DateTimeFormat(lang, { month: 'short', timeZone: 'UTC' }),
    })
  }
  return FORMATOS.get(lang)
}

// "jun 2022 – abr 2026"; en el mismo año, "may – oct 2026"; en el mismo mes, "sept 2026";
// sin fin, "jun 2022 – actualidad".
export function periodo(lang, inicio, fin, actualidad) {
  if (!inicio) return ''
  const f = formatos(lang)
  const desde = leer(inicio)
  if (!fin) return `${f.mesAnio.format(desde)} – ${actualidad}`
  const hasta = leer(fin)
  // Un curso de un mes: "sept 2026".
  if (inicio.slice(0, 7) === fin.slice(0, 7)) return f.mesAnio.format(desde)
  const mismoAnio = desde.getUTCFullYear() === hasta.getUTCFullYear()
  return `${mismoAnio ? f.mes.format(desde) : f.mesAnio.format(desde)} – ${f.mesAnio.format(hasta)}`
}

// Para <time dateTime>: "2022-06".
export const mesIso = (iso) => (iso ? iso.slice(0, 7) : undefined)

// De la más reciente a la más antigua por fecha de inicio; las que no tienen, al final.
export const porFechaDesc = (lista) =>
  [...lista].sort((a, b) => (b.start_date ?? '').localeCompare(a.start_date ?? ''))
