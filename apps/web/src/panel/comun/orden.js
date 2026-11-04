import { useCallback, useState } from 'react'
import { pedir } from '@/panel/utilidades/api.js'
import { useAvisar } from '@/panel/comun/avisos.js'

// La lista con el orden de esos ids (los que no están, al final, como estaban).
export function ordenarPor(lista, ids) {
  const sitio = new Map(ids.map((id, i) => [id, i]))
  return [...lista].sort((a, b) => (sitio.get(a.id) ?? Infinity) - (sitio.get(b.id) ?? Infinity))
}

// Guardar el orden al soltar (ADM-09): se ve al momento y se manda a la API. Si falla,
// vuelve a como estaba y se avisa. Si la lista había cambiado (otra pestaña creó o borró
// algo: 409), se recarga.
//   guardarOrden({ ruta, ids, cuerpo, poner, antes, aviso })
//   - poner(ids): coloca la lista de la pantalla en ese orden.
//   - antes: los ids de antes, para volver.
//   - aviso: otro texto para cuando sale bien (el cambio de destacado, #154).
export function useGuardarOrden({ alGuardar, alDesfasar }) {
  const avisar = useAvisar()
  return useCallback(
    async ({ ruta, ids, cuerpo = {}, poner, antes, aviso }) => {
      poner(ids)
      const r = await pedir(ruta, { method: 'PUT', body: JSON.stringify({ ...cuerpo, ids }) })
      if (r.ok) {
        avisar('ok', aviso ?? 'Orden guardado. Se verá en la web al publicar.')
        alGuardar?.()
        return
      }
      poner(antes)
      if (r.error === 'desfasado') {
        avisar('error', 'La lista había cambiado: se ha recargado. Vuelve a ordenarla.')
        alDesfasar?.()
      } else avisar('error', 'No se ha guardado el orden. Ha vuelto a como estaba.')
    },
    [avisar, alGuardar, alDesfasar],
  )
}

// --- Los párrafos y bloques de un formulario -----------------------------------------
// Son textos sin id: para arrastrarlos, cada uno lleva una clave que lo acompaña al moverse.
// Si la lista crece o mengua desde fuera (añadir, deshacer…), las claves se ajustan solas.
let ultima = 0
const nuevas = (n) => Array.from({ length: n }, () => `e${++ultima}`)

export function useClaves(largo) {
  const [claves, setClaves] = useState(() => nuevas(largo))
  if (claves.length !== largo) {
    const ajustadas = claves.length < largo ? [...claves, ...nuevas(largo - claves.length)] : claves.slice(0, largo)
    setClaves(ajustadas)
    return [ajustadas, setClaves]
  }
  return [claves, setClaves]
}

// La lista en el orden de las claves nuevas (lo que da ListaOrdenable al soltar).
export const permutar = (lista, claves, orden) => orden.map((c) => lista[claves.indexOf(c)])
