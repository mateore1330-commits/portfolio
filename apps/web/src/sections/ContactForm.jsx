import { useEffect, useId, useRef, useState } from 'react'
import { useLang, useT } from '@/i18n/useLang.js'

const API = import.meta.env.VITE_API_URL
const ESPERA_MAXIMA_MS = 5000
const CORREO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const VACIO = { nombre: '', correo: '', asunto: '', mensaje: '' }

// Las mismas reglas que el servidor (contacto.py): aquí, para avisar al momento; allí,
// las que mandan. Devuelve el código de error de cada campo que falla.
function validar(campos) {
  const errores = {}
  const nombre = campos.nombre.trim()
  const correo = campos.correo.trim()
  const mensaje = campos.mensaje.trim()
  if (nombre.length < 2 || nombre.length > 100) errores.nombre = 'nombre'
  if (correo.length > 254 || !CORREO.test(correo)) errores.correo = 'correo'
  if (campos.asunto.trim().length > 150) errores.asunto = 'asunto'
  if (mensaje.length < 10 || mensaje.length > 5000) errores.mensaje = 'mensaje'
  return errores
}

// El enlace de correo de respaldo, con el asunto y lo ya escrito: así no se pierde nada.
function enlaceRespaldo(correo, asunto, campos) {
  const cuerpo = [campos.mensaje.trim(), campos.nombre.trim()].filter(Boolean).join('\n\n')
  const params = new URLSearchParams({ subject: campos.asunto.trim() || asunto })
  if (cuerpo) params.set('body', cuerpo)
  // URLSearchParams pone "+" en los espacios; los clientes de correo esperan "%20".
  return `mailto:${correo}?${params.toString().replaceAll('+', '%20')}`
}

