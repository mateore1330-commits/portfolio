// Las secciones de la portada, en orden. La usan el menú, el panel móvil y la propia
// portada: una sola lista para que nunca se desincronicen.
// Los id son iguales en los dos idiomas (el selector de idioma los usa).
// subtitulo: el texto de la derecha en la cabecera de la sección (SectionHead).
export const SECCIONES = [
  { id: 'sobre-mi', clave: 'seccion.sobre', subtitulo: 'seccion.sobre.subtitulo' },
  { id: 'actividad', clave: 'seccion.actividad', subtitulo: 'seccion.actividad.subtitulo' },
  { id: 'conocimientos', clave: 'seccion.conocimientos' },
  { id: 'proyectos', clave: 'seccion.proyectos' },
  { id: 'trayectoria', clave: 'seccion.trayectoria' },
  { id: 'contacto', clave: 'seccion.contacto' },
]

// "/#proyectos" o "/en#proyectos": funciona igual desde la portada que desde la 404.
export const enlaceSeccion = (lang, id) => `${lang === 'en' ? '/en' : '/'}#${id}`
