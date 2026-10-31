import { useEffect } from 'react'

const MAXIMO = 12 // px: lo más que se desplaza, también en botones anchos

// El efecto imán de la maqueta: el elemento se acerca un poco al ratón mientras está
// encima y vuelve a su sitio con suavidad al salir. Solo con ratón y sin movimiento
// reducido. Usa la propiedad `translate` (aparte de transform) y conserva las
// transiciones que ya tenga el elemento (color, fondo…). No repinta React.
// `clave`: si el elemento cambia (por ejemplo, el formulario pasa a otro estado), se vuelve
// a enganchar.
export function useMagnetic(ref, clave) {
  useEffect(() => {
    const el = ref.current
    const conRaton = window.matchMedia('(hover: hover) and (pointer: fine)').matches
    const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!el || !conRaton || reducido) return undefined

    const base = getComputedStyle(el).transition
    const con = (extra) => (base && base !== 'all 0s ease 0s' ? `${base}, ${extra}` : extra)
    const limitar = (v) => Math.max(-MAXIMO, Math.min(MAXIMO, v))
    const mover = (e) => {
      const r = el.getBoundingClientRect()
      const x = limitar((e.clientX - r.left - r.width / 2) * 0.28)
      const y = limitar((e.clientY - r.top - r.height / 2) * 0.4)
      el.style.transition = con('translate .1s linear')
      el.style.translate = `${x}px ${y}px`
    }
    const soltar = () => {
      el.style.transition = con('translate .55s cubic-bezier(.16, 1, .3, 1)')
      el.style.translate = ''
    }
    el.addEventListener('mousemove', mover)
    el.addEventListener('mouseleave', soltar)
    return () => {
      el.removeEventListener('mousemove', mover)
      el.removeEventListener('mouseleave', soltar)
      el.style.translate = ''
      el.style.transition = ''
    }
  }, [ref, clave])
}
