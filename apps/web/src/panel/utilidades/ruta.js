// La dirección del panel (ADM-01): aleatoria y fuera del repo, en VITE_ADMIN_PATH
// (apps/web/.env.local en tu Mac; en Vercel, sus variables de entorno). Sin ella, el
// panel no existe en la web. Esconderla quita ruido de robots; la seguridad es el login.
const valor = (import.meta.env.VITE_ADMIN_PATH ?? '').trim().replace(/\/+$/, '')

export const RUTA_PANEL = /^\/[\w-]{6,}$/.test(valor) ? valor : ''
export const RUTA_ENTRAR = `${RUTA_PANEL}/entrar`
