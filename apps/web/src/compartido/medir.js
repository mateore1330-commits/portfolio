// Medir las visitas (ADM-10) con Umami, instalado en nuestro propio servidor: sin cookies y
// sin guardar nada en el dispositivo de quien visita. Sin VITE_UMAMI_URL y
// VITE_UMAMI_WEBSITE_ID no se carga nada (como en local, salvo para probarlo).
//
// - Solo cuenta en los dominios de VITE_UMAMI_DOMINIOS (por defecto, el de la web): en
//   localhost no cuenta, y las pruebas no ensucian los datos.
// - El panel nunca se mide: ni sus pantallas ni su dirección secreta llegan a Umami (ni como
//   página ni como "de dónde venía"). Se filtra antes de enviar.
// - Las visitas de Mateo no cuentan: el panel marca su navegador (no medir más abajo).
import { RUTA_PANEL } from '@/panel/utilidades/ruta.js'

const URL_UMAMI = (import.meta.env.VITE_UMAMI_URL ?? '').trim().replace(/\/+$/, '')
const SITIO = (import.meta.env.VITE_UMAMI_WEBSITE_ID ?? '').trim()
const DOMINIOS = import.meta.env.VITE_UMAMI_DOMINIOS || 'mateorodriguez.solutions,www.mateorodriguez.solutions'
const MARCA = 'umami.disabled' // la que mira el script de Umami para no contar ese navegador

export const hayMedicion = Boolean(URL_UMAMI && SITIO)
export const URL_PANEL_UMAMI = URL_UMAMI

const esDelPanel = (ruta) => Boolean(RUTA_PANEL) && typeof ruta === 'string' && ruta.includes(RUTA_PANEL)

// Lo que se va a enviar pasa por aquí (data-before-send): lo del panel no sale.
function antesDeEnviar(tipo, datos) {
  if (esDelPanel(datos?.url)) return null
  if (esDelPanel(datos?.referrer)) return { ...datos, referrer: '' }
  return datos
}

let cargada = false

// Se llama desde la web pública (EstructuraWeb). Espera a que la página termine de cargar
// y a un rato libre del navegador: así no compite con lo que se ve primero (Lighthouse).
export function cargarMedicion() {
  if (cargada || !hayMedicion || typeof document === 'undefined') return
  cargada = true
  window.antesDeEnviarUmami = antesDeEnviar
  const poner = () => {
    const script = document.createElement('script')
    script.defer = true
    script.src = `${URL_UMAMI}/script.js`
    script.dataset.websiteId = SITIO
    script.dataset.domains = DOMINIOS
    script.dataset.beforeSend = 'antesDeEnviarUmami'
    script.dataset.excludeSearch = 'true'
    document.head.append(script)
  }
  const cuandoPuedas = () => ('requestIdleCallback' in window ? requestIdleCallback(poner, { timeout: 3000 }) : setTimeout(poner, 1))
  if (document.readyState === 'complete') cuandoPuedas()
  else window.addEventListener('load', cuandoPuedas, { once: true })
}

// Un evento: medir('demo-abierta', { proyecto: 'cleanflow' }). Si Umami no ha cargado (o lo
// bloquea el navegador), no pasa nada.
export function medir(evento, datos) {
  try {
    window.umami?.track(evento, datos)
  } catch {
    // Medir nunca puede romper la web.
  }
}

// --- No contar las visitas de Mateo ---------------------------------------------------
// En su navegador (el del panel), no en el de nadie más. localStorage puede fallar
// (navegación privada): entonces simplemente no se marca.
export function noMedirEsteNavegador() {
  try {
    localStorage.setItem(MARCA, '1')
  } catch {
    // Sin almacenamiento: no se puede marcar.
  }
}

export function volverAMedirEsteNavegador() {
  try {
    localStorage.removeItem(MARCA)
  } catch {
    // Sin almacenamiento: no hay marca que quitar.
  }
}

export function esteNavegadorNoCuenta() {
  try {
    return localStorage.getItem(MARCA) !== null
  } catch {
    return false
  }
}
