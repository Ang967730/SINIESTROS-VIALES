/* ============================================================
   ESTADISTICAS.JS - SISTEMA DE ANÁLISIS AVANZADO INTERACTIVO
   Versión final con distribución temporal interactiva
   ============================================================ */

// ============================================================
// CONFIGURACIÓN GLOBAL
// ============================================================
const MAIN_API_URL = "https://script.google.com/macros/s/AKfycbzLTG8Zo1ayJMapz6rHXK0mUrnLhs6Ar0uk_06DBqhxww0fySCUgZa_u0yubKCbV1deJA/exec";

let allIncidentsData = [];
let charts = {};
let filtroTemporalActivo = null;

// Variables para filtros cruzados interactivos
let filtrosActivos = {
  tipoSiniestro: null,
  causaSiniestro: null,
  tipoVialidad: null,
  temporal: null,
   municipio: null
};

// Mapeo de índices de columnas (según Apps Script)
const COLUMNAS = {
  MUNICIPIO: 0,
  FECHA_SINIESTRO: 1,
  DEPENDENCIA: 2,
  OTRA_DEPENDENCIA: 3,
  CORREO: 4,
  FUENTE_NOTICIA: 5,
  LINK_NOTICIA: 6,
  TIPO_SINIESTRO: 7,
  CAUSA_SINIESTRO: 8,
  USUARIO_1: 9,
  USUARIO_2: 10,
  TIPO_TRANSPORTE: 11,
  CONCESIONADO: 12,
  NO_ECONOMICO: 13,
  CONCESION: 14,
  MODALIDAD: 15,
  PLACA: 16,
  MARCA: 17,
  TIPO: 18,
  MOTOR: 19,
  SERIE: 20,
  MODELO: 21,
  TOTAL_USUARIOS: 22,
  TOTAL_FALLECIDOS: 23,
  CLASIFICACION_FALLECIDOS: 24,
  TIPO_VIALIDAD: 25,
  DIRECCION: 26,
  COORDENADAS: 27,
  ESTATUS_HECHOS: 28,
  SEGUIMIENTO: 29,
  DESCRIPCION: 30
};

// ============================================================
// SISTEMA DE FILTROS CRUZADOS INTERACTIVOS
// ============================================================
function aplicarFiltroCruzado(tipoFiltro, valor, nombreCompleto = null) {
  // Limpiar otros filtros del mismo tipo
  if (tipoFiltro !== 'temporal') {
    filtrosActivos.tipoSiniestro = null;
    filtrosActivos.causaSiniestro = null;
    filtrosActivos.tipoVialidad = null;
  }
  
  // Aplicar nuevo filtro
  filtrosActivos[tipoFiltro] = valor;
  
  // Mostrar indicador de filtro activo
  mostrarIndicadorFiltroCruzado(tipoFiltro, nombreCompleto || valor);
  
  // Actualizar todo el dashboard
  actualizarDashboardConFiltros();
  
  // Notificación
  mostrarNotificacion(`Filtro aplicado: ${nombreCompleto || valor}`, 'info', 3000);
}

function limpiarFiltrosCruzados() {
  filtrosActivos.tipoSiniestro = null;
  filtrosActivos.causaSiniestro = null;
  filtrosActivos.tipoVialidad = null;
  filtrosActivos.municipio = null;  // ⭐ AGREGAR ESTA LÍNEA
  
  // ⭐ NUEVO: Resetear el selector de municipio
  const selector = document.getElementById('filtroMunicipio');
  if (selector) {
    selector.value = '';
  }
  
  // Ocultar indicador
  const indicador = document.getElementById('filtrosCruzadosIndicador');
  if (indicador) indicador.style.display = 'none';
  
  // Actualizar dashboard
  actualizarDashboardConFiltros();
  
  mostrarNotificacion('Filtros eliminados - Mostrando todos los datos', 'success', 3000);
}

function mostrarIndicadorFiltroCruzado(tipoFiltro, valor) {
  let indicador = document.getElementById('filtrosCruzadosIndicador');
  
  if (!indicador) {
    // Crear indicador si no existe
    indicador = document.createElement('div');
    indicador.id = 'filtrosCruzadosIndicador';
    indicador.className = 'filtros-cruzados-indicador';
    
    // Buscar dónde insertarlo (después del filtro temporal si existe)
    const filtroTemporal = document.getElementById('filtroActivoIndicador');
    const container = filtroTemporal ? 
      filtroTemporal.parentElement : 
      document.querySelector('.temporal-distribution-section');
    
    if (container) {
      container.insertBefore(indicador, container.firstChild);
    }
  }
  
  const tipoNombres = {
    tipoSiniestro: 'Tipo de Siniestro',
    causaSiniestro: 'Causa',
    tipoVialidad: 'Tipo de Vialidad'
  };
  
  indicador.innerHTML = `
    <i class="fas fa-filter"></i>
    <span>Filtrando por ${tipoNombres[tipoFiltro]}: <strong>${valor}</strong></span>
    <button onclick="limpiarFiltrosCruzados()" class="btn-limpiar-filtro-cruzado">
      <i class="fas fa-times"></i> Limpiar
    </button>
  `;
  
  indicador.style.display = 'flex';
}

function actualizarDashboardConFiltros() {
  // ⭐ Actualizar TODOS los paneles
  actualizarPerfilSiniestros();
  actualizarAnalisisTemporal();  // NUEVO
  inicializarAnalisisCruzado();   // NUEVO
  
  // Actualizar título de la sección temporal
  actualizarTituloSeccionPerfil();
}

function actualizarTituloSeccionPerfil() {
  const tituloElement = document.querySelector('#perfilContent .temporal-header h4');
  if (!tituloElement) return;
  
  const hayFiltrosCruzados = filtrosActivos.tipoSiniestro || 
                            filtrosActivos.causaSiniestro || 
                            filtrosActivos.tipoVialidad;
  
  let textoTitulo = 'Distribución Temporal de Incidentes';
  
  if (hayFiltrosCruzados) {
    if (filtrosActivos.tipoSiniestro) {
      textoTitulo += ` - ${filtrosActivos.tipoSiniestro}`;
    } else if (filtrosActivos.causaSiniestro) {
      textoTitulo += ` - ${filtrosActivos.causaSiniestro}`;
    } else if (filtrosActivos.tipoVialidad) {
      textoTitulo += ` - ${filtrosActivos.tipoVialidad}`;
    }
  }
  
  tituloElement.innerHTML = `<i class="fas fa-chart-area"></i> ${textoTitulo}`;
}

// ============================================================
// SISTEMA DE FILTRADO TEMPORAL (MEJORADO)
// ============================================================
function obtenerDatosFiltrados() {
  let datos = allIncidentsData;
  
  // Aplicar filtro temporal si existe
  if (filtroTemporalActivo) {
    const { periodo, clave } = filtroTemporalActivo;
    
    datos = datos.filter(row => {
      const fechaStr = row[COLUMNAS.FECHA_SINIESTRO];
      if (!fechaStr) return false;
      
      let fecha = null;
      if (fechaStr.includes('/')) {
        const partes = fechaStr.split(' ')[0].split('/');
        if (partes.length === 3) {
          fecha = new Date(partes[2], partes[1] - 1, partes[0]);
        }
      } else if (fechaStr.includes('-')) {
        fecha = new Date(fechaStr.split(' ')[0]);
      }
      
      if (!fecha || isNaN(fecha)) return false;
      
      let claveRegistro = '';
      if (periodo === 'mensual') {
        claveRegistro = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
      } else if (periodo === 'trimestral') {
        const trimestre = Math.floor(fecha.getMonth() / 3) + 1;
        claveRegistro = `${fecha.getFullYear()}-T${trimestre}`;
      } else if (periodo === 'anual') {
        claveRegistro = `${fecha.getFullYear()}`;
      }
      
      return claveRegistro === clave;
    });
  }
  
  // ⭐ NUEVO: Aplicar filtro de municipio
  if (filtrosActivos.municipio) {
    datos = datos.filter(row => 
      (row[COLUMNAS.MUNICIPIO] || 'Desconocido') === filtrosActivos.municipio
    );
  }
  
  // Aplicar filtros cruzados
  if (filtrosActivos.tipoSiniestro) {
    datos = datos.filter(row => 
      (row[COLUMNAS.TIPO_SINIESTRO] || 'No especificado') === filtrosActivos.tipoSiniestro
    );
  }
  
  if (filtrosActivos.causaSiniestro) {
    datos = datos.filter(row => 
      (row[COLUMNAS.CAUSA_SINIESTRO] || 'No especificada') === filtrosActivos.causaSiniestro
    );
  }
  
  if (filtrosActivos.tipoVialidad) {
    datos = datos.filter(row => 
      (row[COLUMNAS.TIPO_VIALIDAD] || 'No especificada') === filtrosActivos.tipoVialidad
    );
  }
  
  return datos;
}

function aplicarFiltroTemporal(periodo, clave, label) {
  filtroTemporalActivo = { periodo, clave, label };
  
  document.getElementById('filtroActivoIndicador').style.display = 'flex';
  document.getElementById('textoFiltroActivo').textContent = `Filtrando por: ${label}`;
  document.getElementById('btnLimpiarFiltro').style.display = 'flex';
  
  actualizarGraficasPerfil();
  mostrarNotificacion(`Filtro aplicado: ${label}`, 'info', 3000);
}

