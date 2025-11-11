/* ============================================================
   INDEX.JS PROFESIONAL - SIN EFECTOS DE FLOTACIÓN
   Sistema de Siniestros Viales - Estado de Chiapas
   ============================================================ */

// ============================================================
// CONFIGURACIÓN GLOBAL
// ============================================================
const MAIN_API_URL = "https://script.google.com/macros/s/AKfycbzLTG8Zo1ayJMapz6rHXK0mUrnLhs6Ar0uk_06DBqhxww0fySCUgZa_u0yubKCbV1deJA/exec";

let mapaCalor = null;
let heatLayer = null;

// ============================================================
// ANIMACIÓN DE CONTEO PARA NÚMEROS
// ============================================================
function animarConteo(elemento, valorFinal, duracion = 1500) {
  const elementoDOM = document.getElementById(elemento);
  if (!elementoDOM) return;
  
  const valorInicial = 0;
  const incremento = valorFinal / (duracion / 16); // 60 FPS
  let valorActual = valorInicial;
  
  const timer = setInterval(() => {
    valorActual += incremento;
    
    if (valorActual >= valorFinal) {
      elementoDOM.textContent = valorFinal.toLocaleString();
      clearInterval(timer);
    } else {
      elementoDOM.textContent = Math.floor(valorActual).toLocaleString();
    }
  }, 16);
}

// ============================================================
// OBSERVER PARA ANIMACIONES AL SCROLL (SIN FLOTACIÓN)
// ============================================================
function inicializarAnimacionesScroll() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -30px 0px'
  });

  // Observar elementos que necesitan animación
  document.querySelectorAll('.tarjeta, .stat-item, .info-item').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
    observer.observe(el);
  });
}

// ============================================================
// VALIDACIÓN DE COORDENADAS PARA TODO CHIAPAS
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

// ============================================================
// FUNCIÓN ALTERNATIVA - VALIDACIÓN MÁS FLEXIBLE
// ============================================================
function validarCoordenadasFlexible(coordStr) {
  if (!coordStr || typeof coordStr !== 'string') return null;
  
  const parts = coordStr.split(",");
  if (parts.length !== 2) return null;
  
  const lat = parseFloat(parts[0].trim());
  const lng = parseFloat(parts[1].trim());
  
  // Validación básica para coordenadas válidas de México
  if (isNaN(lat) || isNaN(lng) || 
      lat < 12 || lat > 20 ||         // Límites más amplios para incluir toda la región
      lng < -96 || lng > -88) {       // Incluye áreas vecinas por si hay datos cerca
    return null;
  }
  
  return { lat, lng };
}

// ============================================================
// LÍMITES ESPECÍFICOS DE CHIAPAS COMO CONSTANTES
// ============================================================
const CHIAPAS_LIMITS = {
  LAT_MIN: 14.2,  // Frontera sur con Guatemala
  LAT_MAX: 17.8,  // Frontera norte con Tabasco
  LNG_MIN: -94.8, // Frontera oeste con Oaxaca/Veracruz
  LNG_MAX: -90.2  // Frontera este con Guatemala
};

