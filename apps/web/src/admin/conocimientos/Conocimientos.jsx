import { useCallback, useEffect, useState } from 'react'
import { useOutletContext, useSearchParams } from 'react-router'
import { pedir } from '@/admin/api.js'
import { useAvisar } from '@/admin/comun/avisos.js'
import Dialogo from '@/admin/comun/Dialogo.jsx'
import { Banda, Cabecera, Vacio } from '@/admin/comun/Estados.jsx'
import DialogoEnlace from '@/admin/conocimientos/DialogoEnlace.jsx'
import DialogoTecnologia from '@/admin/conocimientos/DialogoTecnologia.jsx'
import { GRUPOS, NIVELES } from '@/admin/conocimientos/datos.js'
import { ponerTitulo } from '@/i18n/documento.js'

const proyectos = (n) => (n === 0 ? 'Ningún proyecto' : n === 1 ? 'En 1 proyecto' : `En ${n} proyectos`)

// 11 · Conocimientos y enlaces (aprobada en ADM-00): la lista maestra de tecnologías, por
// grupos, y los enlaces de contacto. Se edita en diálogos encima de la lista. "En
// Conocimientos" y "Ocultar" se guardan al pulsarlos. La pestaña va en la dirección.
export default function Conocimientos() {
  const avisar = useAvisar()
  const { cargarResumen } = useOutletContext()
  const [params, setParams] = useSearchParams()
  const enlaces = params.get('ver') === 'enlaces'
  const [datos, setDatos] = useState(null) // { tecnologias, enlaces }
  const [error, setError] = useState(null)
  const [intento, setIntento] = useState(0)
  const [editando, setEditando] = useState(null) // { tipo: 'tecnologia' | 'enlace', fila | null }
  const [aBorrar, setABorrar] = useState(null) // { tipo, fila }
  const [borrando, setBorrando] = useState(false)

  useEffect(() => {
    ponerTitulo('Conocimientos y enlaces · Panel')
  }, [])

  useEffect(() => {
    let vivo = true
    Promise.all([pedir('/technologies'), pedir('/links')]).then(([t, l]) => {
      if (!vivo) return
      const falla = [t, l].find((r) => !r.ok)
      if (falla) setError(falla.error)
      else setDatos({ tecnologias: t.datos, enlaces: l.datos })
    })
    return () => {
      vivo = false
    }
  }, [intento])

  const recargar = useCallback(() => {
    setError(null)
    setIntento((n) => n + 1)
  }, [])

  const guardado = (texto) => {
    avisar('ok', texto ?? 'Guardado. Se verá en la web al publicar.')
    recargar()
    cargarResumen()
  }

  // Los interruptores de la lista: al momento.
  const alternar = async (ruta, campo, valor) => {
    const r = await pedir(ruta, { method: 'PATCH', body: JSON.stringify({ [campo]: valor }) })
    if (r.ok) guardado()
    else avisar('error', 'No se ha guardado. Vuelve a probar.')
  }

  const borrar = async () => {
    setBorrando(true)
    const { tipo, fila } = aBorrar
    const r = await pedir(`${tipo === 'tecnologia' ? '/technologies' : '/links'}/${fila.id}`, { method: 'DELETE' })
    setBorrando(false)
    setABorrar(null)
    if (r.ok) guardado(`${tipo === 'tecnologia' ? fila.name : 'Enlace'} borrado. Se verá en la web al publicar.`)
    else avisar('error', r.error === 'necesario' ? 'El CV necesita este enlace: no se puede borrar.' : 'No se ha podido borrar.')
  }

  const cabecera = (
    <Cabecera
      titulo="Conocimientos y enlaces"
      texto="La lista maestra de tecnologías (la usan los proyectos y la sección Conocimientos) y tus enlaces de contacto."
    >
      <button className="boton" type="button" onClick={() => setEditando({ tipo: enlaces ? 'enlace' : 'tecnologia', fila: null })}>
        {enlaces ? '+ Nuevo enlace' : '+ Nueva tecnología'}
      </button>
    </Cabecera>
  )

  if (error) {
    return (
      <>
        {cabecera}
        <Banda
          tipo="error"
          acciones={
            <button className="boton pequeno" type="button" onClick={recargar}>
              Reintentar
            </button>
          }
        >
          <b>No se ha podido cargar.</b> {error === 'red' ? 'No hay conexión con la API.' : 'La API ha dado un error.'}
        </Banda>
      </>
    )
  }

  return (
    <>
      {cabecera}
      <div className="tabs" role="tablist" aria-label="Conocimientos y enlaces">
        {[
          ['tecnologias', 'Tecnologías', datos?.tecnologias.length],
          ['enlaces', 'Enlaces', datos?.enlaces.length],
        ].map(([id, nombre, n]) => (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={(id === 'enlaces') === enlaces}
            onClick={() => setParams(id === 'enlaces' ? { ver: id } : {}, { replace: true })}
          >
            {nombre}
            {n !== undefined && ` · ${n}`}
          </button>
        ))}
      </div>

      {!datos ? (
        <div className="filas-cargando" aria-busy="true" aria-label="Cargando">
          {Array.from({ length: 5 }, (_, i) => (
            <span className="hueco" key={i} />
          ))}
        </div>
      ) : enlaces ? (
        <TablaEnlaces
          lista={datos.enlaces}
          alEditar={(fila) => setEditando({ tipo: 'enlace', fila })}
          alBorrar={(fila) => setABorrar({ tipo: 'enlace', fila })}
          alOcultar={(fila) => alternar(`/links/${fila.id}`, 'is_visible', !fila.is_visible)}
        />
      ) : (
        <Tecnologias
          lista={datos.tecnologias}
          alEditar={(fila) => setEditando({ tipo: 'tecnologia', fila })}
          alBorrar={(fila) => setABorrar({ tipo: 'tecnologia', fila })}
          alAlternar={(fila) => alternar(`/technologies/${fila.id}`, 'is_skill', !fila.is_skill)}
        />
      )}

      {editando?.tipo === 'tecnologia' && (
        <DialogoTecnologia
          fila={editando.fila}
          alCerrar={() => setEditando(null)}
          alGuardar={() => {
            setEditando(null)
            guardado()
          }}
        />
      )}
      {editando?.tipo === 'enlace' && (
        <DialogoEnlace
          fila={editando.fila}
          alCerrar={() => setEditando(null)}
          alGuardar={() => {
            setEditando(null)
            guardado()
          }}
        />
      )}

      <Dialogo
        abierto={Boolean(aBorrar)}
        titulo={`Borrar ${aBorrar?.tipo === 'tecnologia' ? aBorrar.fila.name : 'el enlace'}`}
        alCerrar={borrando ? undefined : () => setABorrar(null)}
      >
        {aBorrar?.tipo === 'tecnologia' && aBorrar.fila.proyectos.length > 0 ? (
          <>
            <p>
              <b>
                {aBorrar.fila.proyectos.length === 1 ? 'La usa 1 proyecto' : `La usan ${aBorrar.fila.proyectos.length} proyectos`}:
              </b>{' '}
              {aBorrar.fila.proyectos.join(', ')}. Si la borras, se quita de {aBorrar.fila.proyectos.length === 1 ? 'él' : 'ellos'}.
            </p>
            <p>Si solo quieres que no salga en Conocimientos, apaga «En Conocimientos».</p>
          </>
        ) : (
          <p>
            Desaparece de la web <b>al publicar</b>. <b>No se puede deshacer.</b>
          </p>
        )}
        <div className="acciones">
          <button className="boton suave" type="button" onClick={() => setABorrar(null)} disabled={borrando} data-enfoque>
            Cancelar
          </button>
          <button className="boton peligro lleno" type="button" onClick={borrar} disabled={borrando}>
            {borrando
              ? 'Borrando…'
              : aBorrar?.tipo === 'tecnologia' && aBorrar.fila.proyectos.length > 0
                ? `Borrar y quitar de ${aBorrar.fila.proyectos.length === 1 ? '1 proyecto' : `${aBorrar.fila.proyectos.length} proyectos`}`
                : 'Borrar'}
          </button>
        </div>
      </Dialogo>
    </>
  )
}

