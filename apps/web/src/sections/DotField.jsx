import { useEffect, useRef } from 'react'

// El campo de puntos del contacto, portado de la maqueta (estilo "Dot Grid" de React
// Bits): los puntos se apartan del cursor y un clic lanza una onda. El bucle solo corre
// mientras algo se mueve y se para solo cuando todo vuelve a su sitio. Con movimiento
// reducido, se pinta quieto. Es decorativo.
const GAP = 26 // separación entre puntos
const REACH = 165 // radio de influencia del cursor
// El panel es negro en los dos temas: los colores son fijos (los de --panel-blue y --panel-dim).
const AZUL = '114,144,255'
const REPOSO = 'rgba(132,140,162,0.34)'

export default function DotField() {
  const lienzo = useRef(null)

  useEffect(() => {
    const cv = lienzo.current
    const sec = cv.parentElement
    const ctx = cv.getContext('2d')
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let W = 0
    let H = 0
    let puntos = []
    const ondas = []
    let mx = -9999
    let my = -9999
    let cerca = false
    let fotograma = 0

    const construir = () => {
      const r = cv.getBoundingClientRect()
      W = Math.max(r.width, 1)
      H = Math.max(r.height, 1)
      cv.width = Math.round(W * dpr)
      cv.height = Math.round(H * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const cols = Math.ceil(W / GAP) + 1
      const filas = Math.ceil(H / GAP) + 1
      const ox = (W - (cols - 1) * GAP) / 2
      const oy = (H - (filas - 1) * GAP) / 2
      puntos = []
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < filas; j++) {
          const bx = ox + i * GAP
          const by = oy + j * GAP
          puntos.push({ bx, by, x: bx, y: by, vx: 0, vy: 0 })
        }
      }
    }

    // Pinta un fotograma y devuelve cuánto se ha movido el punto más desplazado.
    const pintar = () => {
      let deriva = 0
      ctx.clearRect(0, 0, W, H)
      for (const d of puntos) {
        const dx = d.x - mx
        const dy = d.y - my
        const dist = Math.hypot(dx, dy) || 0.001
        let prox = dist < REACH ? 1 - dist / REACH : 0
        prox *= prox

        if (cerca) {
          // El cursor empuja los puntos hacia fuera.
          if (dist < REACH && mx !== -9999) {
            d.vx += (dx / dist) * prox * 3.2
            d.vy += (dy / dist) * prox * 3.2
          }
          // Las ondas del clic.
          for (const o of ondas) {
            const wx = d.x - o.x
            const wy = d.y - o.y
            const wd = Math.hypot(wx, wy) || 0.001
            const anillo = Math.abs(wd - o.r)
            if (anillo < 46) {
              const f = (1 - anillo / 46) * o.vida * 6.5
              d.vx += (wx / wd) * f
              d.vy += (wy / wd) * f
            }
          }
          // Un muelle los devuelve a su sitio.
          d.vx = (d.vx + (d.bx - d.x) * 0.055) * 0.88
          d.vy = (d.vy + (d.by - d.y) * 0.055) * 0.88
          d.x += d.vx
          d.y += d.vy
        }

        deriva = Math.max(deriva, Math.abs(d.x - d.bx) + Math.abs(d.y - d.by))
        ctx.fillStyle = prox > 0.02 ? `rgba(${AZUL},${(0.3 + prox * 0.7).toFixed(3)})` : REPOSO
        ctx.beginPath()
        ctx.arc(d.x, d.y, 1.05 + prox * 2.5, 0, Math.PI * 2)
        ctx.fill()
      }
      // El anillo tenue de cada onda.
      for (let k = ondas.length - 1; k >= 0; k--) {
        const o = ondas[k]
        ctx.strokeStyle = `rgba(${AZUL},${(o.vida * 0.22).toFixed(3)})`
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2)
        ctx.stroke()
        o.r += 11
        o.vida -= 0.016
        if (o.vida <= 0) ondas.splice(k, 1)
      }
      return deriva
    }

    // El bucle sigue hasta que todo vuelve a su sitio: entonces se para.
    const bucle = () => {
      const deriva = pintar()
      if (mx === -9999 && ondas.length === 0 && deriva < 0.15) {
        fotograma = 0
        cerca = false
        pintar()
        return
      }
      fotograma = requestAnimationFrame(bucle)
    }
    const arrancar = () => {
      if (!fotograma) fotograma = requestAnimationFrame(bucle)
    }

    const alMover = (e) => {
      const r = cv.getBoundingClientRect()
      mx = e.clientX - r.left
      my = e.clientY - r.top
      cerca = true
      arrancar()
    }
    const alSalir = () => {
      mx = -9999
      my = -9999
    }
    const alPulsar = (e) => {
      const r = cv.getBoundingClientRect()
      ondas.push({ x: e.clientX - r.left, y: e.clientY - r.top, r: 0, vida: 1 })
      cerca = true
      arrancar()
    }
    let espera
    const alCambiarTamano = () => {
      clearTimeout(espera)
      espera = setTimeout(() => {
        construir()
        pintar()
      }, 160)
    }

    construir()
    pintar() // en reposo, visible sin interactuar
    window.addEventListener('resize', alCambiarTamano)
    if (!reducido) {
      sec.addEventListener('pointermove', alMover, { passive: true })
      sec.addEventListener('pointerleave', alSalir)
      sec.addEventListener('pointerdown', alPulsar)
    }
    return () => {
      cancelAnimationFrame(fotograma)
      clearTimeout(espera)
      window.removeEventListener('resize', alCambiarTamano)
      sec.removeEventListener('pointermove', alMover)
      sec.removeEventListener('pointerleave', alSalir)
      sec.removeEventListener('pointerdown', alPulsar)
    }
  }, [])

  return <canvas ref={lienzo} className="dotfield" aria-hidden="true" />
}
