/* ============================================================
   MAPA.JS - SISTEMA DE ANÁLISIS DE SINIESTROS VIALES
   Versión Corregida - Coordenadas en columna 27
   ============================================================ */

class MapaIncidentes {
  constructor() {
    this.allIncidentsData = [];
    this.filteredIncidentsData = [];
    this.markersGroup = null;
    this.heatMapLayer = null;
    this.zonasLayer = null;
    this.showHeatmapLayer = true;
    this.showMarkersLayer = true;
    this.showZonasPeligrosas = false;
    this.currentTypeFilter = 'all';
    this.currentMunicipioFilter = '';
    this.currentFallecidosFilter = 0;
    this.tipoPeriodoFilter = 'todos';
    this.periodoSeleccionado = '';
    this.isLoading = false;
    this.map = null;
    this.capasBase = {};
    this.zonasPeligrosas = [];
    
    this.MAIN_API_URL = "https://script.google.com/macros/s/AKfycbzLTG8Zo1ayJMapz6rHXK0mUrnLhs6Ar0uk_06DBqhxww0fySCUgZa_u0yubKCbV1deJA/exec";
    this.mapboxToken = "pk.eyJ1IjoiYW5nZWxnb256YWxlei0wMiIsImEiOiJjbWRocWE0aWwwNGxvMm1xM2l6NXBteHNvIn0.KPRO-Mr23XK7iIkBXcbZlw";
    
    this.initializeMap();
    this.bindEvents();
  }

  // ============================================================
  // INICIALIZACIÓN
  // ============================================================
  
