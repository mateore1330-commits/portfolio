// Entrar, saber si hay sesión y salir. Usan llamar() y no pedir(): un 401 aquí no es una
// sesión caducada a mitad de trabajo, es la respuesta que se busca.
import { llamar, ponerCsrf } from '@/admin/api.js'

export { hayApi } from '@/admin/api.js'

// Lo que se dice al fallar entrar: en la pantalla de entrar y en el diálogo de sesión.
export const ERRORES_ENTRAR = {
  credenciales: 'Correo o contraseña incorrectos.',
  demasiados_intentos: 'Demasiados intentos. Espera unos 15 minutos y vuelve a probar.',
  red: 'No se puede conectar con el servidor. Vuelve a intentarlo en un rato.',
}

// Entrar: { ok } · { error: 'credenciales' | 'demasiados_intentos' | 'red' }
export async function entrar(correo, contrasena) {
  const { estado, datos } = await llamar('/login', { method: 'POST', body: JSON.stringify({ correo, contrasena }) })
  if (estado === 200) {
    ponerCsrf(datos.csrf)
    return { ok: true }
  }
  return { error: datos.error || 'red' }
}

// ¿Hay sesión? { correo } · { error: 'sin_sesion' | 'sesion_caducada' | 'red' }
export async function sesion() {
  const { estado, datos } = await llamar('/sesion')
  if (estado === 200) {
    ponerCsrf(datos.csrf)
    return { correo: datos.correo }
  }
  return { error: datos.error || 'sin_sesion' }
}

// Salir: cierra la sesión en todos los dispositivos.
export async function salir() {
  await llamar('/logout', { method: 'POST' })
  ponerCsrf('')
}
