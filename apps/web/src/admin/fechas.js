// Las fechas del panel, como en la maqueta: "hace 2 h", "ayer", "31/10, 22:41".
const HORA = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' })
const DIA = new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit' })
const DIA_ANO = new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })

const mismoDia = (a, b) => a.toDateString() === b.toDateString()

// Para lo reciente (mensajes): cuánto hace.
export function haceCuanto(iso, ahora = new Date()) {
  const fecha = new Date(iso)
  const minutos = Math.floor((ahora - fecha) / 60000)
  if (minutos < 1) return 'ahora'
  if (minutos < 60) return `hace ${minutos} min`
  if (mismoDia(fecha, ahora)) return `hace ${Math.floor(minutos / 60)} h`
  const ayer = new Date(ahora)
  ayer.setDate(ayer.getDate() - 1)
  if (mismoDia(fecha, ayer)) return 'ayer'
  return fecha.getFullYear() === ahora.getFullYear() ? DIA.format(fecha) : DIA_ANO.format(fecha)
}

// Para un momento concreto (la última publicación): el día y la hora.
export function diaYHora(iso, ahora = new Date()) {
  const fecha = new Date(iso)
  const dia = fecha.getFullYear() === ahora.getFullYear() ? DIA.format(fecha) : DIA_ANO.format(fecha)
  return `${dia}, ${HORA.format(fecha)}`
}
