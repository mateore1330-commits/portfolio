// El cliente de la API del panel: todas las pantallas piden y guardan datos con pedir().
// La sesión vive en una cookie httpOnly que el JavaScript no puede leer; aquí solo se
// guarda, en memoria, el código CSRF que la API pide en las peticiones que cambian algo.
const API = import.meta.env.VITE_API_URL
let csrf = ''

export const hayApi = Boolean(API)

export function ponerCsrf(codigo) {
  csrf = codigo || ''
}

// La petición tal cual: { estado, datos }. Sin conexión, estado 0 y error 'red'.
export async function llamar(ruta, opciones = {}) {
  try {
    const respuesta = await fetch(new URL(`/api/admin${ruta}`, API), {
      credentials: 'include',
      ...opciones,
      headers: { 'Content-Type': 'application/json', ...(csrf && { 'X-CSRF-TOKEN': csrf }), ...opciones.headers },
    })
    const datos = await respuesta.json().catch(() => ({}))
    return { estado: respuesta.status, datos }
  } catch {
    return { estado: 0, datos: { error: 'red' } }
  }
}

// --- La sesión caducada --------------------------------------------------------------
// Si la API responde 401 a mitad de trabajo, pedir() no falla: deja la petición en espera
// y avisa al diálogo de sesión (DialogoSesion.jsx), que se abre encima de la pantalla.
// Al volver a entrar, la petición se repite; la pantalla de debajo no se ha tocado.
let espera = null
const oyentes = new Set()

function avisar() {
  oyentes.forEach((oyente) => oyente())
}

export function suscribirSesion(oyente) {
  oyentes.add(oyente)
  return () => oyentes.delete(oyente)
}

// Para el diálogo: null si no hace falta, o el motivo ('sesion_caducada' | 'sin_sesion').
export const motivoSesion = () => espera?.motivo ?? null

// El diálogo llama a esto al volver a entrar (true) o al salir del panel (false).
export function terminarEspera(entrado) {
  const actual = espera
  espera = null
  avisar()
  actual?.resolver(entrado)
}

function esperarSesion(motivo) {
  if (!espera) {
    let resolver
    const promesa = new Promise((r) => (resolver = r))
    espera = { motivo, promesa, resolver }
    avisar()
  }
  return espera.promesa
}

// { ok: true, datos } · { ok: false, error, datos }
export async function pedir(ruta, opciones = {}) {
  let r = await llamar(ruta, opciones)
  if (r.estado === 401 && (await esperarSesion(r.datos.error))) r = await llamar(ruta, opciones)
  if (r.estado >= 200 && r.estado < 300) return { ok: true, datos: r.datos }
  return { ok: false, error: r.datos.error || 'servidor', datos: r.datos }
}
