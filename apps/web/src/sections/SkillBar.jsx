import { useLayoutEffect, useRef } from 'react'
import { alAparecer } from '@/sections/alAparecer.js'

const TRAMOS = 3

// Barra de nivel en 3 tramos: "Lo uso a diario" llena 3, "Sólido" 2 y "Lo he usado" 1.
// En reposo ya está llena; si está fuera de pantalla al cargar, espera vacía
// (data-espera) y se llena al aparecer. Es decorativa: la etiqueta ya dice el nivel.
export default function SkillBar({ nivel }) {
  const ref = useRef(null)
  const llenos = Math.round((nivel / 100) * TRAMOS)

  useLayoutEffect(() => {
    const el = ref.current
    const dejarDeEsperar = alAparecer(el, () => delete el.dataset.espera)
    if (!dejarDeEsperar) return undefined
    el.dataset.espera = ''
    return () => {
      dejarDeEsperar()
      delete el.dataset.espera
    }
  }, [])

  return (
    <div ref={ref} className="sk-bar" aria-hidden="true">
      {Array.from({ length: TRAMOS }, (_, i) => (
        <i key={i} className={i < llenos ? 'on' : undefined} />
      ))}
    </div>
  )
}