function Tecnologias({ lista, alEditar, alBorrar, alAlternar }) {
  if (lista.length === 0) {
    return (
      <Vacio icono="▢" titulo="Sin tecnologías">
        <p>Añade la primera: los proyectos eligen sus tecnologías de esta lista.</p>
      </Vacio>
    )
  }
  return (
    <>
      <p className="nota-lista">Las atenuadas no salen en Conocimientos, pero los proyectos sí las pueden usar.</p>
      {Object.entries(GRUPOS).map(([grupo, nombre]) => {
        const del = lista.filter((t) => t.category === grupo)
        if (del.length === 0) return null
        return (
          <section key={grupo}>
            <h2 className="mono titulo-grupo">
              {nombre} · {del.length}
            </h2>
            <table className="tabla">
              <thead>
                <tr>
                  <th>
                    <span className="solo-lector">Posición</span>
                  </th>
                  <th>Tecnología</th>
                  <th>Nivel</th>
                  <th>En Conocimientos</th>
                  <th>
                    <span className="solo-lector">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {del.map((t) => (
                  <tr key={t.id} className={t.is_skill ? undefined : 'atenuada'}>
                    <td className="posicion" aria-label={`Posición ${t.posicion}`}>
                      {t.posicion}
                    </td>
                    <td>
                      <p className="nom">{t.name}</p>
                      <p className="sub">
                        {t.nombre_en && `EN: ${t.nombre_en} · `}
                        {proyectos(t.proyectos.length)}
                      </p>
                    </td>
                    <td>
                      {t.level ? (
                        <>
                          <span className="nivel" aria-hidden="true">
                            {[33, 67, 100].map((n) => (
                              <i key={n} className={t.level >= n ? 'on' : undefined} />
                            ))}
                          </span>{' '}
                          <span className="mono">{NIVELES.find((x) => x.valor === t.level)?.largo}</span>
                        </>
                      ) : (
                        <span className="mono gris">Sin nivel</span>
                      )}
                    </td>
                    <td>
                      <label className="interruptor">
                        <input type="checkbox" checked={t.is_skill} onChange={() => alAlternar(t)} />
                        <span className="solo-lector">{`${t.name} en Conocimientos`}</span>
                      </label>
                    </td>
                    <td className="der">
                      <button className="boton pequeno" type="button" onClick={() => alEditar(t)} aria-label={`Editar ${t.name}`}>
                        Editar
                      </button>
                      <button className="enlace borrar" type="button" onClick={() => alBorrar(t)} aria-label={`Borrar ${t.name}`}>
                        Borrar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )
      })}
    </>
  )
}

function TablaEnlaces({ lista, alEditar, alBorrar, alOcultar }) {
  if (lista.length === 0) {
    return (
      <Vacio icono="▢" titulo="Sin enlaces">
        <p>El CV necesita el correo, LinkedIn y GitHub.</p>
      </Vacio>
    )
  }
  return (
    <table className="tabla">
      <thead>
        <tr>
          <th>
            <span className="solo-lector">Posición</span>
          </th>
          <th>Tipo</th>
          <th className="ocultar-movil">Dirección</th>
          <th>Etiqueta</th>
          <th>En la web</th>
          <th>
            <span className="solo-lector">Acciones</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {lista.map((e) => (
          <tr key={e.id} className={e.is_visible ? undefined : 'atenuada'}>
            <td className="posicion">{e.posicion}</td>
            <td>
              <span className="chip gris">{e.type}</span>
            </td>
            <td className="gris ocultar-movil direccion">{e.url}</td>
            <td>{e.label?.es ?? '—'}</td>
            <td>
              {e.is_visible ? (
                <span className="chip pub">
                  <i />
                  Visible
                </span>
              ) : (
                <span className="chip bor">
                  <i />
                  Oculto
                </span>
              )}
            </td>
            <td className="der">
              <button className="boton pequeno" type="button" onClick={() => alEditar(e)}>
                Editar
              </button>
              <button className="enlace gris" type="button" onClick={() => alOcultar(e)}>
                {e.is_visible ? 'Ocultar' : 'Mostrar'}
              </button>
              {!e.necesario && (
                <button className="enlace borrar" type="button" onClick={() => alBorrar(e)}>
                  Borrar
                </button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