function limpiarFiltroTemporal() {
  filtroTemporalActivo = null;
  
  document.getElementById('filtroActivoIndicador').style.display = 'none';
  document.getElementById('btnLimpiarFiltro').style.display = 'none';
  
  actualizarGraficasPerfil();
  mostrarNotificacion('Filtro eliminado - Mostrando todos los datos', 'success', 3000);
}

function actualizarGraficasPerfil() {
  crearGraficaPersonasInvolucradas();
  crearGraficaTiposSiniestro();
  crearGraficasCausas();
  crearGraficasClasificacionFallecidos();
  crearGraficasTiposVialidad();
}

window.limpiarFiltroTemporal = limpiarFiltroTemporal;
window.limpiarFiltrosCruzados = limpiarFiltrosCruzados;
window.aplicarFiltroCruzado = aplicarFiltroCruzado;

// ============================================================
// CLASE: ANALIZADOR TEMPORAL
// ============================================================
class AnalizadorTemporal {
  constructor(datos) {
    this.datos = datos;
  }

  analizarPorDiaSemana() {
    const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const distribucion = new Array(7).fill(0);
    
    this.datos.forEach(row => {
      const fechaStr = row[COLUMNAS.FECHA_SINIESTRO];
      if (!fechaStr) return;
      
      let fecha = null;
      if (fechaStr.includes('/')) {
        const partes = fechaStr.split(' ')[0].split('/');
        if (partes.length === 3) {
          fecha = new Date(partes[2], partes[1] - 1, partes[0]);
        }
      } else if (fechaStr.includes('-')) {
        fecha = new Date(fechaStr.split(' ')[0]);
      }
      
      if (fecha && !isNaN(fecha)) {
        distribucion[fecha.getDay()]++;
      }
    });
    
    return dias.map((dia, idx) => ({ 
      dia, 
      cantidad: Math.round(distribucion[idx]),
      porcentaje: distribucion.reduce((a, b) => a + b, 0) > 0 
        ? ((distribucion[idx] / distribucion.reduce((a, b) => a + b, 0)) * 100).toFixed(1)
        : 0
    }));
  }

  calcularTendencia(meses = 6) {
    const ahora = new Date();
    const fechaLimite = new Date(ahora.getFullYear(), ahora.getMonth() - meses, 1);
    
    const recientes = this.datos.filter(row => {
      const fechaStr = row[COLUMNAS.FECHA_SINIESTRO];
      if (!fechaStr) return false;
      const fecha = new Date(fechaStr.split(' ')[0]);
      return fecha >= fechaLimite && !isNaN(fecha);
    });
    
    const tendenciaMensual = {};
    recientes.forEach(row => {
      const fechaStr = row[COLUMNAS.FECHA_SINIESTRO];
      const fecha = new Date(fechaStr.split(' ')[0]);
      if (!isNaN(fecha)) {
        const mes = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
        tendenciaMensual[mes] = (tendenciaMensual[mes] || 0) + 1;
      }
    });
    
    const mesesOrdenados = Object.keys(tendenciaMensual).sort();
    if (mesesOrdenados.length < 2) return { tipo: 'Insuficiente', datos: tendenciaMensual };
    
    const primerMes = tendenciaMensual[mesesOrdenados[0]];
    const ultimoMes = tendenciaMensual[mesesOrdenados[mesesOrdenados.length - 1]];
    const diferencia = ultimoMes - primerMes;
    const porcentajeCambio = primerMes > 0 ? ((diferencia / primerMes) * 100).toFixed(1) : 0;
    
    let tipo = 'Estable';
    if (diferencia > primerMes * 0.2) tipo = 'Creciente';
    else if (diferencia < -primerMes * 0.2) tipo = 'Decreciente';
    
    return { tipo, porcentajeCambio, datos: tendenciaMensual, mesesAnalizados: mesesOrdenados.length };
  }

  getDiaMasPeligroso() {
    const porDia = this.analizarPorDiaSemana();
    return porDia.reduce((max, dia) => dia.cantidad > max.cantidad ? dia : max, porDia[0]);
  }
}

// ============================================================
// FUNCIONES DE UTILIDAD
// ============================================================
function validarCoordenadas(coordStr) {
  if (!coordStr || typeof coordStr !== 'string') return null;
  
  const parts = coordStr.split(",");
  if (parts.length !== 2) return null;
  
  const lat = parseFloat(parts[0].trim());
  const lng = parseFloat(parts[1].trim());
  
  // Límites expandidos para cubrir todo el estado de Chiapas
  if (isNaN(lat) || isNaN(lng) || 
      lat < 14.2 || lat > 17.8 ||     // Latitud: desde la frontera con Guatemala hasta Tabasco
      lng < -94.8 || lng > -90.2) {   // Longitud: desde Oaxaca/Veracruz hasta Guatemala
    return null;
  }
  
  return { lat, lng };
}