function validarCoordenadasChiapas(coordStr) {
  if (!coordStr || typeof coordStr !== 'string') return null;
  
  const parts = coordStr.split(",");
  if (parts.length !== 2) return null;
  
  const lat = parseFloat(parts[0].trim());
  const lng = parseFloat(parts[1].trim());
  
  if (isNaN(lat) || isNaN(lng) || 
      lat < CHIAPAS_LIMITS.LAT_MIN || lat > CHIAPAS_LIMITS.LAT_MAX || 
      lng < CHIAPAS_LIMITS.LNG_MIN || lng > CHIAPAS_LIMITS.LNG_MAX) {
    return null;
  }
  
  return { lat, lng };
}
// ============================================================
// CARGAR ESTADÍSTICAS RÁPIDAS CON ANIMACIONES
// ============================================================
async function cargarEstadisticasRapidas() {
  try {
    console.log('🔄 Cargando estadísticas del sistema...');
    
    const response = await fetch(MAIN_API_URL);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`📊 Datos recibidos: ${data.length} incidentes`);
    
    // Animar total de incidentes
    setTimeout(() => {
      animarConteo('totalIncidentes', data.length, 1500);
    }, 300);
    
    // Incidentes de este mes
    const mesActual = new Date().getMonth() + 1;
    const añoActual = new Date().getFullYear();
    
    const incidentesMes = data.filter(row => {
      const fechaStr = row[1];
      if (!fechaStr) return false;
      
      const fecha = new Date(fechaStr.split(' ')[0]);
      if (isNaN(fecha)) return false;
      
      return fecha.getMonth() + 1 === mesActual && fecha.getFullYear() === añoActual;
    }).length;
    
    // Animar incidentes del mes
    setTimeout(() => {
      animarConteo('incidentesMes', incidentesMes, 1500);
    }, 500);
    
    // Última actualización
    setTimeout(() => {
      const fechaActual = new Date();
      const opciones = { year: 'numeric', month: 'long', day: 'numeric' };
      const fechaFormateada = fechaActual.toLocaleDateString('es-MX', opciones);
      
      const elemento = document.getElementById('ultimaActualizacion');
      if (elemento) {
        elemento.style.opacity = '0';
        elemento.textContent = fechaFormateada;
        
        setTimeout(() => {
          elemento.style.transition = 'opacity 0.4s ease';
          elemento.style.opacity = '1';
        }, 100);
      }
    }, 700);
    
    // Cargar mapa de calor
    cargarMapaCalor(data);
    
    console.log('✅ Estadísticas cargadas correctamente');
    
  } catch (error) {
    console.error('❌ Error cargando estadísticas:', error);
    
    // Mostrar N/A en caso de error
    document.querySelectorAll('.stat-numero').forEach((el, index) => {
      setTimeout(() => {
        el.style.transition = 'all 0.3s ease';
        el.textContent = 'N/A';
      }, index * 100);
    });
    
    // Mostrar error en el mapa
    const mapContainer = document.getElementById('mapaCalorPreview');
    if (mapContainer) {
      mapContainer.style.opacity = '0';
      mapContainer.innerHTML = `
        <div style="text-align: center; color: #f44336; padding: 40px;">
          <i class="fas fa-exclamation-circle" style="font-size: 3em; margin-bottom: 15px;"></i>
          <p style="font-weight: 600; margin: 0; font-size: 18px;">Error al cargar los datos</p>
          <p style="font-size: 14px; color: #666; margin-top: 10px;">Por favor, recarga la página</p>
        </div>
      `;
      
      setTimeout(() => {
        mapContainer.style.transition = 'opacity 0.4s ease';
        mapContainer.style.opacity = '1';
      }, 100);
    }
  }
}