// El formulario de contacto. Estados: listo · enviando · enviado · sinApi.
// - Si la API no existe o no contesta en 5 s (al cargar o al enviar), el formulario se
//   cambia por un enlace de correo con lo escrito: el visitante nunca ve un error.
// - Si el servidor rechaza algo (un campo o el límite por hora), se dice y lo escrito se queda.
export default function ContactForm({ correo, boton, respaldo }) {
  const t = useT()
  const lang = useLang()
  const id = useId()
  const [campos, setCampos] = useState(VACIO)
  const [errores, setErrores] = useState({})
  const [aviso, setAviso] = useState('')
  const [estado, setEstado] = useState(API ? 'listo' : 'sinApi')
  const inicio = useRef(0) // cuándo se vio el formulario (para el tiempo mínimo)
  const trampa = useRef(null)

  // Al aparecer: se apunta la hora (para el antispam) y, si la API no contesta, el
  // respaldo desde el principio, antes de que nadie escriba nada.
  useEffect(() => {
    inicio.current = Date.now()
    if (!API) return undefined
    const control = new AbortController()
    fetch(new URL('/api/health', API), {
      signal: AbortSignal.any([control.signal, AbortSignal.timeout(ESPERA_MAXIMA_MS)]),
    })
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status))
      })
      .catch(() => {
        if (!control.signal.aborted) setEstado('sinApi')
      })
    return () => control.abort()
  }, [])

  const cambiar = (campo) => (e) => {
    setCampos((c) => ({ ...c, [campo]: e.target.value }))
    if (errores[campo]) {
      setErrores((antes) => {
        const resto = { ...antes }
        delete resto[campo]
        return resto
      })
    }
  }

  const enviar = async (e) => {
    e.preventDefault()
    if (estado === 'enviando') return
    const encontrados = validar(campos)
    setErrores(encontrados)
    setAviso('')
    if (Object.keys(encontrados).length > 0) {
      e.currentTarget.querySelector(`[name="${Object.keys(encontrados)[0]}"]`)?.focus()
      return
    }
    setEstado('enviando')
    try {
      const respuesta = await fetch(new URL('/api/contact', API), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...campos,
          idioma: lang,
          web: trampa.current.value,
          tiempo: Date.now() - inicio.current,
        }),
        signal: AbortSignal.timeout(ESPERA_MAXIMA_MS),
      })
      if (respuesta.status === 201) {
        setCampos(VACIO)
        setEstado('enviado')
        return
      }
      if (respuesta.status === 400) {
        setErrores((await respuesta.json()).errores ?? {})
        setEstado('listo')
        return
      }
      if (respuesta.status === 429) {
        setAviso(t('contacto.error_limite'))
        setEstado('listo')
        return
      }
      setEstado('sinApi')
    } catch {
      // Sin respuesta (caída o más de 5 s): al enlace de correo, con todo lo escrito.
      setEstado('sinApi')
    }
  }

  if (estado === 'enviado') {
    return (
      <div className="form-contacto hecho" role="status">
        <p className="estado-ok">✓ {t('contacto.enviado')}</p>
        <p className="nota">{t('contacto.enviado_nota')}</p>
        <button type="button" className="enlace-texto" onClick={() => setEstado('listo')}>
          {t('contacto.otro')}
        </button>
      </div>
    )
  }

  if (estado === 'sinApi') {
    return (
      <div className="form-contacto respaldo" role="status">
        <p className="nota">{t('contacto.sin_api')}</p>
        <a className="big-btn" href={enlaceRespaldo(correo, t('contacto.asunto_defecto'), campos)}>
          {respaldo} <span aria-hidden="true">→</span>
        </a>
        <p className="nota peq">{t('contacto.sin_api_nota')}</p>
      </div>
    )
  }

  // Cada campo, con su número en azul (01…04), su error enlazado y la línea que se
  // vuelve azul al escribir.
  const campo = (nombre, numero, etiqueta, props = {}, Elemento = 'input') => {
    const error = errores[nombre]
    return (
      <div className={error ? 'campo mal' : 'campo'}>
        <label htmlFor={`${id}-${nombre}`}>
          <b aria-hidden="true">{String(numero).padStart(2, '0')}</b> {etiqueta}
        </label>
        <Elemento
          id={`${id}-${nombre}`}
          name={nombre}
          value={campos[nombre]}
          onChange={cambiar(nombre)}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? `${id}-${nombre}-error` : undefined}
          {...props}
        />
        <span className="error" id={`${id}-${nombre}-error`}>
          {error && t(`contacto.error_${error}`)}
        </span>
      </div>
    )
  }

  return (
    <form className="form-contacto" onSubmit={enviar} noValidate>
      <div className="cab-form">
        <span className="flecha" aria-hidden="true">
          →
        </span>
        <h3>{t('contacto.escribeme')}</h3>
        <span className="mini">{t('contacto.asunto_opcional')}</span>
      </div>
      {campo('nombre', 1, t('contacto.nombre'), { autoComplete: 'name', placeholder: t('contacto.nombre_pista') })}
      {campo('correo', 2, t('contacto.correo'), { type: 'email', autoComplete: 'email', placeholder: t('contacto.correo_pista') })}
      {campo('asunto', 3, t('contacto.asunto'), { placeholder: t('contacto.asunto_pista') })}
      {campo('mensaje', 4, t('contacto.mensaje'), { rows: 5, placeholder: t('contacto.mensaje_pista') }, 'textarea')}

      {/* La trampa: invisible y fuera del tabulador. Una persona no la rellena; un bot, sí. */}
      <div className="trampa" aria-hidden="true">
        <label htmlFor={`${id}-web`}>Web</label>
        <input ref={trampa} id={`${id}-web`} name="web" tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>

      <button type="submit" className="big-btn azul" disabled={estado === 'enviando'}>
        <span>{estado === 'enviando' ? t('contacto.enviando') : boton}</span>
        {estado !== 'enviando' && (
          <span className="flecha" aria-hidden="true">
            →
          </span>
        )}
      </button>
      <p className="nota peq">{t('contacto.privacidad')}</p>
      <p className="aviso-envio" role="alert">
        {aviso}
      </p>
    </form>
  )
}