function calcularDistanciaKm(coords1, coords2) {
  const R = 6371;
  const dLat = (coords2.lat - coords1.lat) * Math.PI / 180;
  const dLon = (coords2.lng - coords1.lng) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(coords1.lat * Math.PI / 180) * 
            Math.cos(coords2.lat * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function analizarVialidadesCluster(incidentes) {
  const vialidades = {};
  
  // Contar tipos de vialidad en el cluster
  incidentes.forEach(incidente => {
    const vialidad = incidente[COLUMNAS.TIPO_VIALIDAD] || 'No especificada';
    vialidades[vialidad] = (vialidades[vialidad] || 0) + 1;
  });
  
  // Ordenar por frecuencia
  const vialidadesOrdenadas = Object.entries(vialidades)
    .sort((a, b) => b[1] - a[1]);
  
  if (vialidadesOrdenadas.length === 0) {
    return {
      principal: 'No especificada',
      porcentaje: 0,
      todas: []
    };
  }
  
  const [vialidadPrincipal, cantidad] = vialidadesOrdenadas[0];
  const porcentaje = ((cantidad / incidentes.length) * 100).toFixed(0);
  
  return {
    principal: vialidadPrincipal,
    porcentaje: parseInt(porcentaje),
    cantidad: cantidad,
    total: incidentes.length,
    todas: vialidadesOrdenadas.slice(0, 3) // Top 3 vialidades
  };
}

function identificarZonasPeligrosas() {
  const clusters = [];
  const radioKm = 0.5;
  const minimoIncidentes = 3;
  const procesados = new Set();
  
  // ⭐ CAMBIO: Usar datos filtrados
  const datosFiltrados = obtenerDatosFiltrados();
  
  datosFiltrados.forEach((incident, idx) => {
    if (procesados.has(idx)) return;
    const coords1 = validarCoordenadas(incident[COLUMNAS.COORDENADAS]);
    if (!coords1) return;
    
    const cluster = { centro: coords1, incidentes: [incident], indices: [idx] };
    
    datosFiltrados.forEach((otro, otroIdx) => {
      if (idx === otroIdx || procesados.has(otroIdx)) return;
      const coords2 = validarCoordenadas(otro[COLUMNAS.COORDENADAS]);
      if (!coords2) return;
      const distancia = calcularDistanciaKm(coords1, coords2);
      if (distancia <= radioKm) {
        cluster.incidentes.push(otro);
        cluster.indices.push(otroIdx);
        procesados.add(otroIdx);
      }
    });
    
    procesados.add(idx);
    
    if (cluster.incidentes.length >= minimoIncidentes) {
      cluster.peligrosidad = calcularNivelPeligrosidad(cluster.incidentes);
      cluster.totalFallecidos = cluster.incidentes.reduce((sum, inc) => 
        sum + parseInt(inc[COLUMNAS.TOTAL_FALLECIDOS] || 0), 0
      );
      cluster.municipio = cluster.incidentes[0][COLUMNAS.MUNICIPIO] || 'Desconocido';
      
      // Analizar vialidades del cluster
      cluster.vialidadInfo = analizarVialidadesCluster(cluster.incidentes);
      
      clusters.push(cluster);
    }
  });
  
  return clusters.sort((a, b) => b.incidentes.length - a.incidentes.length);
}

function calcularNivelPeligrosidad(incidentes) {
  const fallecidos = incidentes.reduce((sum, inc) => 
    sum + parseInt(inc[COLUMNAS.TOTAL_FALLECIDOS] || 0), 0
  );
  const score = incidentes.length + (fallecidos * 3);
  if (score >= 20) return 'Crítica';
  if (score >= 10) return 'Alta';
  if (score >= 5) return 'Media';
  return 'Baja';
}

function contarPersonasInvolucradas(datos) {
  const categorias = [
    'Automovilista',
    'Motociclista',
    'Chofer de transporte público',
    'Chofer de vehículo pesado',
    'Ciclista',
    'Peatón',
    'Otro'
  ];
  
  const conteos = {};
  categorias.forEach(cat => conteos[cat] = 0);
  
  datos.forEach(row => {
    const usuario1 = row[COLUMNAS.USUARIO_1]?.trim();
    const usuario2 = row[COLUMNAS.USUARIO_2]?.trim();
    
    [usuario1, usuario2].forEach(usuario => {
      if (usuario && usuario !== '' && usuario !== 'N/A') {
        const categoriaEncontrada = categorias.find(cat => 
          usuario.toLowerCase().includes(cat.toLowerCase()) ||
          cat.toLowerCase().includes(usuario.toLowerCase())
        );
        
        if (categoriaEncontrada) {
          conteos[categoriaEncontrada]++;
        } else if (usuario.toLowerCase() !== 'no aplica') {
          conteos['Otro']++;
        }
      }
    });
  });
  
  return {
    conteos,
    total: Object.values(conteos).reduce((sum, count) => sum + count, 0),
    categorias
  };
}

// ============================================================
// NOTIFICACIONES
// ============================================================
function mostrarNotificacion(mensaje, tipo = 'info', duracion = 5000) {
  const notification = document.createElement('div');
  notification.className = `notification ${tipo}`;
  notification.innerHTML = `
    <div>${mensaje}</div>
    <button class="close-btn" onclick="this.parentElement.remove()">&times;</button>
  `;
  document.body.appendChild(notification);
  setTimeout(() => {
    if (document.body.contains(notification)) {
      notification.style.opacity = '0';
      setTimeout(() => notification.remove(), 300);
    }
  }, duracion);
}

function mostrarProgreso(texto, subtexto = '') {
  let progressDiv = document.getElementById('progressIndicator');
  if (!progressDiv) {
    progressDiv = document.createElement('div');
    progressDiv.id = 'progressIndicator';
    progressDiv.className = 'progress-indicator';
    progressDiv.innerHTML = `
      <div class="progress-spinner"></div>
      <div class="progress-text"></div>
      <div class="progress-subtext"></div>
    `;
    document.body.appendChild(progressDiv);
  }
  progressDiv.querySelector('.progress-text').textContent = texto;
  progressDiv.querySelector('.progress-subtext').textContent = subtexto;
  progressDiv.classList.add('show');
}

function ocultarProgreso() {
  const progressDiv = document.getElementById('progressIndicator');
  if (progressDiv) progressDiv.classList.remove('show');
}

// ============================================================
// CARGA DE DATOS
// ============================================================
async function cargarDatos() {
  try {
    mostrarProgreso('Cargando datos de incidentes...', 'Obteniendo información del servidor');
    
    const response = await fetch(MAIN_API_URL);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
    const data = await response.json();
    
    console.log('=== DEBUG DATOS RECIBIDOS ===');
    console.log('Total registros:', data.length);
    
    allIncidentsData = data.filter(row => validarCoordenadas(row[COLUMNAS.COORDENADAS]) !== null);
    
    console.log(`✅ Datos cargados: ${allIncidentsData.length} incidentes válidos`);
    
    // ⭐ AGREGAR ESTA LÍNEA
    generarSelectorMunicipios();
    actualizarEstadisticasFiltro();
    
    actualizarResumenGeneral();
    actualizarAnalisisTemporal();
    actualizarPerfilSiniestros();
    inicializarAnalisisCruzado();
    
    ocultarProgreso();
    mostrarNotificacion(`✅ ${allIncidentsData.length} incidentes cargados correctamente`, 'success', 3000);
    
  } catch (error) {
    console.error('Error al cargar datos:', error);
    ocultarProgreso();
    mostrarNotificacion('❌ Error al cargar los datos. Reintentando...', 'error');
    setTimeout(cargarDatos, 3000);
  }
}

// ============================================================
// RESUMEN GENERAL (CORREGIDO)
// ============================================================
function actualizarResumenGeneral() {
  // ⭐ Usar datos filtrados si hay filtro de municipio
  const datosParaResumen = filtrosActivos.municipio ? obtenerDatosFiltrados() : allIncidentsData;
  
  const totalIncidentes = datosParaResumen.length;
  const totalFallecidos = datosParaResumen.reduce((sum, row) => 
    sum + parseInt(row[COLUMNAS.TOTAL_FALLECIDOS] || 0), 0
  );
  
  const { total: totalInvolucrados } = contarPersonasInvolucradas(datosParaResumen);
  const tasaLetalidad = totalInvolucrados > 0 ? ((totalFallecidos / totalInvolucrados) * 100).toFixed(1) : 0;
  
  document.getElementById('totalIncidentes').textContent = totalIncidentes.toLocaleString();
  document.getElementById('totalFallecidosGeneral').textContent = totalFallecidos.toLocaleString();
  document.getElementById('totalInvolucrados').textContent = totalInvolucrados.toLocaleString();
  document.getElementById('tasaLetalidadGeneral').textContent = tasaLetalidad + '%';
  
  // ⭐ NUEVO: Agregar indicador visual si hay filtro
  const resumenSection = document.querySelector('.resumen-general h2');
  if (resumenSection && filtrosActivos.municipio) {
    resumenSection.innerHTML = `
      <i class="fas fa-chart-bar"></i> 
      Resumen General 
      <span style="font-size: 0.6em; color: #4caf50; margin-left: 10px;">
        📍 ${filtrosActivos.municipio}
      </span>
    `;
  } else if (resumenSection) {
    resumenSection.innerHTML = `<i class="fas fa-chart-bar"></i> Resumen General`;
  }
}

// ============================================================
// ANÁLISIS TEMPORAL Y GEOESPACIAL (ACTUALIZADO CON FILTROS)
// ============================================================
function actualizarAnalisisTemporal() {
  // ⭐ CAMBIO: Usar datos filtrados en lugar de todos los datos
  const datosFiltrados = obtenerDatosFiltrados();
  const analizador = new AnalizadorTemporal(datosFiltrados);
  
  // Municipio más peligroso
  const municipios = {};
  datosFiltrados.forEach(row => {
    const municipio = row[COLUMNAS.MUNICIPIO] || 'Desconocido';
    municipios[municipio] = (municipios[municipio] || 0) + 1;
  });
  
  if (Object.keys(municipios).length > 0) {
    const municipioPeligroso = Object.entries(municipios).sort((a, b) => b[1] - a[1])[0];
    document.getElementById('municipioPeligroso').textContent = municipioPeligroso[0].substring(0, 20);
    document.getElementById('municipioDetalle').textContent = `${municipioPeligroso[1]} incidentes`;
  } else {
    document.getElementById('municipioPeligroso').textContent = '---';
    document.getElementById('municipioDetalle').textContent = 'Sin datos';
  }
  
  // Día más peligroso
  const diaPeligroso = analizador.getDiaMasPeligroso();
  document.getElementById('diaPeligroso').textContent = diaPeligroso.dia;
  document.getElementById('diaDetalle').textContent = `${diaPeligroso.cantidad} incidentes (${diaPeligroso.porcentaje}%)`;
  
  // Zonas críticas
  const zonas = identificarZonasPeligrosas();
  const zonasCriticas = zonas.filter(z => z.peligrosidad === 'Crítica' || z.peligrosidad === 'Alta');
  document.getElementById('zonasCriticas').textContent = zonasCriticas.length;
  const criticas = zonas.filter(z => z.peligrosidad === 'Crítica').length;
  const altas = zonas.filter(z => z.peligrosidad === 'Alta').length;
  document.getElementById('zonasDetalle').textContent = `${criticas} críticas, ${altas} altas`;
  
  // Tendencia
  const tendencia = analizador.calcularTendencia(6);
  const iconos = { 'Creciente': '📈', 'Decreciente': '📉', 'Estable': '➡️', 'Insuficiente': '❓' };
  document.getElementById('tendencia').textContent = iconos[tendencia.tipo] || '---';
  if (tendencia.tipo === 'Insuficiente') {
    document.getElementById('tendenciaDetalle').textContent = 'Datos insuficientes';
  } else {
    const signo = tendencia.porcentajeCambio >= 0 ? '+' : '';
    document.getElementById('tendenciaDetalle').textContent = `${signo}${tendencia.porcentajeCambio}% (${tendencia.mesesAnalizados} meses)`;
  }
  
  actualizarListaZonasPeligrosas(zonas);
  crearGraficaDias(analizador);
  crearGraficaMunicipios();
}

function actualizarListaZonasPeligrosas(zonas) {
  const container = document.getElementById('zonasPeligrosasContainer');
  if (!container) return;
  
  if (zonas.length === 0) {
    container.innerHTML = '<p class="empty-state">No se identificaron zonas peligrosas.</p>';
    return;
  }
  
  // Diversificar por municipio - máximo 2 zonas por municipio
  const zonasDiversificadas = [];
  const municipiosVistos = {};
  
  for (const zona of zonas) {
    const municipio = zona.municipio;
    
    if (!municipiosVistos[municipio]) {
      municipiosVistos[municipio] = 0;
    }
    
    if (municipiosVistos[municipio] < 2 && zonasDiversificadas.length < 5) {
      zonasDiversificadas.push(zona);
      municipiosVistos[municipio]++;
    }
    
    if (zonasDiversificadas.length >= 5) break;
  }
  
  const colorBadge = {
    'Crítica': '#8B0000',
    'Alta': '#DC143C',
    'Media': '#FF8C00',
    'Baja': '#FFD700'
  };
  
  container.innerHTML = zonasDiversificadas.map((zona, index) => `
    <div class="danger-zone-item-enhanced">
      <div class="zone-rank">#${index + 1}</div>
      <div class="zone-info-detailed">
        <div class="zone-header">
          <span class="zone-municipio">${zona.municipio}</span>
          <span class="zone-badge" style="background: ${colorBadge[zona.peligrosidad]};">${zona.peligrosidad}</span>
        </div>
        
        <!-- Nueva sección de vialidad -->
        <div class="zone-vialidad">
          <span class="vialidad-label">
            <i class="fas fa-road"></i> 
            ${zona.vialidadInfo.principal}
          </span>
          <span class="vialidad-percentage">${zona.vialidadInfo.porcentaje}%</span>
        </div>
        
        <div class="zone-stats">
          <span><i class="fas fa-exclamation-circle"></i> ${zona.incidentes.length} incidentes</span>
          <span><i class="fas fa-skull"></i> ${zona.totalFallecidos} fallecidos</span>
        </div>
        
        <!-- Información adicional expandible -->
        <div class="zone-details">
          <small class="zone-vialidad-detail">
            ${zona.vialidadInfo.cantidad}/${zona.vialidadInfo.total} incidentes en este tipo de vialidad
          </small>
        </div>
      </div>
    </div>
  `).join('');
}

// ============================================================
// PERFIL DE SINIESTROS (CORREGIDO)
// ============================================================
function actualizarPerfilSiniestros() {
  const datosFiltrados = obtenerDatosFiltrados();
  
  const totalFallecidos = datosFiltrados.reduce((sum, row) => 
    sum + parseInt(row[COLUMNAS.TOTAL_FALLECIDOS] || 0), 0
  );
  
  // Usar la misma lógica para contar involucrados
  const { total: totalInvolucrados } = contarPersonasInvolucradas(datosFiltrados);
  
  const promedioInvolucrados = datosFiltrados.length > 0 ? (totalInvolucrados / datosFiltrados.length).toFixed(1) : 0;
  const tasaLetalidad = totalInvolucrados > 0 ? ((totalFallecidos / totalInvolucrados) * 100).toFixed(1) : 0;
  
  document.getElementById('totalFallecidos').textContent = totalFallecidos;
  document.getElementById('promedioInvolucrados').textContent = promedioInvolucrados;
  document.getElementById('tasaLetalidad').textContent = tasaLetalidad + '%';
  
  // Debug para verificar consistencia
  console.log('=== VERIFICACIÓN PERFIL SINIESTROS ===');
  console.log('Datos filtrados:', datosFiltrados.length, 'incidentes');
  console.log('Total involucrados (Perfil):', totalInvolucrados);
  console.log('Total fallecidos (Perfil):', totalFallecidos);
  console.log('Promedio involucrados por incidente:', promedioInvolucrados);
  console.log('Tasa de letalidad:', tasaLetalidad + '%');
  
  // Causa principal
  const causas = {};
  datosFiltrados.forEach(row => {
    const causa = row[COLUMNAS.CAUSA_SINIESTRO] || 'No especificada';
    causas[causa] = (causas[causa] || 0) + 1;
  });
  
  if (Object.keys(causas).length > 0) {
    const causaPrincipal = Object.entries(causas).sort((a, b) => b[1] - a[1])[0];
    document.getElementById('causaPrincipal').textContent = causaPrincipal[0].substring(0, 15);
    document.getElementById('causaPrincipalCount').textContent = `${causaPrincipal[1]} casos`;
  } else {
    document.getElementById('causaPrincipal').textContent = '---';
    document.getElementById('causaPrincipalCount').textContent = '0 casos';
  }
  
  crearDistribucionTemporal();
  crearGraficaPersonasInvolucradas();
  crearGraficaTiposSiniestro();
  crearGraficasCausas();
  crearGraficasClasificacionFallecidos();
  crearGraficasTiposVialidad();
}

// ============================================================
// DISTRIBUCIÓN TEMPORAL (INTERACTIVA Y MEJORADA)
// ============================================================
function crearDistribucionTemporal() {
  actualizarDistribucionTemporal();
}

function actualizarDistribucionTemporal() {
  const periodo = document.getElementById('periodoDistribucion')?.value || 'mensual';
  const ctx = document.getElementById('chartDistribucionTemporal');
  if (!ctx) return;
  
  const datosAgrupados = agruparDatosPorPeriodo(periodo);
  
  if (charts.distribucionTemporal) charts.distribucionTemporal.destroy();
  
  // Detectar si hay filtros cruzados activos
  const hayFiltrosCruzados = filtrosActivos.tipoSiniestro || 
                            filtrosActivos.causaSiniestro || 
                            filtrosActivos.tipoVialidad;
  
  // Título dinámico según filtros activos
  let tituloGrafica = 'Distribución Temporal de Incidentes';
  if (hayFiltrosCruzados) {
    if (filtrosActivos.tipoSiniestro) {
      tituloGrafica += ` - ${filtrosActivos.tipoSiniestro}`;
    } else if (filtrosActivos.causaSiniestro) {
      tituloGrafica += ` - ${filtrosActivos.causaSiniestro}`;
    } else if (filtrosActivos.tipoVialidad) {
      tituloGrafica += ` - ${filtrosActivos.tipoVialidad}`;
    }
  }
  
  charts.distribucionTemporal = new Chart(ctx, {
    type: 'line',
    data: {
      labels: datosAgrupados.labels,
      datasets: [
        {
          label: 'Total de Accidentes',
          data: datosAgrupados.accidentes,
          borderColor: hayFiltrosCruzados ? '#1976d2' : '#1976d2',
          backgroundColor: hayFiltrosCruzados ? 'rgba(25, 118, 210, 0.15)' : 'rgba(25, 118, 210, 0.1)',
          borderWidth: hayFiltrosCruzados ? 4 : 3,
          fill: true,
          tension: 0.4,
          pointRadius: hayFiltrosCruzados ? 6 : 5,
          pointHoverRadius: hayFiltrosCruzados ? 8 : 7,
          pointBackgroundColor: hayFiltrosCruzados ? '#1976d2' : '#1976d2'
        },
        {
          label: 'Total de Fallecidos',
          data: datosAgrupados.fallecidos,
          borderColor: hayFiltrosCruzados ? '#f44336' : '#f44336',
          backgroundColor: hayFiltrosCruzados ? 'rgba(244, 67, 54, 0.15)' : 'rgba(244, 67, 54, 0.1)',
          borderWidth: hayFiltrosCruzados ? 4 : 3,
          fill: true,
          tension: 0.4,
          pointRadius: hayFiltrosCruzados ? 6 : 5,
          pointHoverRadius: hayFiltrosCruzados ? 8 : 7,
          pointBackgroundColor: hayFiltrosCruzados ? '#f44336' : '#f44336'
        },
        {
          label: 'Total de Usuarios Involucrados',
          data: datosAgrupados.involucrados,
          borderColor: hayFiltrosCruzados ? '#4caf50' : '#4caf50',
          backgroundColor: hayFiltrosCruzados ? 'rgba(76, 175, 80, 0.15)' : 'rgba(76, 175, 80, 0.1)',
          borderWidth: hayFiltrosCruzados ? 4 : 3,
          fill: true,
          tension: 0.4,
          pointRadius: hayFiltrosCruzados ? 6 : 5,
          pointHoverRadius: hayFiltrosCruzados ? 8 : 7,
          pointBackgroundColor: hayFiltrosCruzados ? '#4caf50' : '#4caf50'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      onClick: (event, elements) => {
        if (elements.length > 0) {
          const elementIndex = elements[0].index;
          const clave = datosAgrupados.claves[elementIndex];
          const label = datosAgrupados.labels[elementIndex];
          aplicarFiltroTemporal(periodo, clave, label);
        }
      },
      plugins: {
        legend: {
          position: 'top',
          labels: {
            usePointStyle: true,
            padding: 15,
            font: { size: 12, weight: '600' }
          }
        },
        title: {
          display: hayFiltrosCruzados,
          text: hayFiltrosCruzados ? `Filtrado: ${tituloGrafica.split(' - ')[1]}` : '',
          font: { size: 14, weight: 'bold' },
          color: '#1976d2',
          padding: { bottom: 10 }
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          backgroundColor: 'rgba(0,0,0,0.8)',
          padding: 12,
          titleFont: { size: 14, weight: 'bold' },
          bodyFont: { size: 13 },
          callbacks: {
            label: function(context) {
              let label = context.dataset.label || '';
              if (label) label += ': ';
              label += context.parsed.y.toLocaleString();
              return label;
            },
            afterBody: function() {
              if (hayFiltrosCruzados) {
                return ['', '📊 Datos filtrados según selección'];
              }
              return '';
            },
            footer: function() {
              return 'Haz clic en un punto para filtrar temporalmente';
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { precision: 0, font: { size: 11 } },
          grid: { color: 'rgba(0,0,0,0.05)' }
        },
        x: {
          ticks: { font: { size: 11 } },
          grid: { display: false }
        }
      },
      interaction: {
        mode: 'nearest',
        axis: 'x',
        intersect: false
      }
    }
  });
  
  // Debug para verificar datos filtrados
  console.log('=== DISTRIBUCIÓN TEMPORAL ===');
  console.log('Período:', periodo);
  console.log('Filtros cruzados activos:', hayFiltrosCruzados);
  console.log('Datos agrupados:', datosAgrupados);
  if (hayFiltrosCruzados) {
    console.log('Filtros activos:', filtrosActivos);
  }
}

function agruparDatosPorPeriodo(periodo) {
  const grupos = {};
  
  // CAMBIO PRINCIPAL: Usar datos filtrados en lugar de todos los datos
  const datosFiltrados = obtenerDatosFiltrados();
  
  datosFiltrados.forEach(row => {
    const fechaStr = row[COLUMNAS.FECHA_SINIESTRO];
    if (!fechaStr) return;
    
    let fecha = null;
    if (fechaStr.includes('/')) {
      const partes = fechaStr.split(' ')[0].split('/');
      if (partes.length === 3) {
        fecha = new Date(partes[2], partes[1] - 1, partes[0]);
      }
    } else if (fechaStr.includes('-')) {
      fecha = new Date(fechaStr.split(' ')[0]);
    }
    
    if (!fecha || isNaN(fecha)) return;
    
    let clave = '';
    if (periodo === 'mensual') {
      clave = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
    } else if (periodo === 'trimestral') {
      const trimestre = Math.floor(fecha.getMonth() / 3) + 1;
      clave = `${fecha.getFullYear()}-T${trimestre}`;
    } else if (periodo === 'anual') {
      clave = `${fecha.getFullYear()}`;
    }
    
    if (!grupos[clave]) {
      grupos[clave] = { accidentes: 0, fallecidos: 0, involucrados: 0 };
    }
    
    grupos[clave].accidentes++;
    grupos[clave].fallecidos += parseInt(row[COLUMNAS.TOTAL_FALLECIDOS] || 0);
    
    // MEJORADO: Usar el mismo conteo que las otras gráficas
    const usuario1 = row[COLUMNAS.USUARIO_1]?.trim();
    const usuario2 = row[COLUMNAS.USUARIO_2]?.trim();
    
    [usuario1, usuario2].forEach(usuario => {
      if (usuario && usuario !== '' && usuario !== 'N/A' && usuario.toLowerCase() !== 'no aplica') {
        grupos[clave].involucrados++;
      }
    });
  });
  
  const clavesOrdenadas = Object.keys(grupos).sort();
  
  const labels = clavesOrdenadas.map(clave => {
    if (periodo === 'mensual') {
      const [año, mes] = clave.split('-');
      const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      return `${meses[parseInt(mes) - 1]} ${año}`;
    } else if (periodo === 'trimestral') {
      return clave.replace('-T', ' - Trimestre ');
    } else {
      return clave;
    }
  });
  
  return {
    labels,
    claves: clavesOrdenadas,
    accidentes: clavesOrdenadas.map(c => grupos[c].accidentes),
    fallecidos: clavesOrdenadas.map(c => grupos[c].fallecidos),
    involucrados: clavesOrdenadas.map(c => grupos[c].involucrados)
  };
}

// ============================================================
// GRÁFICAS INTERACTIVAS
// ============================================================

// PERSONAS INVOLUCRADAS
function crearGraficaPersonasInvolucradas() {
  const ctx = document.getElementById('chartPersonasInvolucradas');
  if (!ctx) return;
  
  const datosFiltrados = obtenerDatosFiltrados();
  
  const categorias = [
    'Automovilista',
    'Motociclista',
    'Chofer de transporte público',
    'Chofer de vehículo pesado',
    'Ciclista',
    'Peatón',
    'Otro'
  ];
  
  const conteos = {};
  categorias.forEach(cat => conteos[cat] = 0);
  
  datosFiltrados.forEach(row => {
    const usuario1 = row[COLUMNAS.USUARIO_1]?.trim();
    const usuario2 = row[COLUMNAS.USUARIO_2]?.trim();
    
    [usuario1, usuario2].forEach(usuario => {
      if (usuario && usuario !== '' && usuario !== 'N/A') {
        const categoriaEncontrada = categorias.find(cat => 
          usuario.toLowerCase().includes(cat.toLowerCase()) ||
          cat.toLowerCase().includes(usuario.toLowerCase())
        );
        
        if (categoriaEncontrada) {
          conteos[categoriaEncontrada]++;
        } else if (usuario.toLowerCase() !== 'no aplica') {
          conteos['Otro']++;
        }
      }
    });
  });
  
  const datos = categorias.map(cat => conteos[cat]);
  const total = datos.reduce((a, b) => a + b, 0);
  
  if (charts.personasInvolucradas) charts.personasInvolucradas.destroy();
  
  charts.personasInvolucradas = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: categorias,
      datasets: [{
        label: 'Número de Personas',
        data: datos,
        backgroundColor: [
          'rgba(25, 118, 210, 0.8)',
          'rgba(244, 67, 54, 0.8)',
          'rgba(76, 175, 80, 0.8)',
          'rgba(255, 152, 0, 0.8)',
          'rgba(156, 39, 176, 0.8)',
          'rgba(255, 193, 7, 0.8)',
          'rgba(158, 158, 158, 0.8)'
        ],
        borderColor: '#ffffff',
        borderWidth: 3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            padding: 15,
            font: { size: 12, weight: '600' },
            generateLabels: function(chart) {
              const data = chart.data;
              if (data.labels.length && data.datasets.length) {
                return data.labels.map((label, i) => {
                  return {
                    text: label,
                    fillStyle: data.datasets[0].backgroundColor[i],
                    hidden: false,
                    index: i
                  };
                });
              }
              return [];
            }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0,0,0,0.8)',
          padding: 12,
          callbacks: {
            label: function(context) {
              const value = context.parsed;
              const porcentaje = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
              return `${context.label}: ${value} personas (${porcentaje}%)`;
            }
          }
        },
        title: {
          display: true,
          text: `Total: ${total.toLocaleString()} personas`,
          font: { size: 14, weight: 'bold' },
          color: '#1976d2',
          padding: { bottom: 15 }
        }
      }
    }
  });
}

// TIPOS DE SINIESTRO - INTERACTIVA
function crearGraficaTiposSiniestro() {
  const ctx = document.getElementById('chartTiposSiniestro');
  if (!ctx) return;
  
  const datosFiltrados = obtenerDatosFiltrados();
  
  const tipos = {};
  datosFiltrados.forEach(row => {
    const tipo = row[COLUMNAS.TIPO_SINIESTRO] || 'No especificado';
    tipos[tipo] = (tipos[tipo] || 0) + 1;
  });
  
  const sortedTipos = Object.entries(tipos).sort((a, b) => b[1] - a[1]);
  if (charts.tiposSiniestro) charts.tiposSiniestro.destroy();
  
  charts.tiposSiniestro = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: sortedTipos.map(t => t[0]),
      datasets: [{
        label: 'Cantidad',
        data: sortedTipos.map(t => t[1]),
        backgroundColor: sortedTipos.map((_, index) => 
          filtrosActivos.tipoSiniestro === sortedTipos[index][0] ? 
          'rgba(25, 118, 210, 0.8)' :
          [
            'rgba(255, 99, 132, 0.8)',
            'rgba(54, 162, 235, 0.8)', 
            'rgba(255, 206, 86, 0.8)',
            'rgba(75, 192, 192, 0.8)',
            'rgba(153, 102, 255, 0.8)',
            'rgba(255, 159, 64, 0.8)'
          ][index % 6]
        ),
        borderColor: sortedTipos.map((_, index) => 
          filtrosActivos.tipoSiniestro === sortedTipos[index][0] ? 
          'rgba(25, 118, 210, 1)' :
          [
            'rgba(255, 99, 132, 1)',
            'rgba(54, 162, 235, 1)',
            'rgba(255, 206, 86, 1)', 
            'rgba(75, 192, 192, 1)',
            'rgba(153, 102, 255, 1)',
            'rgba(255, 159, 64, 1)'
          ][index % 6]
        ),
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      indexAxis: 'y',
      onClick: (event, elements) => {
        if (elements.length > 0) {
          const elementIndex = elements[0].index;
          const tipoSiniestro = sortedTipos[elementIndex][0];
          
          if (filtrosActivos.tipoSiniestro === tipoSiniestro) {
            limpiarFiltrosCruzados();
          } else {
            aplicarFiltroCruzado('tipoSiniestro', tipoSiniestro);
          }
        }
      },
      plugins: { 
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(0,0,0,0.8)',
          padding: 12,
          callbacks: {
            title: function(context) {
              return context[0].label;
            },
            label: function(context) {
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const porcentaje = ((context.parsed.x / total) * 100).toFixed(1);
              return `${context.parsed.x} incidentes (${porcentaje}%)`;
            },
            footer: function() {
              return 'Haz clic para filtrar';
            }
          }
        }
      },
      scales: {
        x: { 
          beginAtZero: true,
          ticks: { precision: 0 }
        },
        y: {
          ticks: { 
            font: { size: 11 },
            maxRotation: 0,
            callback: function(value, index) {
              const label = this.getLabelForValue(value);
              return label.length > 25 ? label.substring(0, 22) + '...' : label;
            }
          }
        }
      }
    }
  });
}

