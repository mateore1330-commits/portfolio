// Cada build cambia el nombre de las piezas de la web (llevan huella: Proyectos-BjvJH8YJ.js).
// Una pestaña abierta de antes de publicar pide piezas que ya no existen: se recarga una vez
// para coger las nuevas (#185). Lo hace ErrorRuta, que ya está en la dirección a la que ibas
// (el aviso vite:preloadError llega antes y recargaría la página de la que salías). La marca
// evita un bucle si de verdad falta algo: en un minuto no se vuelve a recargar, y entonces
// sale la pantalla de error con "Recargar".
const MARCA = 'recargado-por-version'
const ESPERA = 60_000

let recargando = false

// Los mensajes de Chrome, Safari y Firefox cuando no llega una pieza.
export const esFalloDeCarga = (error) =>
  /dynamically imported module|Importing a module script failed|Unable to preload/i.test(String(error?.message ?? error))

export const estaRecargando = () => recargando

export function puedeRecargar() {
  try {
    const antes = Number(sessionStorage.getItem(MARCA))
    return !antes || Date.now() - antes > ESPERA
  } catch {
    return false
  }
}

export function recargar() {
  recargando = true
  try {
    sessionStorage.setItem(MARCA, String(Date.now()))
  } catch {
    // Sin sessionStorage se recarga igual; la próxima vez puedeRecargar() dirá que no.
  }
  window.location.reload()
}