  initializeMap() {
    try {
      this.map = L.map('mapaIncidentes').setView([16.75, -93.12], 11);
      
      this.capasBase = {
        osm: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 19
        }),
        hot: L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap HOT',
          maxZoom: 19
        }),
        topo: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenTopoMap',
          maxZoom: 17
        }),
        traffic: L.tileLayer(`https://api.mapbox.com/styles/v1/mapbox/traffic-day-v2/tiles/{z}/{x}/{y}?access_token=${this.mapboxToken}`, {
          tileSize: 512,
          zoomOffset: -1,
          attribution: '© Mapbox',
          maxZoom: 19
        })
      };

      this.capasBase.osm.addTo(this.map);
      this.markersGroup = L.layerGroup().addTo(this.map);
      this.zonasLayer = L.layerGroup();

      console.log("Mapa inicializado correctamente");
    } catch (error) {
      console.error("Error al inicializar el mapa:", error);
      this.mostrarNotificacion("Error al inicializar el mapa", 'error');
    }
  }

  // ============================================================
  // ICONOS
  // ============================================================
  
  getIconosSiniestros() {
    return {
      'Choque': this.createCustomIcon('#ff4444', 'fas fa-car-crash'),
      'Atropello': this.createCustomIcon('#ff8800', 'fas fa-walking'),
      'Volcadura': this.createCustomIcon('#8844ff', 'fas fa-car-side', 'transform: rotate(90deg);'),
      'Caída': this.createCustomIcon('#44ff44', 'fas fa-motorcycle'),
      'Otro': this.createCustomIcon('#888888', 'fas fa-exclamation')
    };
  }

  createCustomIcon(color, iconClass, extraStyle = '') {
    return L.divIcon({
      className: 'custom-div-icon',
      html: `<div style="background-color: ${color}; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"><i class="${iconClass}" style="color: white; font-size: 10px; ${extraStyle}"></i></div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });
  }

  // ============================================================
  // VALIDACIÓN
  // ============================================================
  
// Función mejorada para validar coordenadas
validarCoordenadas(coordStr) {
  // Log para debug
  if (!coordStr) {
    console.log("Coordenada vacía o null");
    return null;
  }
  
  if (typeof coordStr !== 'string') {
    console.log("Coordenada no es string:", typeof coordStr, coordStr);
    return null;
  }
  
  // Limpiar la string de coordenadas
  const cleanCoordStr = coordStr.trim().replace(/["']/g, '');
  
  // Intentar diferentes formatos de separación
  let parts;
  if (cleanCoordStr.includes(',')) {
    parts = cleanCoordStr.split(",");
  } else if (cleanCoordStr.includes(' ')) {
    parts = cleanCoordStr.split(/\s+/);
  } else {
    console.log("Formato de coordenadas no reconocido:", cleanCoordStr);
    return null;
  }
  
  if (parts.length !== 2) {
    console.log("Coordenadas no tienen 2 partes:", parts.length, cleanCoordStr);
    return null;
  }
  
  const lat = parseFloat(parts[0].trim());
  const lng = parseFloat(parts[1].trim());
  
  if (isNaN(lat) || isNaN(lng)) {
    console.log("Coordenadas no son números válidos:", lat, lng, cleanCoordStr);
    return null;
  }
  
  // Límites ampliados para todo Chiapas y áreas limítrofes
  const latMin = 14.0;  // Ampliado de 14.5
  const latMax = 18.0;  // Ampliado de 17.5
  const lngMin = -95.0; // Ampliado de -94.5
  const lngMax = -90.0; // Ampliado de -90.5
  
  if (lat < latMin || lat > latMax || lng < lngMin || lng > lngMax) {
    console.log("Coordenadas fuera de rango válido:", lat, lng, cleanCoordStr);
    console.log(`Rangos válidos: lat(${latMin} a ${latMax}), lng(${lngMin} a ${lngMax})`);
    return null;
  }
  
  return { lat, lng };
}

// Función mejorada para cargar datos con mejor logging
async cargarDatosMapaCalor(esActualizacionAutomatica = false) {
  if (this.isLoading) return;

  try {
    this.isLoading = true;
    console.log("Cargando datos...");
    
    if (!esActualizacionAutomatica) {
      this.mostrarProgreso('Cargando incidentes...', 'Obteniendo datos del servidor');
    }
    
    const response = await fetch(this.MAIN_API_URL);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log("Datos recibidos:", data.length, "registros");
    
    // Contadores para debug
    let totalRegistros = data.length;
    let registrosConCoordenadas = 0;
    let coordenadasValidas = 0;
    let coordenadasInvalidas = 0;
    
    this.allIncidentsData = data.filter((row, index) => {
      // Verificar si existe la columna de coordenadas
      if (row[27] !== undefined && row[27] !== null && row[27] !== '') {
        registrosConCoordenadas++;
      }
      
      const coords = this.validarCoordenadas(row[27]);
      
      if (coords !== null) {
        coordenadasValidas++;
        return true;
      } else {
        coordenadasInvalidas++;
        // Log de las primeras 10 coordenadas inválidas para debug
        if (coordenadasInvalidas <= 10) {
          console.log(`Registro ${index}: Coordenada inválida:`, row[27]);
        }
        return false;
      }
    });
    
    // Mostrar estadísticas detalladas
    console.log("=== ESTADÍSTICAS DE CARGA ===");
    console.log(`Total de registros recibidos: ${totalRegistros}`);
    console.log(`Registros con datos en columna 27: ${registrosConCoordenadas}`);
    console.log(`Coordenadas válidas: ${coordenadasValidas}`);
    console.log(`Coordenadas inválidas: ${coordenadasInvalidas}`);
    console.log(`Porcentaje de éxito: ${((coordenadasValidas/totalRegistros)*100).toFixed(2)}%`);
    
    // Mostrar algunos ejemplos de coordenadas válidas
    console.log("=== EJEMPLOS DE COORDENADAS VÁLIDAS ===");
    this.allIncidentsData.slice(0, 5).forEach((row, index) => {
      console.log(`Ejemplo ${index + 1}: ${row[27]}`);
    });
    
    this.procesarDatosCargados(esActualizacionAutomatica);
    
  } catch (error) {
    console.error("Error al cargar datos:", error);
    
    if (!esActualizacionAutomatica) {
      this.mostrarNotificacion("Error al cargar datos. Reintentando...", 'error');
    }
    
    setTimeout(() => {
      this.cargarDatosMapaCalor(esActualizacionAutomatica);
    }, 3000);
  } finally {
    this.isLoading = false;
    if (!esActualizacionAutomatica) {
      this.ocultarProgreso();
    }
  }
}

// Función adicional para analizar todas las coordenadas
analizarTodasLasCoordenadas() {
  fetch(this.MAIN_API_URL)
    .then(response => response.json())
    .then(data => {
      console.log("=== ANÁLISIS COMPLETO DE COORDENADAS ===");
      
      const analisis = {
        total: data.length,
        sinCoordenadas: 0,
        coordenadasVacias: 0,
        formatoIncorrecto: 0,
        fueraDeRango: 0,
        coordenadasValidas: 0,
        ejemplosInvalidos: []
      };
      
      data.forEach((row, index) => {
        const coordStr = row[27];
        
        if (!coordStr) {
          analisis.sinCoordenadas++;
          return;
        }
        
        if (typeof coordStr !== 'string' || coordStr.trim() === '') {
          analisis.coordenadasVacias++;
          if (analisis.ejemplosInvalidos.length < 5) {
            analisis.ejemplosInvalidos.push({tipo: 'vacía', valor: coordStr, fila: index});
          }
          return;
        }
        
        const cleanCoordStr = coordStr.trim().replace(/["']/g, '');
        let parts;
        
        if (cleanCoordStr.includes(',')) {
          parts = cleanCoordStr.split(",");
        } else if (cleanCoordStr.includes(' ')) {
          parts = cleanCoordStr.split(/\s+/);
        } else {
          analisis.formatoIncorrecto++;
          if (analisis.ejemplosInvalidos.length < 10) {
            analisis.ejemplosInvalidos.push({tipo: 'formato', valor: coordStr, fila: index});
          }
          return;
        }
        
        if (parts.length !== 2) {
          analisis.formatoIncorrecto++;
          if (analisis.ejemplosInvalidos.length < 10) {
            analisis.ejemplosInvalidos.push({tipo: 'partes', valor: coordStr, fila: index});
          }
          return;
        }
        
        const lat = parseFloat(parts[0].trim());
        const lng = parseFloat(parts[1].trim());
        
        if (isNaN(lat) || isNaN(lng)) {
          analisis.formatoIncorrecto++;
          if (analisis.ejemplosInvalidos.length < 10) {
            analisis.ejemplosInvalidos.push({tipo: 'NaN', valor: coordStr, fila: index});
          }
          return;
        }
        
        // Usar rangos ampliados
        if (lat < 14.0 || lat > 18.0 || lng < -95.0 || lng > -90.0) {
          analisis.fueraDeRango++;
          if (analisis.ejemplosInvalidos.length < 10) {
            analisis.ejemplosInvalidos.push({tipo: 'rango', valor: coordStr, lat, lng, fila: index});
          }
          return;
        }
        
        analisis.coordenadasValidas++;
      });
      
      console.table(analisis);
      console.log("Ejemplos de coordenadas inválidas:", analisis.ejemplosInvalidos);
      
      return analisis;
    })
    .catch(error => {
      console.error("Error en análisis:", error);
    });
}
  // ============================================================
  // CARGA DE DATOS
  // ============================================================
  
  async cargarDatosMapaCalor(esActualizacionAutomatica = false) {
    if (this.isLoading) return;

    try {
      this.isLoading = true;
      console.log("Cargando datos...");
      
      if (!esActualizacionAutomatica) {
        this.mostrarProgreso('Cargando incidentes...', 'Obteniendo datos del servidor');
      }
      
      const response = await fetch(this.MAIN_API_URL);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log("Datos recibidos:", data.length, "registros");
      
      this.allIncidentsData = data.filter(row => {
        const coords = this.validarCoordenadas(row[27]); // Columna 27 = COORDENADAS
        return coords !== null;
      });
      
      this.procesarDatosCargados(esActualizacionAutomatica);
      
    } catch (error) {
      console.error("Error al cargar datos:", error);
      
      if (!esActualizacionAutomatica) {
        this.mostrarNotificacion("Error al cargar datos. Reintentando...", 'error');
      }
      
      setTimeout(() => {
        this.cargarDatosMapaCalor(esActualizacionAutomatica);
      }, 3000);
    } finally {
      this.isLoading = false;
      if (!esActualizacionAutomatica) {
        this.ocultarProgreso();
      }
    }
  }

  procesarDatosCargados(esActualizacionAutomatica = false) {
    const municipioActual = this.currentMunicipioFilter;
    
    this.poblarFiltros();
    this.generarOpcionesPeriodo();
    
    if (municipioActual && esActualizacionAutomatica) {
      const selectMunicipio = document.getElementById('filtroMunicipio');
      if (selectMunicipio) {
        selectMunicipio.value = municipioActual;
      }
    }
    
    if (this.currentTypeFilter !== 'all' || 
        this.currentMunicipioFilter || 
        this.tipoPeriodoFilter !== 'todos' ||
        this.currentFallecidosFilter > 0) {
      this.aplicarFiltros();
    } else {
      this.filteredIncidentsData = [...this.allIncidentsData];
      this.updateMapWithFilteredData();
      this.actualizarEstadisticas();
    }
    
    console.log("Total de incidentes válidos:", this.allIncidentsData.length);
    
    if (esActualizacionAutomatica) {
      this.mostrarNotificacion(`Datos actualizados (${this.allIncidentsData.length} incidentes)`, 'info', 2000);
    } else {
      this.mostrarNotificacion(`Cargados ${this.allIncidentsData.length} incidentes`, 'success');
    }
  }

  // ============================================================
  // SISTEMA DE PERÍODOS
  // ============================================================
  
  generarOpcionesPeriodo() {
    const periodos = {};
    
    this.allIncidentsData.forEach(row => {
      const fechaStr = row[1]; // Columna 1 = FECHA_SINIESTRO
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
      
      const claveMensual = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
      periodos[claveMensual] = periodos[claveMensual] || { tipo: 'mensual', fecha };
      
      const trimestre = Math.floor(fecha.getMonth() / 3) + 1;
      const claveTrimestral = `${fecha.getFullYear()}-T${trimestre}`;
      periodos[claveTrimestral] = periodos[claveTrimestral] || { tipo: 'trimestral', fecha };
    });
    
    this.periodosDisponibles = periodos;
  }

  actualizarSelectorPeriodo() {
    const tipoPeriodo = this.tipoPeriodoFilter;
    const selector = document.getElementById('selectorPeriodo');
    const container = document.getElementById('selectorPeriodoContainer');
    
    if (tipoPeriodo === 'todos') {
      container.style.display = 'none';
      this.periodoSeleccionado = '';
      return;
    }
    
    container.style.display = 'block';
    selector.innerHTML = '<option value="">Todos los períodos</option>';
    
    const periodosOrdenados = Object.keys(this.periodosDisponibles)
      .filter(key => this.periodosDisponibles[key].tipo === tipoPeriodo)
      .sort();
    
    periodosOrdenados.forEach(clave => {
      const option = document.createElement('option');
      option.value = clave;
      
      if (tipoPeriodo === 'mensual') {
        const [año, mes] = clave.split('-');
        const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                       'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        option.textContent = `${meses[parseInt(mes) - 1]} ${año}`;
      } else if (tipoPeriodo === 'trimestral') {
        option.textContent = clave.replace('-T', ' - Trimestre ');
      }
      
      selector.appendChild(option);
    });
  }

  // ============================================================
  // ZONAS PELIGROSAS
  // ============================================================
  
  identificarZonasPeligrosas() {
    const clusters = [];
    const radioKm = 0.5;
    const minimoIncidentes = 3;
    const procesados = new Set();
    
    this.filteredIncidentsData.forEach((incident, idx) => {
      if (procesados.has(idx)) return;
      
      const coords1 = this.validarCoordenadas(incident[27]); // Columna 27 = COORDENADAS
      if (!coords1) return;
      
      const cluster = {
        centro: coords1,
        incidentes: [incident],
        indices: [idx]
      };
      
      this.filteredIncidentsData.forEach((otro, otroIdx) => {
        if (idx === otroIdx || procesados.has(otroIdx)) return;
        
        const coords2 = this.validarCoordenadas(otro[27]); // Columna 27 = COORDENADAS
        if (!coords2) return;
        
        const distancia = this.calcularDistanciaKm(coords1, coords2);
        
        if (distancia <= radioKm) {
          cluster.incidentes.push(otro);
          cluster.indices.push(otroIdx);
          procesados.add(otroIdx);
        }
      });
      
      procesados.add(idx);
      
      if (cluster.incidentes.length >= minimoIncidentes) {
        cluster.peligrosidad = this.calcularNivelPeligrosidad(cluster.incidentes);
        cluster.totalFallecidos = cluster.incidentes.reduce((sum, inc) => 
          sum + parseInt(inc[23] || 0), 0 // Columna 23 = TOTAL_FALLECIDOS
        );
        cluster.municipio = cluster.incidentes[0][0] || 'Desconocido'; // Columna 0 = MUNICIPIO
        clusters.push(cluster);
      }
    });
    
    this.zonasPeligrosas = clusters.sort((a, b) => b.incidentes.length - a.incidentes.length);
    return this.zonasPeligrosas;
  }

  calcularDistanciaKm(coords1, coords2) {
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

  calcularNivelPeligrosidad(incidentes) {
    const fallecidos = incidentes.reduce((sum, inc) => 
      sum + parseInt(inc[23] || 0), 0 // Columna 23 = TOTAL_FALLECIDOS
    );
    const score = incidentes.length + (fallecidos * 3);
    
    if (score >= 20) return 'Crítica';
    if (score >= 10) return 'Alta';
    if (score >= 5) return 'Media';
    return 'Baja';
  }

  visualizarZonasPeligrosas() {
    this.zonasLayer.clearLayers();
    
    if (!this.showZonasPeligrosas) return;
    
    const zonas = this.identificarZonasPeligrosas();
    
    zonas.forEach((zona) => {
      const colorConfig = {
        'Crítica': { color: '#8B0000', fillColor: '#FF0000', opacity: 0.3 },
        'Alta': { color: '#DC143C', fillColor: '#FF4444', opacity: 0.25 },
        'Media': { color: '#FF8C00', fillColor: '#FFA500', opacity: 0.2 },
        'Baja': { color: '#FFD700', fillColor: '#FFFF00', opacity: 0.15 }
      };
      
      const config = colorConfig[zona.peligrosidad];
      
      const circle = L.circle([zona.centro.lat, zona.centro.lng], {
        color: config.color,
        fillColor: config.fillColor,
        fillOpacity: config.opacity,
        radius: 500,
        weight: 3
      });
      
      const popupContent = `
        <div style="font-family: Arial, sans-serif; min-width: 200px;">
          <h4 style="color: ${config.color}; margin: 0 0 10px 0;">
            <i class="fas fa-exclamation-triangle"></i> Zona ${zona.peligrosidad}
          </h4>
          <div style="font-size: 13px;">
            <div><strong>Municipio:</strong> ${zona.municipio}</div>
            <div><strong>Incidentes:</strong> ${zona.incidentes.length}</div>
            <div><strong>Fallecidos:</strong> ${zona.totalFallecidos}</div>
            <div><strong>Radio:</strong> 500m</div>
          </div>
        </div>
      `;
      
      circle.bindPopup(popupContent);
      this.zonasLayer.addLayer(circle);
    });
    
    this.zonasLayer.addTo(this.map);
  }

  toggleZonasPeligrosas() {
    this.showZonasPeligrosas = !this.showZonasPeligrosas;
    const btn = document.querySelector('#zonasText');
    
    if (this.showZonasPeligrosas) {
      this.visualizarZonasPeligrosas();
      if (btn) btn.textContent = 'Ocultar Zonas Peligrosas';
      this.mostrarNotificacion('Zonas peligrosas activadas', 'info', 2000);
    } else {
      this.zonasLayer.clearLayers();
      if (btn) btn.textContent = 'Mostrar Zonas Peligrosas';
      this.mostrarNotificacion('Zonas peligrosas desactivadas', 'info', 2000);
    }
  }

  // ============================================================
  // ACTUALIZACIÓN DEL MAPA
  // ============================================================
  
  updateMapWithFilteredData() {
    if (!this.map) return;
    
    console.log(`Actualizando mapa con ${this.filteredIncidentsData.length} incidentes`);
    
    if (this.markersGroup) {
      this.markersGroup.clearLayers();
    }
    
    if (this.heatMapLayer && this.map.hasLayer(this.heatMapLayer)) {
      this.map.removeLayer(this.heatMapLayer);
    }

    const heatPoints = [];
    const iconos = this.getIconosSiniestros();
    
    this.filteredIncidentsData.forEach(row => {
      const coords = this.validarCoordenadas(row[27]); // Columna 27 = COORDENADAS
      
      if (coords) {
        const fallecidos = parseInt(row[23] || 0); // Columna 23 = TOTAL_FALLECIDOS
        const intensidad = 1 + (fallecidos * 0.5);
        heatPoints.push([coords.lat, coords.lng, intensidad]);
        
        if (this.showMarkersLayer) {
          const causaSiniestro = row[8] || 'Otro'; // Columna 8 = CAUSA_SINIESTRO
          const icono = iconos[causaSiniestro] || iconos['Otro'];
          
          const marker = L.marker([coords.lat, coords.lng], { icon: icono });
          const popupContent = this.crearPopupContent(row);
          
          marker.bindPopup(popupContent, {
            maxWidth: 400,
            className: 'custom-popup'
          });

          this.markersGroup.addLayer(marker);
        }
      }
    });
    
    if (this.showMarkersLayer && this.markersGroup) {
      this.markersGroup.addTo(this.map);
    }

    if (this.showHeatmapLayer && heatPoints.length > 0) {
      this.heatMapLayer = L.heatLayer(heatPoints, {
        radius: 25,        
        blur: 15,          
        maxZoom: 17,
        minOpacity: 0.4,   
        gradient: {
          0.0: '#0000FF',
          0.2: '#00FFFF', 
          0.4: '#00FF00',
          0.6: '#FFFF00',
          0.8: '#FF8800',
          1.0: '#FF0000'
        }
      }).addTo(this.map);
    }
    
    if (this.showZonasPeligrosas) {
      this.visualizarZonasPeligrosas();
    }
    
    this.actualizarEstadisticas();
  }

  // ============================================================
  // FILTROS
  // ============================================================
  
  aplicarFiltros() {
    this.filteredIncidentsData = this.allIncidentsData.filter(row => {
      // Filtro por tipo de siniestro
      if (this.currentTypeFilter !== 'all') {
        const causa = row[8] || 'Otro'; // Columna 8 = CAUSA_SINIESTRO
        if (causa !== this.currentTypeFilter) return false;
      }
      
      // Filtro por municipio
      if (this.currentMunicipioFilter) {
        const municipio = row[0] || ''; // Columna 0 = MUNICIPIO
        if (municipio !== this.currentMunicipioFilter) return false;
      }
      
      // Filtro por período
      if (this.tipoPeriodoFilter !== 'todos' && this.periodoSeleccionado) {
        const fechaStr = row[1]; // Columna 1 = FECHA_SINIESTRO
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
        if (this.tipoPeriodoFilter === 'mensual') {
          claveRegistro = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
        } else if (this.tipoPeriodoFilter === 'trimestral') {
          const trimestre = Math.floor(fecha.getMonth() / 3) + 1;
          claveRegistro = `${fecha.getFullYear()}-T${trimestre}`;
        }
        
        if (claveRegistro !== this.periodoSeleccionado) return false;
      }
      
      // Filtro por fallecidos mínimos
      if (this.currentFallecidosFilter > 0) {
        const fallecidos = parseInt(row[23] || 0); // Columna 23 = TOTAL_FALLECIDOS
        if (fallecidos < this.currentFallecidosFilter) return false;
      }
      
      return true;
    });
    
    this.updateMapWithFilteredData();
  }

  filterByType(type) {
    console.log(`Filtrando por: ${type}`);
    this.currentTypeFilter = type;
    
    document.querySelectorAll('.legend-item').forEach(item => {
      item.classList.remove('active');
    });
    
    this.aplicarFiltros();
    
    const targetItem = type === 'all' 
      ? document.querySelector('.legend-all')
      : document.querySelector(`[data-type="${type}"]`);
    
    if (targetItem) {
      targetItem.classList.add('active');
    }
  }

  // ============================================================
  // ESTADÍSTICAS
  // ============================================================
  
  actualizarEstadisticas() {
    const contadores = {
      'Choque': 0,
      'Atropello': 0,
      'Volcadura': 0,
      'Caída': 0,
      'Otro': 0
    };
    
    this.filteredIncidentsData.forEach(row => {
      const causa = row[8] || 'Otro'; // Columna 8 = CAUSA_SINIESTRO
      if (contadores.hasOwnProperty(causa)) {
        contadores[causa]++;
      } else {
        contadores['Otro']++;
      }
    });
    
    Object.entries(contadores).forEach(([tipo, count]) => {
      const countElement = document.getElementById(`count-${tipo}`);
      if (countElement) {
        countElement.textContent = count;
      }
    });
    
    const countAll = document.getElementById('count-all');
    if (countAll) {
      countAll.textContent = this.filteredIncidentsData.length;
    }
  }

  // ============================================================
  // POPUP
  // ============================================================
  
  crearPopupContent(row) {
    const datos = {
      fecha: row[1] || 'No especificada',           // Columna 1 = FECHA_SINIESTRO
      tipoSiniestro: row[7] || 'No especificado',   // Columna 7 = TIPO_SINIESTRO
      causaSiniestro: row[8] || 'No especificada',  // Columna 8 = CAUSA_SINIESTRO
      vialidad: row[25] || 'No especificada',       // Columna 25 = TIPO_VIALIDAD
      usuarios: row[22] || '0',                     // Columna 22 = TOTAL_USUARIOS
      fallecidos: row[23] || '0',                   // Columna 23 = TOTAL_FALLECIDOS
      linkNoticia: row[6] || '',                    // Columna 6 = LINK_NOTICIA
      descripcion: row[30] || 'Sin descripción'    // Columna 30 = DESCRIPCION
    };

    const escapeHtml = (text) => {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    };

    let popupHTML = `
      <div style="font-family: 'Segoe UI', sans-serif; max-width: 350px;">
        <h4 style="color: #1976d2; margin: 0 0 10px 0;">
          <i class="fas fa-exclamation-triangle"></i> Resumen del Siniestro
        </h4>
        <div style="display: grid; gap: 8px;">
          <div><strong><i class="fas fa-calendar"></i> Fecha:</strong> ${escapeHtml(datos.fecha)}</div>
          <div><strong><i class="fas fa-car-crash"></i> Tipo:</strong> ${escapeHtml(datos.tipoSiniestro)}</div>
          <div><strong><i class="fas fa-exclamation-circle"></i> Causa:</strong> ${escapeHtml(datos.causaSiniestro)}</div>
          <div><strong><i class="fas fa-road"></i> Vialidad:</strong> ${escapeHtml(datos.vialidad)}</div>
          <div><strong><i class="fas fa-users"></i> Usuarios:</strong> ${escapeHtml(datos.usuarios)}</div>
          <div><strong><i class="fas fa-skull"></i> Fallecidos:</strong> ${escapeHtml(datos.fallecidos)}</div>
        </div>
        <div style="margin: 10px 0; padding: 10px; background: #f5f5f5; border-radius: 5px; font-size: 13px;">
          <strong>Descripción:</strong><br>
          ${escapeHtml(datos.descripcion.substring(0, 100))}${datos.descripcion.length > 100 ? '...' : ''}
        </div>`;

    if (datos.linkNoticia && datos.linkNoticia.trim() !== '') {
      try {
        new URL(datos.linkNoticia);
        popupHTML += `
          <div style="text-align: center; margin-top: 10px;">
            <a href="${escapeHtml(datos.linkNoticia)}" target="_blank" rel="noopener noreferrer"
               style="display: inline-block; background: #1976d2; color: white; 
                      padding: 8px 16px; text-decoration: none; border-radius: 20px;">
              <i class="fas fa-external-link-alt"></i> Ver Noticia
            </a>
          </div>`;
      } catch (e) {
        console.warn('URL inválida:', datos.linkNoticia);
      }
    }

    popupHTML += `</div>`;
    return popupHTML;
  }

  // ============================================================
  // CONTROLES
  // ============================================================
  
  toggleHeatmapView() {
    this.showHeatmapLayer = !this.showHeatmapLayer;
    const btn = document.querySelector('#heatmapText');
    
    if (this.showHeatmapLayer) {
      if (this.heatMapLayer && !this.map.hasLayer(this.heatMapLayer)) {
        this.map.addLayer(this.heatMapLayer);
      }
      if (btn) btn.textContent = 'Ocultar Mapa de Calor';
    } else {
      if (this.heatMapLayer && this.map.hasLayer(this.heatMapLayer)) {
        this.map.removeLayer(this.heatMapLayer);
      }
      if (btn) btn.textContent = 'Mostrar Mapa de Calor';
    }
  }

  toggleMarkersView() {
    this.showMarkersLayer = !this.showMarkersLayer;
    const btn = document.querySelector('#markersText');
    
    if (this.showMarkersLayer) {
      if (this.markersGroup && !this.map.hasLayer(this.markersGroup)) {
        this.map.addLayer(this.markersGroup);
      }
      if (btn) btn.textContent = 'Ocultar Marcadores';
    } else {
      if (this.markersGroup && this.map.hasLayer(this.markersGroup)) {
        this.map.removeLayer(this.markersGroup);
      }
      if (btn) btn.textContent = 'Mostrar Marcadores';
    }
    
    this.updateMapWithFilteredData();
  }

  centrarMapa() {
    this.map.setView([16.75, -93.12], 11);
    this.mostrarNotificacion('Mapa centrado', 'info', 2000);
  }

  changeMapLayer(layerKey, element) {
    document.querySelectorAll('.layer-option').forEach(option => {
      option.classList.remove('active');
    });
    
    element.classList.add('active');
    
    Object.values(this.capasBase).forEach(capa => {
      if (this.map.hasLayer(capa)) {
        this.map.removeLayer(capa);
      }
    });
    
    if (this.capasBase[layerKey]) {
      this.capasBase[layerKey].addTo(this.map);
      
      const layerNames = {
        osm: 'Comunitario',
        hot: 'Infraestructura',
        topo: 'Topográfico',
        traffic: 'Tráfico'
      };
      
      this.mostrarNotificacion(`Capa: ${layerNames[layerKey]}`, 'info', 2000);
    }
  }

  // ============================================================
  // DESCARGAS
  // ============================================================
  
  mostrarModalDescarga() {
    const modal = document.getElementById('modalDescarga');
    if (modal) modal.style.display = 'flex';
  }

  cerrarModalDescarga() {
    const modal = document.getElementById('modalDescarga');
    if (modal) modal.style.display = 'none';
  }

  async descargarMapa(formato = 'png') {
    const modal = document.getElementById('modalDescarga');
    if (modal) modal.style.display = 'none';

    try {
      switch (formato) {
        case 'png':
          await this.descargarMapaImagen();
          break;
        case 'kml':
          this.descargarMapaKML();
          break;
        case 'csv':
          this.descargarMapaCSV();
          break;
        case 'geojson':
          this.descargarMapaGeoJSON();
          break;
      }
    } catch (error) {
      console.error('Error en descarga:', error);
      this.mostrarNotificacion('Error durante la descarga', 'error');
    }
  }

  async descargarMapaImagen() {
    this.mostrarProgreso('Generando imagen PNG...');
    
    const controls = document.querySelector('.map-controls');
    const legend = document.querySelector('.legend-panel');
    const layerSelector = document.querySelector('.layer-selector');
    
    const elementsToHide = [controls, legend, layerSelector].filter(el => el);
    elementsToHide.forEach(el => el.style.display = 'none');

    try {
      const canvas = await html2canvas(document.getElementById('mapaIncidentes'), {
        useCORS: true,
        allowTaint: false,
        scale: 2,
        backgroundColor: '#ffffff'
      });

      const link = document.createElement('a');
      const currentDate = new Date().toISOString().slice(0, 10);
      const filterText = this.currentTypeFilter === 'all' ? 'todos' : this.currentTypeFilter;
      
      link.download = `mapa-siniestros-${filterText}-${currentDate}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();

      this.mostrarNotificacion('Imagen PNG descargada', 'success');
    } catch (error) {
      console.error('Error al generar imagen:', error);
      this.mostrarNotificacion('Error al generar imagen', 'error');
    } finally {
      elementsToHide.forEach(el => el.style.display = '');
      this.ocultarProgreso();
    }
  }

  descargarMapaKML() {
    this.mostrarProgreso('Generando KML...');
    
    const currentDate = new Date().toISOString().slice(0, 10);
    const filterText = this.currentTypeFilter === 'all' ? 'todos' : this.currentTypeFilter;
    
    let kmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Siniestros Viales - ${filterText}</name>`;

    this.filteredIncidentsData.forEach((row, index) => {
      const coords = this.validarCoordenadas(row[27]); // Columna 27 = COORDENADAS
      if (coords) {
        const descripcion = (row[30] || 'Sin descripción').replace(/[<>&"']/g, function(m) {
          return {'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[m];
        });
        
        kmlContent += `
    <Placemark>
      <name>Siniestro ${index + 1}</name>
      <description>${descripcion}</description>
      <Point>
        <coordinates>${coords.lng},${coords.lat},0</coordinates>
      </Point>
    </Placemark>`;
      }
    });

    kmlContent += `
  </Document>
</kml>`;

    const blob = new Blob([kmlContent], { type: 'application/vnd.google-earth.kml+xml' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `siniestros-${filterText}-${currentDate}.kml`;
    link.click();
    
    this.ocultarProgreso();
    this.mostrarNotificacion('KML descargado', 'success');
  }

  descargarMapaGeoJSON() {
    this.mostrarProgreso('Generando GeoJSON...');
    
    const currentDate = new Date().toISOString().slice(0, 10);
    const filterText = this.currentTypeFilter === 'all' ? 'todos' : this.currentTypeFilter;
    
    const geoJsonData = {
      type: "FeatureCollection",
      name: `Siniestros Viales - ${filterText}`,
      features: []
    };

    this.filteredIncidentsData.forEach((row, index) => {
      const coords = this.validarCoordenadas(row[27]); // Columna 27 = COORDENADAS
      if (coords) {
        geoJsonData.features.push({
          type: "Feature",
          properties: {
            id: index + 1,
            fecha: row[1] || '',          // Columna 1 = FECHA_SINIESTRO
            municipio: row[0] || '',      // Columna 0 = MUNICIPIO
            tipo: row[7] || '',           // Columna 7 = TIPO_SINIESTRO
            causa: row[8] || '',          // Columna 8 = CAUSA_SINIESTRO
            vialidad: row[25] || '',      // Columna 25 = TIPO_VIALIDAD
            usuarios: row[22] || '0',     // Columna 22 = TOTAL_USUARIOS
            fallecidos: row[23] || '0'    // Columna 23 = TOTAL_FALLECIDOS
          },
          geometry: {
            type: "Point",
            coordinates: [coords.lng, coords.lat]
          }
        });
      }
    });

    const blob = new Blob([JSON.stringify(geoJsonData, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `siniestros-${filterText}-${currentDate}.geojson`;
    link.click();
    
    this.ocultarProgreso();
    this.mostrarNotificacion('GeoJSON descargado', 'success');
  }

  descargarMapaCSV() {
    this.mostrarProgreso('Generando CSV...');
    
    const currentDate = new Date().toISOString().slice(0, 10);
    const filterText = this.currentTypeFilter === 'all' ? 'todos' : this.currentTypeFilter;
    
    const headers = [
      'ID', 'Fecha', 'Municipio', 'Tipo', 'Causa', 
      'Vialidad', 'Usuarios', 'Fallecidos', 'Latitud', 'Longitud'
    ];
    
    let csvContent = headers.join(',') + '\n';
    
    this.filteredIncidentsData.forEach((row, index) => {
      const coords = this.validarCoordenadas(row[27]); // Columna 27 = COORDENADAS
      if (coords) {
        const escapeCSV = (value) => {
          if (!value) return '';
          const str = String(value).replace(/"/g, '""');
          return str.includes(',') ? `"${str}"` : str;
        };
        
        const csvRow = [
          index + 1,
          escapeCSV(row[1] || ''),      // Columna 1 = FECHA_SINIESTRO
          escapeCSV(row[0] || ''),      // Columna 0 = MUNICIPIO
          escapeCSV(row[7] || ''),      // Columna 7 = TIPO_SINIESTRO
          escapeCSV(row[8] || ''),      // Columna 8 = CAUSA_SINIESTRO
          escapeCSV(row[25] || ''),     // Columna 25 = TIPO_VIALIDAD
          escapeCSV(row[22] || '0'),    // Columna 22 = TOTAL_USUARIOS
          escapeCSV(row[23] || '0'),    // Columna 23 = TOTAL_FALLECIDOS
          coords.lat,
          coords.lng
        ];
        
        csvContent += csvRow.join(',') + '\n';
      }
    });
    
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { 
      type: 'text/csv;charset=utf-8' 
    });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `siniestros-${filterText}-${currentDate}.csv`;
    link.click();
    
    this.ocultarProgreso();
    this.mostrarNotificacion('CSV descargado', 'success');
  }

  // ============================================================
  // NOTIFICACIONES
  // ============================================================
  
  mostrarNotificacion(mensaje, tipo = 'info', duracion = 5000) {
    const existingNotifications = document.querySelectorAll('.notification');
    if (existingNotifications.length >= 3) {
      existingNotifications[0].remove();
    }

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

  mostrarProgreso(texto = 'Procesando...', subtexto = '') {
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

  ocultarProgreso() {
    const progressDiv = document.getElementById('progressIndicator');
    if (progressDiv) {
      progressDiv.classList.remove('show');
    }
  }

  // ============================================================
  // UTILIDADES
  // ============================================================
  
  poblarFiltros() {
    const municipios = [...new Set(this.allIncidentsData.map(row => row[0]).filter(m => m))].sort();
    const selectMunicipio = document.getElementById('filtroMunicipio');
    
    if (selectMunicipio) {
      selectMunicipio.innerHTML = '<option value="">Todos los municipios</option>';
      municipios.forEach(municipio => {
        const option = document.createElement('option');
        option.value = municipio;
        option.textContent = municipio;
        selectMunicipio.appendChild(option);
      });
    }
  }

  bindEvents() {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const modals = document.querySelectorAll('.modal-overlay');
        modals.forEach(modal => {
          if (modal.style.display === 'flex') {
            modal.style.display = 'none';
          }
        });
      }
      
      if (e.ctrlKey && e.key === 'd') {
        e.preventDefault();
        this.mostrarModalDescarga();
      }
    });

    setInterval(() => {
      console.log("Actualizando datos automáticamente...");
      this.cargarDatosMapaCalor(true);
    }, 5 * 60 * 1000);
  }
}

// ============================================================
// VARIABLES GLOBALES Y FUNCIONES
// ============================================================

let mapaInstance;

window.toggleLegend = function() {
  const content = document.getElementById('legendContent');
  const icon = document.getElementById('legendToggleIcon');
  const panel = document.querySelector('.legend-panel');
  
  if (content.classList.contains('collapsed')) {
    content.classList.remove('collapsed');
    panel.classList.remove('collapsed');
    icon.className = 'fas fa-chevron-up';
  } else {
    content.classList.add('collapsed');
    panel.classList.add('collapsed');
    icon.className = 'fas fa-chevron-down';
  }
};

window.toggleLayerSelector = function() {
  const content = document.getElementById('layerContent');
  const icon = document.getElementById('layerToggleIcon');
  const selector = document.getElementById('layerSelector');
  
  if (content.classList.contains('collapsed')) {
    content.classList.remove('collapsed');
    selector.classList.remove('collapsed');
    icon.className = 'fas fa-chevron-up';
  } else {
    content.classList.add('collapsed');
    selector.classList.add('collapsed');
    icon.className = 'fas fa-chevron-down';
  }
};

window.filterByType = function(type) {
  if (mapaInstance) {
    mapaInstance.filterByType(type);
  }
};

window.changeMapLayer = function(layerKey, element) {
  if (mapaInstance) {
    mapaInstance.changeMapLayer(layerKey, element);
  }
};

window.toggleHeatmapView = function() {
  if (mapaInstance) {
    mapaInstance.toggleHeatmapView();
  }
};

window.toggleMarkersView = function() {
  if (mapaInstance) {
    mapaInstance.toggleMarkersView();
  }
};

window.toggleZonasPeligrosas = function() {
  if (mapaInstance) {
    mapaInstance.toggleZonasPeligrosas();
  }
};

window.centrarMapa = function() {
  if (mapaInstance) {
    mapaInstance.centrarMapa();
  }
};

window.mostrarModalDescarga = function() {
  if (mapaInstance) {
    mapaInstance.mostrarModalDescarga();
  }
};

window.cerrarModalDescarga = function() {
  if (mapaInstance) {
    mapaInstance.cerrarModalDescarga();
  }
};

window.descargarMapa = function(formato) {
  if (mapaInstance) {
    mapaInstance.descargarMapa(formato);
  }
};

window.cambiarTipoPeriodo = function() {
  if (!mapaInstance) return;
  
  const tipoPeriodo = document.getElementById('tipoPeriodo')?.value || 'todos';
  mapaInstance.tipoPeriodoFilter = tipoPeriodo;
  
  if (tipoPeriodo === 'todos') {
    mapaInstance.periodoSeleccionado = '';
    mapaInstance.aplicarFiltros();
  } else {
    mapaInstance.actualizarSelectorPeriodo();
  }
};

window.aplicarFiltrosAvanzados = function() {
  if (!mapaInstance) return;
  
  mapaInstance.currentMunicipioFilter = document.getElementById('filtroMunicipio')?.value || '';
  mapaInstance.currentFallecidosFilter = parseInt(document.getElementById('minFallecidos')?.value || 0);
  mapaInstance.periodoSeleccionado = document.getElementById('selectorPeriodo')?.value || '';
  
  mapaInstance.aplicarFiltros();
};

window.limpiarFiltrosAvanzados = function() {
  if (!mapaInstance) return;
  
  document.getElementById('tipoPeriodo').value = 'todos';
  document.getElementById('filtroMunicipio').value = '';
  document.getElementById('minFallecidos').value = '0';
  document.getElementById('selectorPeriodoContainer').style.display = 'none';
  
  mapaInstance.tipoPeriodoFilter = 'todos';
  mapaInstance.periodoSeleccionado = '';
  mapaInstance.currentMunicipioFilter = '';
  mapaInstance.currentFallecidosFilter = 0;
  mapaInstance.currentTypeFilter = 'all';
  
  document.querySelectorAll('.legend-item').forEach(item => {
    item.classList.remove('active');
  });
  document.querySelector('.legend-all')?.classList.add('active');
  
  mapaInstance.aplicarFiltros();
  mapaInstance.mostrarNotificacion('Filtros limpiados', 'info', 2000);
};

// ============================================================
// INICIALIZACIÓN
// ============================================================

document.addEventListener("DOMContentLoaded", function () {
  console.log("Inicializando mapa de siniestros...");
  
  try {
    mapaInstance = new MapaIncidentes();
    mapaInstance.cargarDatosMapaCalor(false);
    
    const modalDescarga = document.getElementById('modalDescarga');
    if (modalDescarga) {
      modalDescarga.addEventListener('click', function(e) {
        if (e.target === this) {
          this.style.display = 'none';
        }
      });
    }
    
    setTimeout(() => {
      mapaInstance.mostrarNotificacion('Sistema cargado correctamente', 'success', 3000);
    }, 1000);
    
    console.log("Sistema inicializado");
    
  } catch (error) {
    console.error("Error al inicializar:", error);
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'notification error';
    errorDiv.innerHTML = `
      <div>Error al inicializar. Por favor, recarga la página.</div>
      <button class="close-btn" onclick="this.parentElement.remove()">&times;</button>
    `;
    document.body.appendChild(errorDiv);
  }
});