// CAUSAS PRINCIPALES - INTERACTIVA
function crearGraficasCausas() {
  const ctx = document.getElementById('chartCausas');
  if (!ctx) return;
  
  const datosFiltrados = obtenerDatosFiltrados();
  
  const causas = {};
  datosFiltrados.forEach(row => {
    const causa = row[COLUMNAS.CAUSA_SINIESTRO] || 'No especificada';
    causas[causa] = (causas[causa] || 0) + 1;
  });
  
  const sortedCausas = Object.entries(causas).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const totalCausas = sortedCausas.reduce((sum, [, count]) => sum + count, 0);
  
  if (charts.causas) charts.causas.destroy();
  
  charts.causas = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: sortedCausas.map(c => c[0].substring(0, 20)),
      datasets: [{
        label: 'Cantidad',
        data: sortedCausas.map(c => c[1]),
        backgroundColor: sortedCausas.map((item, index) => 
          filtrosActivos.causaSiniestro === item[0] ? 
          'rgba(25, 118, 210, 0.8)' :
          [
            'rgba(255, 99, 132, 0.8)',
            'rgba(54, 162, 235, 0.8)',
            'rgba(255, 206, 86, 0.8)',
            'rgba(75, 192, 192, 0.8)',
            'rgba(153, 102, 255, 0.8)',
            'rgba(255, 159, 64, 0.8)',
            'rgba(199, 199, 199, 0.8)',
            'rgba(83, 102, 255, 0.8)'
          ][index % 8]
        ),
        borderColor: sortedCausas.map((item, index) => 
          filtrosActivos.causaSiniestro === item[0] ? 
          'rgba(25, 118, 210, 1)' :
          [
            'rgba(255, 99, 132, 1)',
            'rgba(54, 162, 235, 1)',
            'rgba(255, 206, 86, 1)',
            'rgba(75, 192, 192, 1)',
            'rgba(153, 102, 255, 1)',
            'rgba(255, 159, 64, 1)',
            'rgba(199, 199, 199, 1)',
            'rgba(83, 102, 255, 1)'
          ][index % 8]
        ),
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      indexAxis: 'y',
      onClick: (event, elements) => {
        if (elements.length > 0) {
          const elementIndex = elements[0].index;
          const causaSiniestro = sortedCausas[elementIndex][0];
          
          if (filtrosActivos.causaSiniestro === causaSiniestro) {
            limpiarFiltrosCruzados();
          } else {
            aplicarFiltroCruzado('causaSiniestro', causaSiniestro);
          }
        }
      },
      plugins: { 
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(0,0,0,0.8)',
          padding: 12,
          titleFont: { size: 14, weight: 'bold' },
          bodyFont: { size: 13 },
          callbacks: {
            title: function(context) {
              const index = context[0].dataIndex;
              return sortedCausas[index][0];
            },
            label: function(context) {
              const value = context.parsed.x;
              const porcentaje = totalCausas > 0 ? ((value / totalCausas) * 100).toFixed(1) : 0;
              return `${value} incidentes (${porcentaje}% del total)`;
            },
            footer: function() {
              return 'Haz clic para filtrar';
            }
          }
        }
      },
      scales: { 
        x: { 
          beginAtZero: true, 
          ticks: { precision: 0 }
        },
        y: {
          ticks: {
            font: { size: 11 },
            maxRotation: 0
          }
        }
      }
    }
  });
}

