import { useState } from 'react'
import { pedir } from '@/admin/api.js'
import Campo from '@/admin/comun/Campo.jsx'
import Dialogo from '@/admin/comun/Dialogo.jsx'
import { conError } from '@/admin/comun/useFormulario.js'
import { TIPOS_ENLACE, mensaje } from '@/admin/conocimientos/datos.js'

// El diálogo de un enlace (aprobado en ADM-00): tipo, dirección y etiqueta en los dos
// idiomas. El correo se puede escribir a secas: la API le pone el mailto:. El único
// correo, LinkedIn o GitHub no cambia de tipo: el CV lo necesita (decidido en ADM-07).
export default function DialogoEnlace({ fila, alCerrar, alGuardar }) {
  const [v, setV] = useState({
    type: fila?.type ?? 'other',
    url: fila?.url ?? '',
    'label.es': fila?.label?.es ?? '',
    'label.en': fila?.label?.en ?? '',
    is_visible: fila?.is_visible ?? true,
    posicion: fila ? String(fila.posicion) : '',
  })
  const [errores, setErrores] = useState({})
  const [guardando, setGuardando] = useState(false)

  const poner = (campo, valor) => {
    setV((x) => ({ ...x, [campo]: valor }))
    setErrores((e) => ({ ...e, [campo]: undefined }))
  }
  const error = (campo) => (errores[campo] ? mensaje(campo, errores[campo]) : null)

  const guardar = async (e) => {
    e.preventDefault()
    setGuardando(true)
    const posicion = v.posicion.trim() === '' ? null : /^\d+$/.test(v.posicion) ? Number(v.posicion) : v.posicion
    const cuerpo = {
      type: v.type,
      url: v.url,
      label: { es: v['label.es'], en: v['label.en'] },
      is_visible: v.is_visible,
      posicion,
    }
    const r = await pedir(fila ? `/links/${fila.id}` : '/links', { method: fila ? 'PUT' : 'POST', body: JSON.stringify(cuerpo) })
    setGuardando(false)
    if (r.ok) alGuardar(r.datos)
    else if (r.error === 'validacion') setErrores(r.datos.errores)
    else setErrores({ general: r.error })
  }

  const correo = v.type === 'email'
  return (
    <Dialogo abierto titulo={fila ? 'Enlace' : 'Nuevo enlace'} alCerrar={guardando ? undefined : alCerrar}>
      <form className="campos" noValidate onSubmit={guardar}>
        <div className="fila-campos">
          <Campo
            etiqueta="Tipo"
            id="e-tipo"
            error={error('type')}
            ayuda={fila?.necesario ? 'El CV lo necesita: no se cambia.' : undefined}
          >
            <select id="e-tipo" value={v.type} onChange={(e) => poner('type', e.target.value)} disabled={fila?.necesario}>
              {Object.entries(TIPOS_ENLACE).map(([valor, nombre]) => (
                <option key={valor} value={valor}>
                  {nombre}
                </option>
              ))}
            </select>
          </Campo>
          <Campo etiqueta="Posición" id="e-posicion" error={error('posicion')}>
            <input id="e-posicion" type="number" min={1} inputMode="numeric" placeholder="Al final" value={v.posicion} onChange={(e) => poner('posicion', e.target.value)} />
          </Campo>
        </div>
        <Campo etiqueta={correo ? 'Correo' : 'Dirección'} id="e-url" error={error('url')}>
          <input
            id="e-url"
            type={correo ? 'email' : 'url'}
            value={v.url}
            placeholder={correo ? 'info@ejemplo.com' : 'https://…'}
            spellCheck={false}
            onChange={(e) => poner('url', e.target.value)}
            data-enfoque
            {...conError('e-url', error('url'))}
          />
        </Campo>
        <div className="fila-campos">
          {['es', 'en'].map((lang) => (
            <Campo key={lang} etiqueta={`Etiqueta · ${lang.toUpperCase()}`} id={`e-etiqueta-${lang}`} error={error(`label.${lang}`)}>
              <input
                id={`e-etiqueta-${lang}`}
                type="text"
                value={v[`label.${lang}`]}
                onChange={(e) => poner(`label.${lang}`, e.target.value)}
                {...conError(`e-etiqueta-${lang}`, error(`label.${lang}`))}
              />
            </Campo>
          ))}
        </div>
        <label className="interruptor">
          <input type="checkbox" checked={v.is_visible} onChange={(e) => poner('is_visible', e.target.checked)} /> Se ve en la web
        </label>
        {errores.general && <p className="err">No se ha guardado: {errores.general === 'red' ? 'no hay conexión con la API.' : 'la API ha dado un error.'}</p>}
        <div className="acciones">
          <button className="boton suave" type="button" onClick={alCerrar} disabled={guardando}>
            Cancelar
          </button>
          <button className="boton azul" type="submit" disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </Dialogo>
  )
}
