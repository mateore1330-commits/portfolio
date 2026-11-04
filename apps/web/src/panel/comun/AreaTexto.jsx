import { useLayoutEffect, useRef } from 'react'

// Un <textarea> que crece con lo que escribes (criterio de ADM-04): nunca una barra de
// scroll dentro de un texto. Se mide antes de pintar, así no se ve el salto.
export default function AreaTexto({ value, ...resto }) {
  const ref = useRef(null)

  useLayoutEffect(() => {
    const area = ref.current
    // Oculta (pestaña del otro idioma), mide 0: se ajustará al enseñarse.
    if (!area || area.offsetParent === null) return
    area.style.height = 'auto'
    // + el borde: scrollHeight no lo cuenta.
    area.style.height = `${area.scrollHeight + area.offsetHeight - area.clientHeight}px`
  })

  return <textarea ref={ref} rows={2} value={value} {...resto} />
}