// CLASIFICACIÓN DE FALLECIDOS
function crearGraficasClasificacionFallecidos() {
  const ctx = document.getElementById('chartClasificacionFallecidos');
  if (!ctx) return;
  
  const datosFiltrados = obtenerDatosFiltrados();
  
  const clasificacion = {};
  datosFiltrados.forEach(row => {
    const clase = row[COLUMNAS.CLASIFICACION_FALLECIDOS] || 'No especificada';
    const fallecidos = parseInt(row[COLUMNAS.TOTAL_FALLECIDOS] || 0);
    if (fallecidos > 0 && clase !== 'No aplica') {
      clasificacion[clase] = (clasificacion[clase] || 0) + fallecidos;
    }
  });
  
  const sortedClasificacion = Object.entries(clasificacion).sort((a, b) => b[1] - a[1]);
  if (sortedClasificacion.length === 0) {
    const parent = ctx.parentElement;
    if (parent) parent.innerHTML = '<p class="empty-state">No hay datos de clasificación</p>';
    return;
  }
  
  const totalFallecidos = sortedClasificacion.reduce((sum, [, count]) => sum + count, 0);
  
  if (charts.clasificacionFallecidos) charts.clasificacionFallecidos.destroy();
  
  charts.clasificacionFallecidos = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: sortedClasificacion.map(c => c[0]),
      datasets: [{
        label: 'Fallecidos',
        data: sortedClasificacion.map(c => c[1]),
        backgroundColor: [
          '#FF6384',
          '#36A2EB', 
          '#FFCE56',
          '#4BC0C0',
          '#9966FF',
          '#FF9F40',
          '#FF6384',
          '#C9CBCF'
        ],
        borderWidth: 3,
        borderColor: '#ffffff',
        hoverBorderWidth: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: { 
        legend: { 
          position: 'right',
          labels: {
            padding: 15,
            font: { size: 12, weight: '600' },
            generateLabels: function(chart) {
              const data = chart.data;
              if (data.labels.length && data.datasets.length) {
                return data.labels.map((label, i) => {
                  return {
                    text: label,
                    fillStyle: data.datasets[0].backgroundColor[i],
                    hidden: false,
                    index: i
                  };
                });
              }
              return [];
            }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0,0,0,0.8)',
          padding: 12,
          titleFont: { size: 14, weight: 'bold' },
          bodyFont: { size: 13 },
          callbacks: {
            label: function(context) {
              const value = context.parsed;
              const porcentaje = totalFallecidos > 0 ? ((value / totalFallecidos) * 100).toFixed(1) : 0;
              return `${context.label}: ${value} fallecidos (${porcentaje}%)`;
            }
          }
        },
        title: {
          display: true,
          text: `Total: ${totalFallecidos.toLocaleString()} fallecidos`,
          font: { size: 14, weight: 'bold' },
          color: '#1976d2',
          padding: { bottom: 15 }
        }
      }
    }
  });
}

