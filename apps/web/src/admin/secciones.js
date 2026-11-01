// Las secciones del panel, en el orden del menú aprobado en ADM-00. De aquí salen el menú
// lateral y las rutas. Las que tienen `issue` todavía no existen: abren "Llega en…" hasta
// que su issue las construya (y entonces se le quita el campo).
export const GRUPOS = [
  {
    titulo: 'General',
    secciones: [
      { ruta: '', n: '00', nombre: 'Inicio' },
      { ruta: 'publicaciones', n: '··', nombre: 'Publicaciones', issue: 'ADM-05', que: 'Publicar los cambios en la web y el historial de publicaciones.' },
    ],
  },
  {
    titulo: 'Contenido',
    secciones: [
      { ruta: 'proyectos', n: '01', nombre: 'Proyectos' },
      { ruta: 'textos', n: '02', nombre: 'Textos', issue: 'ADM-04', que: 'Los textos de cada sección de la web, en español e inglés.' },
      { ruta: 'trayectoria', n: '03', nombre: 'Trayectoria', issue: 'ADM-06', que: 'Los empleos y la formación, con sus certificados.' },
      { ruta: 'conocimientos', n: '04', nombre: 'Conocimientos y enlaces', issue: 'ADM-07', que: 'Las tecnologías por grupo y nivel, y los enlaces de contacto.' },
      { ruta: 'cv', n: '05', nombre: 'CV', issue: 'ADM-04', que: 'Los textos del CV y generar el PDF con la prueba ATS.' },
    ],
  },
  {
    titulo: 'Recibido',
    secciones: [
      { ruta: 'mensajes', n: '06', nombre: 'Mensajes', issue: 'ADM-10', que: 'La bandeja de los mensajes del formulario de contacto.', contador: 'mensajes' },
      { ruta: 'visitas', n: '07', nombre: 'Visitas', issue: 'ADM-10', que: 'Las visitas de la web, con los datos de Umami.' },
    ],
  },
]

export const SECCIONES = GRUPOS.flatMap((g) => g.secciones)
