// El cliente de la API del panel: todas las pantallas piden y guardan datos con pedir().
// La sesión vive en una cookie httpOnly que el JavaScript no puede leer; aquí solo se
// guarda, en memoria, el código CSRF que la API pide en las peticiones que cambian algo.
const API = import.meta.env.VITE_API_URL
let csrf = ''

export const hayApi = Boolean(API)

// La dirección completa de una ruta del panel: para enlaces que abre el navegador (un PDF).
export const urlPanel = (ruta) => new URL(`/api/admin${ruta}`, API).href

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

// --- Subir un archivo (ADM-08) --------------------------------------------------------
// Con XMLHttpRequest y no con fetch: fetch no dice cuánto se ha subido. alProgreso(0…100).
// Igual que pedir(): si la sesión ha caducado, espera al diálogo y lo repite.
function enviar(ruta, archivo, alProgreso) {
  return new Promise((resolver) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', new URL(`/api/admin${ruta}`, API))
    xhr.withCredentials = true
    if (csrf) xhr.setRequestHeader('X-CSRF-TOKEN', csrf)
    xhr.upload.onprogress = (e) => e.lengthComputable && alProgreso?.(Math.round((e.loaded / e.total) * 100))
    xhr.onload = () => {
      let datos = {}
      try {
        datos = JSON.parse(xhr.responseText)
      } catch {
        // Sin JSON (un error del servidor): datos vacíos.
      }
      resolver({ estado: xhr.status, datos })
    }
    xhr.onerror = () => resolver({ estado: 0, datos: { error: 'red' } })
    const cuerpo = new FormData()
    cuerpo.append('archivo', archivo)
    xhr.send(cuerpo)
  })
}

export async function subir(ruta, archivo, alProgreso) {
  let r = await enviar(ruta, archivo, alProgreso)
  if (r.estado === 401 && (await esperarSesion(r.datos.error))) r = await enviar(ruta, archivo, alProgreso)
  if (r.estado >= 200 && r.estado < 300) return { ok: true, datos: r.datos }
  return { ok: false, error: r.datos.error || 'servidor', datos: r.datos }
}