// TIPOS DE VIALIDAD - INTERACTIVA
function crearGraficasTiposVialidad() {
  const ctx = document.getElementById('chartTiposVialidad');
  if (!ctx) return;
  
  const datosFiltrados = obtenerDatosFiltrados();
  
  const vialidades = {};
  datosFiltrados.forEach(row => {
    const vialidad = row[COLUMNAS.TIPO_VIALIDAD] || 'No especificada';
    vialidades[vialidad] = (vialidades[vialidad] || 0) + 1;
  });
  
  const sortedVialidades = Object.entries(vialidades).sort((a, b) => b[1] - a[1]);
  const totalVialidades = sortedVialidades.reduce((sum, [, count]) => sum + count, 0);
  
  if (charts.tiposVialidad) charts.tiposVialidad.destroy();
  
  charts.tiposVialidad = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: sortedVialidades.map(v => v[0]),
      datasets: [{
        data: sortedVialidades.map(v => v[1]),
        backgroundColor: sortedVialidades.map((item, index) => 
          filtrosActivos.tipoVialidad === item[0] ? 
          '#1976d2' :
          ['#4BC0C0', '#FF6384', '#36A2EB', '#FFCE56', '#9966FF'][index % 5]
        ),
        borderWidth: 2,
        borderColor: '#ffffff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      onClick: (event, elements) => {
        if (elements.length > 0) {
          const elementIndex = elements[0].index;
          const tipoVialidad = sortedVialidades[elementIndex][0];
          
          if (filtrosActivos.tipoVialidad === tipoVialidad) {
            limpiarFiltrosCruzados();
          } else {
            aplicarFiltroCruzado('tipoVialidad', tipoVialidad);
          }
        }
      },
      plugins: { 
        legend: { 
          position: 'right',
          labels: {
            padding: 15,
            font: { size: 12, weight: '600' }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0,0,0,0.8)',
          padding: 12,
          titleFont: { size: 14, weight: 'bold' },
          bodyFont: { size: 13 },
          callbacks: {
            label: function(context) {
              const value = context.parsed;
              const porcentaje = totalVialidades > 0 ? ((value / totalVialidades) * 100).toFixed(1) : 0;
              return `${context.label}: ${value} incidentes (${porcentaje}%)`;
            },
            footer: function() {
              return 'Haz clic para filtrar';
            }
          }
        }
      }
    }
  });
}

// GRÁFICAS NO INTERACTIVAS
function crearGraficaDias(analizador) {
  const ctx = document.getElementById('chartDias');
  if (!ctx) return;
  
  const datosDia = analizador.analizarPorDiaSemana();
  if (charts.dias) charts.dias.destroy();
  
  charts.dias = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: datosDia.map(d => d.dia),
      datasets: [{
        data: datosDia.map(d => d.cantidad),
        backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#FF6384'],
        borderWidth: 2,
        borderColor: '#ffffff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { position: 'right' },
        tooltip: {
          callbacks: {
            label: function(context) {
              const value = context.parsed;
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
              return `${context.label}: ${value} (${percentage}%)`;
            }
          }
        },
        // ⭐ NUEVO: Mostrar si hay filtro activo
        title: {
          display: filtrosActivos.municipio !== null,
          text: filtrosActivos.municipio ? `Filtrado: ${filtrosActivos.municipio}` : '',
          font: { size: 12, weight: 'bold' },
          color: '#4caf50'
        }
      }
    }
  });
}

