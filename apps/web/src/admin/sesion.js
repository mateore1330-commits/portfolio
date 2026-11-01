// Las llamadas a la API de la sesión del panel. La sesión vive en una cookie httpOnly que
// el JavaScript no puede leer; aquí solo se guarda, en memoria, el código CSRF que la API
// pide en las peticiones que cambian algo (al recargar se vuelve a pedir con sesion()).
const API = import.meta.env.VITE_API_URL
let csrf = ''

export const hayApi = Boolean(API)

async function llamar(ruta, opciones = {}) {
  const respuesta = await fetch(new URL(`/api/admin${ruta}`, API), {
    credentials: 'include',
    ...opciones,
    headers: { 'Content-Type': 'application/json', ...(csrf && { 'X-CSRF-TOKEN': csrf }), ...opciones.headers },
  })
  const datos = await respuesta.json().catch(() => ({}))
  return { estado: respuesta.status, datos }
}

// Entrar: { ok } · { error: 'credenciales' | 'demasiados_intentos' | 'red' }
export async function entrar(correo, contrasena) {
  try {
    const { estado, datos } = await llamar('/login', { method: 'POST', body: JSON.stringify({ correo, contrasena }) })
    if (estado === 200) {
      csrf = datos.csrf
      return { ok: true }
    }
    return { error: datos.error || 'red' }
  } catch {
    return { error: 'red' }
  }
}

// ¿Hay sesión? { correo } · { error: 'sin_sesion' | 'sesion_caducada' | 'red' }
export async function sesion() {
  try {
    const { estado, datos } = await llamar('/sesion')
    if (estado === 200) {
      csrf = datos.csrf
      return { correo: datos.correo }
    }
    return { error: datos.error || 'sin_sesion' }
  } catch {
    return { error: 'red' }
  }
}

// Salir: cierra la sesión en todos los dispositivos.
export async function salir() {
  try {
    await llamar('/logout', { method: 'POST' })
  } finally {
    csrf = ''
  }
}
