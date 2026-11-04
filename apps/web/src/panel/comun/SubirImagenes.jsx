import { useEffect, useId, useRef, useState } from 'react'
import { subir } from '@/panel/utilidades/api.js'

export const MAXIMO = 5 * 1024 * 1024
const mb = (bytes) => `${(bytes / 1024 / 1024).toLocaleString('es-ES', { maximumFractionDigits: 1 })} MB`

// La zona de subir de la maqueta (ADM-08): arrastrar aquí o "Elegir archivos" (también con
// el teclado). Antes de subir se ve la foto; mientras sube, su barra de progreso. Lo que no
// vale (formato o tamaño) se dice antes de mandarlo; la API lo vuelve a comprobar de verdad.
// alSubido(datos) por cada archivo que llega bien; alFallar([textos]) con los que no.
export default function SubirImagenes({ ruta, tipos, formatos, alSubido, alFallar, deshabilitada }) {
  const id = useId()
  const entrada = useRef(null)
  const [encima, setEncima] = useState(false)
  const [subiendo, setSubiendo] = useState([]) // [{ clave, nombre, tamano, vista, progreso }]

  // Las vistas previas son direcciones temporales del navegador: se sueltan al terminar
  // cada subida y, si se sale de la pantalla a medias, todas.
  const vistas = useRef(new Set())
  useEffect(() => {
    const pendientes = vistas.current
    return () => pendientes.forEach((v) => URL.revokeObjectURL(v))
  }, [])

  const elegidos = async (archivos) => {
    const fallos = []
    const validos = []
    for (const archivo of archivos) {
      if (!tipos.includes(archivo.type)) fallos.push(`${archivo.name} no es un formato permitido (${formatos})`)
      else if (archivo.size > MAXIMO) fallos.push(`${archivo.name} pesa ${mb(archivo.size)} (el máximo es 5 MB)`)
      else validos.push(archivo)
    }
    const nuevos = validos.map((archivo, i) => ({
      clave: `${Date.now()}-${i}`,
      archivo,
      nombre: archivo.name,
      tamano: archivo.size,
      vista: archivo.type.startsWith('image/') ? URL.createObjectURL(archivo) : null,
      progreso: 0,
    }))
    nuevos.forEach((s) => s.vista && vistas.current.add(s.vista))
    setSubiendo((lista) => [...lista, ...nuevos])

    // De una en una: así cada barra avanza de verdad y Cloudinary no recibe todas a la vez.
    for (const s of nuevos) {
      const r = await subir(ruta, s.archivo, (progreso) =>
        setSubiendo((lista) => lista.map((x) => (x.clave === s.clave ? { ...x, progreso } : x))),
      )
      setSubiendo((lista) => lista.filter((x) => x.clave !== s.clave))
      if (s.vista) {
        URL.revokeObjectURL(s.vista)
        vistas.current.delete(s.vista)
      }
      if (r.ok) alSubido(r.datos)
      else fallos.push(`${s.nombre}: ${motivo(r.error, s)}`)
    }
    if (fallos.length) alFallar(fallos)
  }

  return (
    <>
      <div
        className={`zona-subida${encima ? ' encima' : ''}${deshabilitada ? ' apagada' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          if (!deshabilitada) setEncima(true)
        }}
        onDragLeave={() => setEncima(false)}
        onDrop={(e) => {
          e.preventDefault()
          setEncima(false)
          if (!deshabilitada) elegidos([...e.dataTransfer.files])
        }}
      >
        <b>Arrastra aquí {tipos.includes('application/pdf') ? 'el archivo' : 'las imágenes'}</b>
        <p>
          o {tipos.includes('application/pdf') ? 'elígelo' : 'elígelas'} · {formatos} · hasta 5 MB
          {tipos.includes('application/pdf') ? '' : ' cada una'}
        </p>
        <input
          ref={entrada}
          id={id}
          className="solo-lector"
          type="file"
          aria-label={tipos.includes('application/pdf') ? 'Elegir el archivo' : 'Elegir las imágenes'}
          accept={tipos.join(',')}
          multiple={!tipos.includes('application/pdf')}
          disabled={deshabilitada}
          onChange={(e) => {
            elegidos([...e.target.files])
            e.target.value = ''
          }}
        />
        <button className="boton" type="button" onClick={() => entrada.current.click()} disabled={deshabilitada}>
          Elegir {tipos.includes('application/pdf') ? 'archivo' : 'archivos'}
        </button>
      </div>
      {subiendo.length > 0 && (
        <div className="galeria" aria-live="polite">
          {subiendo.map((s) => (
            <article className="foto" key={s.clave}>
              <div className="img">{s.vista ? <img src={s.vista} alt="" /> : 'Subiendo…'}</div>
              <div className="progreso" role="progressbar" aria-valuenow={s.progreso} aria-valuemin={0} aria-valuemax={100} aria-label={`Subiendo ${s.nombre}`}>
                <i style={{ width: `${s.progreso}%` }} />
              </div>
              <div className="datos">
                <p className="mono">
                  {s.nombre} · {mb(s.tamano)} · {s.progreso < 100 ? `${s.progreso} %` : 'guardando…'}
                </p>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  )
}

function motivo(error, s) {
  if (error === 'grande') return `pesa ${mb(s.tamano)} (el máximo es 5 MB)`
  if (error === 'formato') return 'no es un formato permitido'
  if (error === 'sin_cloudinary') return 'falta configurar Cloudinary en el servidor'
  if (error === 'red') return 'no hay conexión con la API'
  return 'Cloudinary no lo ha aceptado; vuelve a probar'
}