function crearGraficaMunicipios() {
  const ctx = document.getElementById('chartMunicipios');
  if (!ctx) return;
  
  // ⭐ CAMBIO: Usar datos filtrados
  const datosFiltrados = obtenerDatosFiltrados();
  
  const municipios = {};
  datosFiltrados.forEach(row => {
    const municipio = row[COLUMNAS.MUNICIPIO] || 'Desconocido';
    municipios[municipio] = (municipios[municipio] || 0) + 1;
  });
  
  const top10 = Object.entries(municipios).sort((a, b) => b[1] - a[1]).slice(0, 10);
  
  if (charts.municipios) charts.municipios.destroy();
  
  // Si hay filtro de municipio y solo hay 1 municipio, mostrar mensaje
  if (filtrosActivos.municipio && top10.length === 1) {
    const parent = ctx.parentElement;
    if (parent) {
      parent.innerHTML = `
        <h4><i class="fas fa-city"></i> Top 10 Municipios con Más Incidentes</h4>
        <div style="text-align: center; padding: 40px; color: #666;">
          <i class="fas fa-info-circle" style="font-size: 3em; color: #1976d2; margin-bottom: 15px;"></i>
          <p style="font-size: 16px; font-weight: 600;">Mostrando datos de: ${filtrosActivos.municipio}</p>
          <p style="font-size: 14px;">${top10[0][1]} incidentes totales</p>
        </div>
      `;
    }
    return;
  }
  
  charts.municipios = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: top10.map(m => m[0]),
      datasets: [{
        label: 'Incidentes',
        data: top10.map(m => m[1]),
        backgroundColor: 'rgba(54, 162, 235, 0.6)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: { 
        legend: { display: false },
        // ⭐ NUEVO: Indicador de filtro
        title: {
          display: filtrosActivos.municipio !== null || filtrosActivos.tipoSiniestro !== null || filtrosActivos.causaSiniestro !== null,
          text: '📊 Datos filtrados',
          font: { size: 12, weight: 'bold' },
          color: '#4caf50'
        }
      },
      scales: { 
        y: { 
          beginAtZero: true, 
          ticks: { precision: 0 } 
        } 
      }
    }
  });
}

window.actualizarDistribucionTemporal = actualizarDistribucionTemporal;

// ============================================================
// ANÁLISIS CRUZADO
// ============================================================
function inicializarAnalisisCruzado() {
  actualizarAnalisisCruzado();
}

function actualizarAnalisisCruzado() {
  const tipo = document.getElementById('tipoAnalisisCruzado')?.value;
  if (!tipo) return;
  
  switch(tipo) {
    case 'municipio_fallecidos': analisisMunicipioFallecidos(); break;
    case 'vialidad_tipo': analisisVialidadTipo(); break;
    case 'dia_causa': analisisDiaCausa(); break;
    case 'municipio_causa': analisisMunicipioCausa(); break;
    case 'vialidad_fallecidos': analisisVialidadFallecidos(); break;
  }
}

function analisisMunicipioFallecidos() {
  // ⭐ CAMBIO: Usar datos filtrados
  const datosFiltrados = obtenerDatosFiltrados();
  
  const datos = {};
  datosFiltrados.forEach(row => {
    const municipio = row[COLUMNAS.MUNICIPIO] || 'Desconocido';
    const fallecidos = parseInt(row[COLUMNAS.TOTAL_FALLECIDOS] || 0);
    if (!datos[municipio]) datos[municipio] = { incidentes: 0, fallecidos: 0 };
    datos[municipio].incidentes++;
    datos[municipio].fallecidos += fallecidos;
  });
  
  const municipiosConLetalidad = Object.entries(datos).map(([municipio, data]) => ({
    municipio,
    tasa: data.incidentes > 0 ? (data.fallecidos / data.incidentes).toFixed(2) : 0,
    fallecidos: data.fallecidos,
    incidentes: data.incidentes
  })).sort((a, b) => b.tasa - a.tasa).slice(0, 10);
  
  crearGraficaAnalisisCruzado(
    municipiosConLetalidad.map(m => m.municipio),
    [{
      label: 'Fallecidos por Incidente',
      data: municipiosConLetalidad.map(m => m.tasa),
      backgroundColor: 'rgba(255, 99, 132, 0.6)',
      borderColor: 'rgba(255, 99, 132, 1)',
      borderWidth: 2
    }],
    'bar'
  );
  
  generarInsights('municipio_fallecidos', municipiosConLetalidad);
}

function analisisVialidadTipo() {
  // ⭐ CAMBIO: Usar datos filtrados
  const datosFiltrados = obtenerDatosFiltrados();
  
  const vialidades = {};
  datosFiltrados.forEach(row => {
    const vialidad = row[COLUMNAS.TIPO_VIALIDAD] || 'No especificada';
    const causa = row[COLUMNAS.CAUSA_SINIESTRO] || 'Otro';
    if (!vialidades[vialidad]) vialidades[vialidad] = {};
    vialidades[vialidad][causa] = (vialidades[vialidad][causa] || 0) + 1;
  });
  
  const todasCausas = [...new Set(datosFiltrados.map(row => row[COLUMNAS.CAUSA_SINIESTRO] || 'Otro'))].slice(0, 5);
  const colores = ['rgba(255, 99, 132, 0.6)', 'rgba(54, 162, 235, 0.6)', 'rgba(255, 206, 86, 0.6)', 'rgba(75, 192, 192, 0.6)', 'rgba(153, 102, 255, 0.6)'];
  
  const datasets = todasCausas.map((causa, idx) => ({
    label: causa,
    data: Object.keys(vialidades).map(vialidad => vialidades[vialidad][causa] || 0),
    backgroundColor: colores[idx],
    borderColor: colores[idx].replace('0.6', '1'),
    borderWidth: 2
  }));
  
  crearGraficaAnalisisCruzado(Object.keys(vialidades), datasets, 'bar', true);
  generarInsights('vialidad_tipo', { vialidades, causas: todasCausas });
}

function analisisDiaCausa() {
  const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const datosPorDia = {};
  dias.forEach(dia => datosPorDia[dia] = {});
  
  // ⭐ CAMBIO: Usar datos filtrados
  const datosFiltrados = obtenerDatosFiltrados();
  
  datosFiltrados.forEach(row => {
    const fechaStr = row[COLUMNAS.FECHA_SINIESTRO];
    if (!fechaStr) return;
    
    let fecha = null;
    if (fechaStr.includes('/')) {
      const partes = fechaStr.split(' ')[0].split('/');
      if (partes.length === 3) {
        fecha = new Date(partes[2], partes[1] - 1, partes[0]);
      }
    } else if (fechaStr.includes('-')) {
      fecha = new Date(fechaStr.split(' ')[0]);
    }
    
    if (!fecha || isNaN(fecha)) return;
    const dia = dias[fecha.getDay()];
    const causa = row[COLUMNAS.CAUSA_SINIESTRO] || 'Otro';
    datosPorDia[dia][causa] = (datosPorDia[dia][causa] || 0) + 1;
  });
  
  const todasCausas = [...new Set(datosFiltrados.map(row => row[COLUMNAS.CAUSA_SINIESTRO] || 'Otro'))].slice(0, 5);
  const colores = ['rgba(255, 99, 132, 0.6)', 'rgba(54, 162, 235, 0.6)', 'rgba(255, 206, 86, 0.6)', 'rgba(75, 192, 192, 0.6)', 'rgba(153, 102, 255, 0.6)'];
  
  const datasets = todasCausas.map((causa, idx) => ({
    label: causa,
    data: dias.map(dia => datosPorDia[dia][causa] || 0),
    backgroundColor: colores[idx],
    borderColor: colores[idx].replace('0.6', '1'),
    borderWidth: 2
  }));
  
  crearGraficaAnalisisCruzado(dias, datasets, 'bar', true);
  generarInsights('dia_causa', { datosPorDia, causas: todasCausas });
}

function analisisMunicipioCausa() {
  // ⭐ CAMBIO: Usar datos filtrados
  const datosFiltrados = obtenerDatosFiltrados();
  
  const municipios = {};
  datosFiltrados.forEach(row => {
    const municipio = row[COLUMNAS.MUNICIPIO] || 'Desconocido';
    municipios[municipio] = (municipios[municipio] || 0) + 1;
  });
  
  const top10Municipios = Object.entries(municipios).sort((a, b) => b[1] - a[1]).slice(0, 10).map(m => m[0]);
  const datosPorMunicipio = {};
  top10Municipios.forEach(mun => datosPorMunicipio[mun] = {});
  
  datosFiltrados.forEach(row => {
    const municipio = row[COLUMNAS.MUNICIPIO] || 'Desconocido';
    if (!top10Municipios.includes(municipio)) return;
    const causa = row[COLUMNAS.CAUSA_SINIESTRO] || 'Otro';
    datosPorMunicipio[municipio][causa] = (datosPorMunicipio[municipio][causa] || 0) + 1;
  });
  
  const todasCausas = [...new Set(datosFiltrados.map(row => row[COLUMNAS.CAUSA_SINIESTRO] || 'Otro'))].slice(0, 5);
  const colores = ['rgba(255, 99, 132, 0.6)', 'rgba(54, 162, 235, 0.6)', 'rgba(255, 206, 86, 0.6)', 'rgba(75, 192, 192, 0.6)', 'rgba(153, 102, 255, 0.6)'];
  
  const datasets = todasCausas.map((causa, idx) => ({
    label: causa,
    data: top10Municipios.map(mun => datosPorMunicipio[mun][causa] || 0),
    backgroundColor: colores[idx],
    borderColor: colores[idx].replace('0.6', '1'),
    borderWidth: 2
  }));
  
  crearGraficaAnalisisCruzado(top10Municipios, datasets, 'bar', true);
  generarInsights('municipio_causa', { datosPorMunicipio, causas: todasCausas });
}

