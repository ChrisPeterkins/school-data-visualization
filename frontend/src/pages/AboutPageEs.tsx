import { Link } from 'react-router-dom';

const Section = ({ id, title, children }: { id: string; title: string; children: React.ReactNode }) => (
  <section id={id} className="card-surface p-5 sm:p-7 space-y-3">
    <h2 className="text-lg font-semibold text-stone-900">{title}</h2>
    <div className="text-sm text-stone-600 leading-relaxed space-y-3">{children}</div>
  </section>
);

/** Spanish edition of the About page; keep sections in step with AboutPage.tsx. */
export default function AboutPageEs({ range }: { range: string }) {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6" lang="es">
      <div>
        <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Acerca de los datos</h1>
        <p className="mt-1 text-sm text-stone-500">Cada cifra de este sitio proviene de un archivo público. Esta página explica cuáles, qué se hizo con ellos y dónde conviene tener cuidado.</p>
      </div>

      <nav className="text-sm text-navy-700 flex flex-wrap gap-x-4 gap-y-1" aria-label="En esta página">
        {[['sources', 'Fuentes'], ['measures', 'Qué significan las medidas'], ['indicators', 'Más allá de los exámenes'], ['methods', 'Cómo se calculan las cifras'], ['caveats', 'Advertencias por año'], ['updates', 'Actualizaciones'], ['privacy', 'Privacidad']].map(([id, label]) => (
          <a key={id} href={`#${id}`} className="hover:underline">{label}</a>
        ))}
      </nav>

      <Section id="sources" title="Fuentes">
        <p>
          <strong>Los resultados de evaluación</strong> provienen de las hojas de cálculo públicas del Departamento de Educación de Pensilvania (PDE) para el
          PSSA (grados 3 a 8) y los exámenes Keystone (grado 11), publicadas cada año a nivel de escuela, distrito y estado en la{' '}
          <a className="text-navy-700 underline" href="https://www.pa.gov/agencies/education/data-and-reporting/assessment-reporting" target="_blank" rel="noreferrer">página de informes de evaluación del PDE</a>.
          Actualmente cargado: {range || '2015-2025'} para PSSA y Keystone, más los resultados Keystone de 2013 y 2014 recuperados del sitio archivado del PDE.
        </p>
        <p>
          <strong>El crecimiento</strong> proviene de los archivos de valor agregado PVAAS del PDE (escuela y distrito, por materia y grado, y por grupo de estudiantes).
          <strong> Los datos de las escuelas</strong>, como direcciones, coordenadas, matrícula, rango de grados y nivel, provienen del Common Core of Data del NCES a través de la API de datos educativos del Urban Institute.
          <strong> Los límites de distrito</strong> del mapa son el archivo cartográfico de distritos escolares 2023 de la Oficina del Censo de EE. UU.
        </p>
      </Section>

      <Section id="measures" title="Qué significan las medidas">
        <p><strong>Competente o superior</strong> es el porcentaje de estudiantes evaluados que obtuvieron Competente o Avanzado. El PDE también informa por separado Avanzado, Competente, Básico y Por debajo de básico; esos valores aparecen en los desgloses por nivel.</p>
        <p>
          <strong>El crecimiento</strong> es el índice de crecimiento PVAAS, una medida estandarizada de si los estudiantes de una escuela avanzaron más o menos de lo que el estado espera según sus puntajes previos.
          Bandas del PDE: aproximadamente +2 o más está muy por encima del estándar, +1 a +2 por encima, -1 a +1 lo cumple, -1 a -2 por debajo, -2 o menos muy por debajo. El crecimiento mide el progreso, no el nivel: una escuela puede tener baja competencia y alto crecimiento.
        </p>
        <p><strong>Estudiantes evaluados</strong> es el "número calificado" del PDE para la fila. Los grupos con menos de 11 estudiantes son suprimidos por el PDE y aparecen como N/A.</p>
      </Section>

      <Section id="indicators" title="Más allá de los exámenes">
        <p>
          <strong>Asistencia y preparación</strong> provienen de los <a className="text-navy-700 underline" href="https://futurereadypa.org/Home/DataFiles" target="_blank" rel="noreferrer">archivos de datos del Future Ready PA Index</a> del PDE (desde 2017-18).
          La asistencia regular es el porcentaje de estudiantes que no tuvieron ausentismo crónico (faltar más del 10% de los días inscritos). Estándares de carrera, cursos rigurosos (AP, IB, matrícula doble o CTE), aprendizaje basado en la industria y transición postsecundaria son las medidas universitarias y profesionales del Índice; el dominio del inglés y la lectura de 3.º / matemáticas de 7.º son sus medidas de progreso.
          El PDE dejó de publicar el porcentaje de aprendizaje basado en la industria después de 2020-21. Los valores suprimidos por el PDE (menos de 20 estudiantes) se omiten.
        </p>
        <p>
          <strong>Las tasas de graduación</strong> son las tasas de cohorte a 4 años del PDE, de los <a className="text-navy-700 underline" href="https://www.pa.gov/agencies/education/data-and-reporting/high-school-graduation" target="_blank" rel="noreferrer">archivos de graduación por cohorte</a> (desde 2016-17), por escuela, distrito y estado, con el tamaño de la cohorte. También se carga la tasa de estudiantes económicamente desfavorecidos cuando se publica.
        </p>
        <p>
          <strong>La matrícula</strong> es el conteo del 1 de octubre del PDE según los <a className="text-navy-700 underline" href="https://www.pa.gov/agencies/education/data-and-reporting/enrollment" target="_blank" rel="noreferrer">informes de matrícula de escuelas públicas</a> de 2015-16 a 2025-26, por escuela y distrito. El conteo más reciente también dimensiona los puntos del mapa y alimenta los filtros de matrícula.
        </p>
        <p>
          <strong>El gasto por alumno</strong> es el total de gastos dividido por la matrícula diaria promedio (ADM), ambos de los <a className="text-navy-700 underline" href="https://www.pa.gov/agencies/education/programs-and-services/schools/grants-and-funding/school-finances/financial-data/summary-of-annual-financial-report-data" target="_blank" rel="noreferrer">resúmenes del Informe Financiero Anual</a> del PDE (desde 2015-16). La ADM de las escuelas chárter está disponible desde 2019-20, así que no tienen cifra por alumno antes. Los centros técnicos informan gastos pero no ADM. El gasto compra muchas cosas además de resultados de exámenes; el gráfico de la página de distritos es un punto de partida, no un veredicto.
        </p>
        <p>Las etiquetas de año siguen la convención de las evaluaciones: 2025 significa el año escolar 2024-25 (para la matrícula, el conteo de octubre de 2024).</p>
      </Section>

      <Section id="methods" title="Cómo se calculan las cifras">
        <p>
          <strong>Ponderación.</strong> Toda cifra que combina escuelas, distritos o grados (tendencias, páginas de condado, clasificaciones con varias materias, brechas) se ponderá por estudiantes evaluados.
          El resultado es el porcentaje de estudiantes, no un promedio de porcentajes escolares, así que una escuela de 1,200 estudiantes cuenta doce veces más que una de 100.
        </p>
        <p>
          <strong>Totales de todos los grados.</strong> Los archivos del PDE incluyen una fila "Total" de todos los grados para cada escuela, distrito y el estado. Esas filas se usan siempre que se muestra una sola cifra por entidad y se etiquetan "Todos los grados".
          Los gráficos por grado usan las filas por grado.
        </p>
        <p>
          <strong>Clasificaciones y percentiles</strong> usan el total de todos los grados de la materia elegida (o la combinación de materias ponderada por evaluados), exigen un mínimo de estudiantes evaluados (40 por defecto en clasificaciones, 20 en percentiles) y comparan entre iguales: los percentiles se muestran a nivel estatal, dentro del condado y entre escuelas del mismo nivel.
        </p>
        <p>
          <strong>Las brechas</strong> son diferencias en puntos porcentuales entre un grupo de estudiantes y Todos los estudiantes en la misma escuela, distrito, condado o estado, para la misma materia y año.
        </p>
        <p>
          <strong>Filas derivadas.</strong> El archivo Keystone de distritos de 2016 del PDE lista solo unos 300 de 500 distritos, y los archivos archivados de 2013 y 2014 no tienen nivel de distrito. Para esos años, las cifras de distrito se reconstruyen a partir de sus escuelas, ponderadas por estudiantes evaluados. Llevan la fuente "derived-from-schools" en la base de datos.
        </p>
      </Section>

      <Section id="caveats" title="Advertencias por año">
        <ul className="list-disc pl-5 space-y-2">
          <li><strong>2020:</strong> no se aplicaron exámenes PSSA ni Keystone (COVID-19). Los gráficos dejan el año en blanco en lugar de trazar una línea a través de él.</li>
          <li><strong>2021:</strong> las pruebas se reanudaron con menor participación; cerca de una quinta parte de las filas escolares están suprimidas y muchos distritos evaluaron en otoño en lugar de primavera. Trate las comparaciones de 2021 con cautela.</li>
          <li><strong>2025:</strong> el PDE elevó los estándares de desempeño del PSSA. La caída respecto a 2024 refleja en parte el nuevo listón y no un cambio en el aprendizaje. ELA estatal (todos los grados) pasó de 53% a 48.5% y Matemáticas de 40% a 42%. El PDE tampoco publicó resultados de Ciencias de 2025, así que las series de Ciencias terminan en 2024.</li>
          <li><strong>2013 y 2014:</strong> solo Keystone, a nivel de escuela y estado, del sitio archivado del PDE. Los archivos PSSA de 2012 a 2014 no se conservaron, así que el PSSA comienza en 2015.</li>
          <li><strong>Grupos de estudiantes estatales antes de 2022:</strong> los archivos estatales del PDE informaban solo Todos los estudiantes e Históricamente de bajo rendimiento, así que las tendencias de brechas estatales de otros grupos comienzan en 2022. Las brechas de escuela y distrito llegan hasta 2015.</li>
          <li><strong>Escuelas cerradas:</strong> las escuelas sin registro en el directorio NCES 2023 y sin resultados en el último año se marcan como cerradas y se ocultan de la búsqueda salvo que se pidan. Su historial se conserva.</li>
        </ul>
      </Section>

      <Section id="updates" title="Actualizaciones">
        <p>
          El PDE publica los resultados de cada año en otoño. Una verificación semanal revisa la página del PDE, descarga los archivos nuevos, los importa y actualiza el sitio; la página de administración muestra la última verificación.
          El PDE ha indicado que los resultados de 2026 están en espera hasta más adelante en el otoño de 2026.
        </p>
        <p>
          El código fuente, los scripts de importación y una descripción completa del formato de cada archivo están en{' '}
          <a className="text-navy-700 underline" href="https://github.com/ChrisPeterkins/school-data-visualization" target="_blank" rel="noreferrer">GitHub</a>.
        </p>
      </Section>

      <Section id="privacy" title="Privacidad">
        <p>El sitio muestra solo cifras agregadas que el PDE ya publicó; no contiene datos de estudiantes individuales. No usa cookies de seguimiento. Los mosaicos del mapa se cargan desde OpenStreetMap.</p>
      </Section>

      <p className="text-sm text-stone-500">
        ¿Preguntas sobre una cifra concreta? Empiece por la <Link to="/state" className="text-navy-700 underline">vista estatal</Link> y luego la página de la escuela o el distrito, donde cada tabla muestra el año, el grupo y los estudiantes evaluados detrás de la cifra.
      </p>
    </div>
  );
}