// ============================================================
// CARGAR MAPA DE CALOR
// ============================================================
function cargarMapaCalor(data) {
  try {
    console.log('🗺️ Inicializando mapa de calor...');
    
    // Ocultar indicador de carga con animación
    const loadingDiv = document.querySelector('.mapa-loading');
    if (loadingDiv) {
      loadingDiv.style.transition = 'opacity 0.3s ease';
      loadingDiv.style.opacity = '0';
      
      setTimeout(() => {
        loadingDiv.style.display = 'none';
      }, 300);
    }
    
    // Verificar que el contenedor existe
    const mapContainer = document.getElementById('mapaCalorPreview');
    if (!mapContainer) {
      console.error('❌ Contenedor del mapa no encontrado');
      return;
    }
    
    // Inicializar mapa con Leaflet
    mapaCalor = L.map('mapaCalorPreview', {
      zoomControl: true,
      dragging: true,
      scrollWheelZoom: false,
      doubleClickZoom: true,
      touchZoom: true,
      fadeAnimation: true,
      zoomAnimation: true,
      markerZoomAnimation: true
    }).setView([16.75, -93.12], 11);
    
    // Agregar capa base
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(mapaCalor);
    
    // Preparar puntos para el mapa de calor
    const heatPoints = [];
    let puntosValidos = 0;
    
    data.forEach(row => {
      const coords = validarCoordenadas(row[27]);
      
      if (coords) {
        // Calcular intensidad basada en fallecidos
        const fallecidos = parseInt(row[23] || 0);
        const intensidad = 1 + (fallecidos * 0.5);
        
        heatPoints.push([coords.lat, coords.lng, intensidad]);
        puntosValidos++;
      }
    });
    
    console.log(`📍 Puntos válidos para el mapa: ${puntosValidos}`);
    
    // Crear y agregar capa de calor si hay puntos
    if (heatPoints.length > 0) {
      heatLayer = L.heatLayer(heatPoints, {
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
      }).addTo(mapaCalor);
      
      console.log(`✅ Mapa de calor cargado con ${heatPoints.length} puntos`);
    } else {
      console.warn('⚠️ No se encontraron puntos válidos para el mapa de calor');
      
      mapContainer.innerHTML = `
        <div style="text-align: center; color: #ff9800; padding: 40px;">
          <i class="fas fa-info-circle" style="font-size: 3em; margin-bottom: 15px;"></i>
          <p style="font-weight: 600; margin: 0; font-size: 18px;">No hay datos para mostrar</p>
          <p style="font-size: 14px; color: #666; margin-top: 10px;">Aún no se han registrado incidentes</p>
        </div>
      `;
    }
    
  } catch (error) {
    console.error('❌ Error al inicializar mapa de calor:', error);
    
    const mapContainer = document.getElementById('mapaCalorPreview');
    if (mapContainer) {
      mapContainer.innerHTML = `
        <div style="text-align: center; color: #f44336; padding: 40px;">
          <i class="fas fa-exclamation-triangle" style="font-size: 3em; margin-bottom: 15px;"></i>
          <p style="font-weight: 600; margin: 0; font-size: 18px;">Error al cargar el mapa</p>
          <p style="font-size: 14px; color: #666; margin-top: 10px;">${error.message}</p>
        </div>
      `;
    }
  }
}

// ============================================================
// MARCAR MENÚ ACTIVO
// ============================================================
function marcarMenuActivo() {
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  
  document.querySelectorAll('nav a').forEach(link => {
    link.classList.remove('active');
    
    if (link.href.includes(currentPage)) {
      link.classList.add('active');
    }
  });
}

// ============================================================
// EFECTO RIPPLE EN TARJETAS
// ============================================================
function inicializarEfectosTarjetas() {
  document.querySelectorAll('.tarjeta').forEach(tarjeta => {
    tarjeta.addEventListener('click', function(e) {
      const rect = this.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const ripple = document.createElement('div');
      ripple.style.cssText = `
        position: absolute;
        width: 10px;
        height: 10px;
        background: rgba(25,118,210,0.4);
        border-radius: 50%;
        pointer-events: none;
        left: ${x}px;
        top: ${y}px;
        transform: translate(-50%, -50%) scale(0);
        transition: transform 0.5s ease, opacity 0.5s ease;
        opacity: 1;
      `;
      
      this.appendChild(ripple);
      
      setTimeout(() => {
        ripple.style.transform = 'translate(-50%, -50%) scale(50)';
        ripple.style.opacity = '0';
      }, 10);
      
      setTimeout(() => {
        ripple.remove();
      }, 500);
    });
  });
}

// ============================================================
// SMOOTH SCROLL PARA NAVEGACIÓN
// ============================================================
function inicializarSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });
}

// ============================================================
// INICIALIZACIÓN
// ============================================================
document.addEventListener('DOMContentLoaded', function() {
  console.log('🚀 Inicializando página principal...');
  
  // Animación inicial del body
  document.body.style.opacity = '0';
  setTimeout(() => {
    document.body.style.transition = 'opacity 0.4s ease';
    document.body.style.opacity = '1';
  }, 100);
  
  // Cargar estadísticas y mapa
  cargarEstadisticasRapidas();
  
  // Marcar menú activo
  marcarMenuActivo();
  
  // Inicializar efectos después de un pequeño delay
  setTimeout(() => {
    inicializarAnimacionesScroll();
    inicializarEfectosTarjetas();
    inicializarSmoothScroll();
  }, 300);
  
  console.log('✅ Página principal inicializada correctamente');
});

