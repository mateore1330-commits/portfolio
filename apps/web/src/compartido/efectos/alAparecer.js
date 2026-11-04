// "Que se vea el estado final; solo si hace falta, animarlo al aparecer". Lo usan el
// contador de cifras y la barra de nivel.
//
// - Si el elemento ya se ve al cargar, o se ha pedido menos movimiento, devuelve null y no
//   hace nada: se queda en su estado final, sin animar.
// - Si no, espera a que se vea la mitad, llama a `alVerse` una sola vez y devuelve la
//   función para dejar de esperar (para la limpieza del efecto).
export function alAparecer(el, alVerse) {
  const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const caja = el.getBoundingClientRect()
  const yaSeVe = caja.top < window.innerHeight && caja.bottom > 0
  if (reducido || yaSeVe) return null

  const observador = new IntersectionObserver(
    ([entrada]) => {
      if (!entrada.isIntersecting) return
      observador.disconnect()
      alVerse()
    },
    { threshold: 0.5 },
  )
  observador.observe(el)
  return () => observador.disconnect()
}
