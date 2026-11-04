import { useSyncExternalStore } from 'react'

// Cuántos cambios sin guardar tiene la pantalla abierta. Lo pone AvisoSalir (que ya lo sabe)
// y lo lee el diálogo de Publicar, para avisar de que no se publicarán (decidido en ADM-05).
let cuantos = 0
const oyentes = new Set()

export function ponerSinGuardar(n) {
  if (n === cuantos) return
  cuantos = n
  oyentes.forEach((oyente) => oyente())
}

const suscribir = (oyente) => {
  oyentes.add(oyente)
  return () => oyentes.delete(oyente)
}

export const useSinGuardar = () => useSyncExternalStore(suscribir, () => cuantos)