function analisisVialidadFallecidos() {
  // ⭐ CAMBIO: Usar datos filtrados
  const datosFiltrados = obtenerDatosFiltrados();
  
  const datos = {};
  datosFiltrados.forEach(row => {
    const vialidad = row[COLUMNAS.TIPO_VIALIDAD] || 'No especificada';
    const fallecidos = parseInt(row[COLUMNAS.TOTAL_FALLECIDOS] || 0);
    if (!datos[vialidad]) datos[vialidad] = { incidentes: 0, fallecidos: 0 };
    datos[vialidad].incidentes++;
    datos[vialidad].fallecidos += fallecidos;
  });
  
  const vialidadesConLetalidad = Object.entries(datos).map(([vialidad, data]) => ({
    vialidad,
    tasa: data.incidentes > 0 ? (data.fallecidos / data.incidentes).toFixed(2) : 0,
    fallecidos: data.fallecidos,
    incidentes: data.incidentes
  })).sort((a, b) => b.tasa - a.tasa);
  
  crearGraficaAnalisisCruzado(
    vialidadesConLetalidad.map(v => v.vialidad),
    [{
      label: 'Fallecidos por Incidente',
      data: vialidadesConLetalidad.map(v => v.tasa),
      backgroundColor: 'rgba(75, 192, 192, 0.6)',
      borderColor: 'rgba(75, 192, 192, 1)',
      borderWidth: 2
    }],
    'bar'
  );
  
  generarInsights('vialidad_fallecidos', vialidadesConLetalidad);
}

function crearGraficaAnalisisCruzado(labels, datasets, tipo = 'bar', stacked = false) {
  const ctx = document.getElementById('chartAnalisisCruzado');
  if (!ctx) return;
  if (charts.cruzado) charts.cruzado.destroy();
  
  charts.cruzado = new Chart(ctx, {
    type: tipo,
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: { legend: { position: 'top' } },
      scales: tipo !== 'pie' && tipo !== 'doughnut' ? {
        x: { stacked },
        y: { stacked, beginAtZero: true, ticks: { precision: 0 } }
      } : {}
    }
  });
}

function generarInsights(tipoAnalisis, datos) {
  const container = document.getElementById('insightsList');
  if (!container) return;
  
  let insights = [];
  
  switch(tipoAnalisis) {
    case 'municipio_fallecidos':
      const masPeligroso = datos[0];
      insights.push(`El municipio más letal es <strong>${masPeligroso.municipio}</strong> con ${masPeligroso.tasa} fallecidos por incidente.`);
      insights.push(`En total, ${masPeligroso.municipio} ha registrado ${masPeligroso.fallecidos} fallecidos en ${masPeligroso.incidentes} incidentes.`);
      break;
    case 'vialidad_tipo':
      const vialidadMasPeligrosa = Object.entries(datos.vialidades).map(([v, causas]) => ({
        vialidad: v,
        total: Object.values(causas).reduce((a, b) => a + b, 0)
      })).sort((a, b) => b.total - a.total)[0];
      insights.push(`<strong>${vialidadMasPeligrosa.vialidad}</strong> es el tipo de vialidad con más incidentes (${vialidadMasPeligrosa.total} casos).`);
      break;
    case 'dia_causa':
      const diaMasPeligroso = Object.entries(datos.datosPorDia).map(([dia, causas]) => ({
        dia,
        total: Object.values(causas).reduce((a, b) => a + b, 0)
      })).sort((a, b) => b.total - a.total)[0];
      insights.push(`<strong>${diaMasPeligroso.dia}</strong> es el día con más incidentes registrados.`);
      break;
    case 'vialidad_fallecidos':
      const masPeligrosaVialidad = datos[0];
      insights.push(`<strong>${masPeligrosaVialidad.vialidad}</strong> tiene la tasa de letalidad más alta: ${masPeligrosaVialidad.tasa} fallecidos por incidente.`);
      break;
    case 'municipio_causa':
      insights.push(`Análisis de las causas principales por municipio muestra patrones diferenciados según la ubicación.`);
      break;
  }
  
  container.innerHTML = insights.map(insight => 
    `<div class="insight-item"><i class="fas fa-lightbulb"></i> ${insight}</div>`
  ).join('');
}

// ============================================================
// CONTROL DE PANELES
// ============================================================
window.togglePanel = function(panel) {
  const content = document.getElementById(`${panel}Content`);
  const icon = document.getElementById(`${panel}ToggleIcon`);
  
  if (content.style.display === 'none') {
    content.style.display = 'block';
    icon.className = 'fas fa-chevron-up';
    
    if (panel === 'perfil') actualizarPerfilSiniestros();
    if (panel === 'cruzado') inicializarAnalisisCruzado();
  } else {
    content.style.display = 'none';
    icon.className = 'fas fa-chevron-down';
  }
};

// ⭐ EXPORTAR FUNCIONES GLOBALES
window.cambiarFiltroMunicipio = cambiarFiltroMunicipio;
window.limpiarFiltrosCruzados = limpiarFiltrosCruzados;
window.aplicarFiltroCruzado = aplicarFiltroCruzado;
window.limpiarFiltroTemporal = limpiarFiltroTemporal;
window.actualizarDistribucionTemporal = actualizarDistribucionTemporal;
window.togglePanel = togglePanel;
window.actualizarAnalisisCruzado = actualizarAnalisisCruzado;

// ============================================================
// INICIALIZACIÓN
// ============================================================
document.addEventListener('DOMContentLoaded', function() {
  console.log('Inicializando sistema de estadísticas avanzadas interactivo...');
  
  cargarDatos();
  
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('nav a').forEach(link => {
    link.classList.remove('active');
    if (link.href.includes(currentPage)) {
      link.classList.add('active');
    }
  });
  
  console.log('Sistema de estadísticas interactivo inicializado');
});


/* ============================================================
   FUNCIONES NUEVAS PARA COPIAR Y PEGAR
   Agregar estas funciones ANTES de la función cargarDatos()
   Sugerencia: Línea 650-700 aproximadamente
   ============================================================ */

// ⭐ FUNCIÓN NUEVA #1: Generar el selector de municipios
function generarSelectorMunicipios() {
  const municipios = {};
  
  // Obtener todos los municipios únicos con su conteo
  allIncidentsData.forEach(row => {
    const municipio = row[COLUMNAS.MUNICIPIO] || 'Desconocido';
    municipios[municipio] = (municipios[municipio] || 0) + 1;
  });
  
  // Ordenar alfabéticamente
  const municipiosOrdenados = Object.entries(municipios)
    .sort((a, b) => a[0].localeCompare(b[0]));
  
  // Generar opciones del select
  const selector = document.getElementById('filtroMunicipio');
  if (!selector) {
    console.warn('⚠️ No se encontró el elemento filtroMunicipio');
    return;
  }
  
  // Limpiar y agregar opción por defecto
  selector.innerHTML = '<option value="">Todos los municipios</option>';
  
  // Agregar cada municipio con su conteo
  municipiosOrdenados.forEach(([municipio, cantidad]) => {
    const option = document.createElement('option');
    option.value = municipio;
    option.textContent = `${municipio} (${cantidad})`;
    selector.appendChild(option);
  });
  
  console.log(`✅ ${municipiosOrdenados.length} municipios cargados en el selector`);
}

// ⭐ FUNCIÓN MEJORADA: Manejar cambios en el selector de municipios
function cambiarFiltroMunicipio() {
  const selector = document.getElementById('filtroMunicipio');
  if (!selector) return;
  
  const municipio = selector.value;
  
  if (municipio === '') {
    filtrosActivos.municipio = null;
    
    const indicador = document.getElementById('filtrosCruzadosIndicador');
    if (indicador) indicador.style.display = 'none';
    
    // ⭐ Actualizar TODO incluyendo resumen general
    actualizarEstadisticasFiltro();
    actualizarResumenGeneral();
    actualizarDashboardConFiltros();
    
    mostrarNotificacion('Mostrando todos los municipios', 'info', 2000);
  } else {
    aplicarFiltroCruzado('municipio', municipio);
    actualizarEstadisticasFiltro();
    actualizarResumenGeneral();  // ⭐ NUEVO
  }
}

// ⭐ NUEVA FUNCIÓN: Actualizar estadísticas del filtro
function actualizarEstadisticasFiltro() {
  const statsContainer = document.querySelector('.filtro-stats');
  if (!statsContainer) return;
  
  const datosFiltrados = obtenerDatosFiltrados();
  const totalIncidentes = datosFiltrados.length;
  const totalFallecidos = datosFiltrados.reduce((sum, row) => 
    sum + parseInt(row[COLUMNAS.TOTAL_FALLECIDOS] || 0), 0
  );
  
  if (filtrosActivos.municipio) {
    statsContainer.innerHTML = `
      <div class="stat-mini">
        <i class="fas fa-exclamation-triangle"></i>
        <span>${totalIncidentes} incidentes en este municipio</span>
      </div>
      <div class="stat-mini">
        <i class="fas fa-skull"></i>
        <span>${totalFallecidos} fallecidos</span>
      </div>
    `;
  } else {
    statsContainer.innerHTML = `
      <div class="stat-mini">
        <i class="fas fa-database"></i>
        <span>${allIncidentsData.length} incidentes totales</span>
      </div>
    `;
  }
}