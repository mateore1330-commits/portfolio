import { useState } from 'react'
import { pedir } from '@/admin/api.js'
import Campo from '@/admin/comun/Campo.jsx'
import Dialogo from '@/admin/comun/Dialogo.jsx'
import { conError } from '@/admin/comun/useFormulario.js'
import { GRUPOS, NIVELES, mensaje } from '@/admin/conocimientos/datos.js'

// El diálogo de una tecnología (aprobado en ADM-00): nombre, grupo, nivel y si sale en
// Conocimientos. Más el nombre en inglés, opcional (decidido en ADM-07), y la posición en
// su grupo. fila: la tecnología que se edita, o null para una nueva.
export default function DialogoTecnologia({ fila, alCerrar, alGuardar }) {
  const [v, setV] = useState({
    name: fila?.name ?? '',
    nombre_en: fila?.nombre_en ?? '',
    category: fila?.category ?? 'frontend',
    level: fila?.level ?? null,
    is_skill: fila?.is_skill ?? true,
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
    const r = await pedir(fila ? `/technologies/${fila.id}` : '/technologies', {
      method: fila ? 'PUT' : 'POST',
      body: JSON.stringify({ ...v, posicion }),
    })
    setGuardando(false)
    if (r.ok) alGuardar(r.datos)
    else if (r.error === 'validacion') setErrores(r.datos.errores)
    else setErrores({ general: r.error })
  }

  return (
    <Dialogo abierto titulo={fila ? fila.name : 'Nueva tecnología'} alCerrar={guardando ? undefined : alCerrar}>
      <form className="campos" noValidate onSubmit={guardar}>
        <Campo etiqueta="Nombre" id="t-nombre" error={error('name')}>
          <input id="t-nombre" type="text" value={v.name} onChange={(e) => poner('name', e.target.value)} data-enfoque {...conError('t-nombre', error('name'))} />
        </Campo>
        <Campo
          etiqueta="En inglés se llama…"
          id="t-ingles"
          ayuda="Opcional. Solo si el nombre cambia con el idioma (Trato con cliente → Client relations)."
        >
          <input id="t-ingles" type="text" value={v.nombre_en} onChange={(e) => poner('nombre_en', e.target.value)} />
        </Campo>
        <div className="fila-campos">
          <Campo etiqueta="Grupo" id="t-grupo" error={error('category')}>
            <select id="t-grupo" value={v.category} onChange={(e) => poner('category', e.target.value)}>
              {Object.entries(GRUPOS).map(([valor, nombre]) => (
                <option key={valor} value={valor}>
                  {nombre}
                </option>
              ))}
            </select>
          </Campo>
          <Campo etiqueta="Posición en su grupo" id="t-posicion" error={error('posicion')}>
            <input
              id="t-posicion"
              type="number"
              min={1}
              inputMode="numeric"
              placeholder="Al final"
              value={v.posicion}
              onChange={(e) => poner('posicion', e.target.value)}
              {...conError('t-posicion', error('posicion'))}
            />
          </Campo>
        </div>
        <Campo etiqueta="Nivel" error={error('level')}>
          <div className="segmento" role="group" aria-label="Nivel">
            {NIVELES.map((n) => (
              <button key={n.corto} type="button" aria-pressed={v.level === n.valor} onClick={() => poner('level', n.valor)}>
                {n.corto}
              </button>
            ))}
          </div>
        </Campo>
        <label className="interruptor">
          <input type="checkbox" checked={v.is_skill} onChange={(e) => poner('is_skill', e.target.checked)} /> Sale en Conocimientos
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
