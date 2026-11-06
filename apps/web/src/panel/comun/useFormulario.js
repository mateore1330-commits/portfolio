import { useCallback, useMemo, useState } from 'react'

// El estado de un formulario del panel (ADM-00, "cambios sin guardar, campo a campo"):
// lo guardado y lo que hay ahora, con claves planas ('name.es', 'slug', 'description.en').
// Sabe qué ha cambiado y cuánto, y deshace un campo. Si un texto vuelve a como estaba,
// deja de contar como cambio: se compara el valor, no si se ha tocado.
//
// porElementos: las claves que son listas de párrafos. Cuentan un cambio por párrafo, y
// cada párrafo lleva su propia marca.
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b)

// Elemento a elemento: un párrafo, un par dato · valor o un bloque entero (se compara el
// contenido, así un bloque que vuelve a como estaba deja de contar).
export function parrafosCambiados(ahora = [], antes = []) {
  const largo = Math.max(ahora.length, antes.length)
  return Array.from({ length: largo }, (_, i) => !igual(ahora[i], antes[i]))
}

export function useFormulario(porElementos = []) {
  const [estado, setEstado] = useState({ original: null, valores: null })
  const { original, valores } = estado

  const cargar = useCallback((v) => setEstado({ original: v, valores: v }), [])
  const poner = useCallback((clave, valor) => setEstado((e) => ({ ...e, valores: { ...e.valores, [clave]: valor } })), [])
  const deshacer = useCallback((clave) => setEstado((e) => ({ ...e, valores: { ...e.valores, [clave]: e.original[clave] } })), [])
  const descartar = useCallback(() => setEstado((e) => ({ ...e, valores: e.original })), [])
  // Algo que ya se ha guardado por su cuenta (un archivo subido): cambia lo guardado y lo de
  // ahora, sin tocar el resto de cambios.
  const fijar = useCallback(
    (clave, valor) => setEstado((e) => ({ original: { ...e.original, [clave]: valor }, valores: { ...e.valores, [clave]: valor } })),
    [],
  )

  // Cuántos cambios hay en cada clave.
  const porClave = useMemo(() => {
    if (!valores) return {}
    const cuenta = {}
    for (const clave of Object.keys(valores)) {
      const n = porElementos.includes(clave)
        ? parrafosCambiados(valores[clave], original[clave]).filter(Boolean).length
        : Number(!igual(valores[clave], original[clave]))
      if (n) cuenta[clave] = n
    }
    return cuenta
    // porElementos es una lista fija de cada formulario.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valores, original])

  const cambiado = useCallback((clave) => Boolean(porClave[clave]), [porClave])
  // Los cambios de un grupo de claves: las de un bloque o las de un idioma.
  const cuantos = useCallback(
    (filtro = () => true) => Object.entries(porClave).reduce((n, [clave, k]) => (filtro(clave) ? n + k : n), 0),
    [porClave],
  )

  // Cambiado en un idioma y no en el otro (#185): el del otro idioma queda por revisar. Da el
  // idioma que se cambió ('español' / 'inglés'), o null. Es un aviso: se puede guardar igual.
  const revisar = useCallback(
    (clave) => {
      const otra = gemelo(clave)
      if (!otra || !valores || !(otra in valores) || porClave[clave] || !porClave[otra]) return null
      return nombreIdioma(otra)
    },
    [porClave, valores],
  )
  const porRevisar = useCallback(
    (filtro = () => true) => Object.keys(valores ?? {}).filter((k) => filtro(k) && revisar(k)),
    [valores, revisar],
  )

  return { valores, original, cargar, poner, deshacer, descartar, fijar, cambiado, cuantos, revisar, porRevisar }
}

const NOMBRES = { es: 'español', en: 'inglés' }
const esIdioma = (parte) => parte === 'es' || parte === 'en'
// 'name.en' → 'inglés'.
export const nombreIdioma = (clave) => NOMBRES[clave.split('.').find(esIdioma)]

// El mismo campo en el otro idioma: 'name.es' → 'name.en', 'es.perfil' → 'en.perfil'. Null
// si la clave no lleva idioma (lo que no se traduce).
export function gemelo(clave) {
  const partes = clave.split('.')
  const i = partes.findIndex(esIdioma)
  if (i === -1) return null
  partes[i] = partes[i] === 'es' ? 'en' : 'es'
  return partes.join('.')
}

// Lo que necesita el control para que el lector de pantalla lea también el error (Campo.jsx).
export const conError = (id, error) => (error ? { 'aria-invalid': true, 'aria-describedby': `${id}-error` } : {})
