/* ============================================================
   REGISTRO.JS - VERSIÓN CORREGIDA PARA CLOUDINARY
   Sistema limpio sin duplicaciones
   ============================================================ */

document.addEventListener("DOMContentLoaded", function () {
  
  /* ============================================================
     VARIABLES GLOBALES
     ============================================================ */
  let fotografiasCloudinary = [];
  let cloudinaryWidget = null;
  let datosFormularioTemp = null;
  let marker = null;
  
  // URLs de las APIs
  const CONDUCTOR_API_URL = "https://script.google.com/macros/s/AKfycbykye6xD9ou9XTBnFLzIdnwItVQw4vRixPn9DnjILFHYsSBTqi8h8LG1eeLccLYXXqQ/exec";
  const REGISTRO_API_URL = "https://script.google.com/macros/s/AKfycbyMXD3ZSFCE_GrZ0ahuT3b2w9zKJysAAsHdyJn-l1NvF4wOn6p43B6mVaOqg5V5oahFrQ/exec"; 

  // Configuración de Cloudinary
  const CLOUDINARY_CONFIG = {
    cloudName: 'DS04HXGCP', // Tu cloud name
    uploadPreset: 'siniestros_viales', // Tu upload preset
    folder: 'siniestros-viales',
    maxFiles: 2,
    maxFileSize: 10000000, // 10MB
    sources: ['local', 'camera'],
    multiple: true,
    clientAllowedFormats: ['jpg', 'jpeg', 'png', 'webp']
  };

  /* ============================================================
     FUNCIONES DE UTILIDAD
     ============================================================ */
  
  function mostrarNotificacion(mensaje, tipo = 'info', duracion = 5000) {
    // Remover notificaciones existentes
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(n => n.remove());

    const notification = document.createElement('div');
    notification.className = `notification ${tipo}`;
    notification.innerHTML = `
      <div class="notification-content">
        <i class="fas ${tipo === 'success' ? 'fa-check-circle' : tipo === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
        <span>${mensaje}</span>
        <button class="notification-close" onclick="this.parentElement.parentElement.remove()">&times;</button>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      if (document.body.contains(notification)) {
        notification.remove();
      }
    }, duracion);
  }

  function mostrarProgreso(texto, subtexto = '') {
    // Asegurarse de que solo hay un indicador
    ocultarProgreso();
    
    const progressDiv = document.createElement('div');
    progressDiv.id = 'progressIndicator';
    progressDiv.innerHTML = `
      <div class="progress-backdrop">
        <div class="progress-modal">
          <div class="progress-spinner"></div>
          <div class="progress-text">${texto}</div>
          ${subtexto ? `<div class="progress-subtext">${subtexto}</div>` : ''}
        </div>
      </div>
    `;
    
    document.body.appendChild(progressDiv);
    
    // Pequeño delay para la animación
    setTimeout(() => {
      progressDiv.classList.add('show');
    }, 10);
  }

  function ocultarProgreso() {
    const progressDiv = document.getElementById('progressIndicator');
    if (progressDiv) {
      progressDiv.remove();
    }
  }

  /* ============================================================
     CONFIGURACIÓN DEL MAPA - CORREGIDA
     ============================================================ */
  const map = L.map('mapa').setView([16.75, -93.12], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(map);

  map.on('click', async function(e) {
    const lat = e.latlng.lat.toFixed(6);
    const lng = e.latlng.lng.toFixed(6);

    const campoCoordenadas = document.getElementById('coordenadas');
    if (campoCoordenadas) campoCoordenadas.value = `${lat}, ${lng}`;

    if (marker) {
      marker.setLatLng(e.latlng);
    } else {
      marker = L.marker(e.latlng).addTo(map);
    }

    try {
      mostrarProgreso('Obteniendo dirección...', 'Por favor espera');
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`);
      const data = await res.json();
      const addressInput = document.getElementById('direccion');
      if (addressInput) {
        addressInput.value = data.display_name || '';
      }
      ocultarProgreso();
    } catch (err) {
      console.warn("No se pudo obtener la dirección:", err);
      ocultarProgreso();
      mostrarNotificacion('No se pudo obtener la dirección', 'warning');
    }
  });

  /* ============================================================
     CLOUDINARY - VERSIÓN SIMPLIFICADA
     ============================================================ */
  
  function inicializarCloudinary() {
    if (!window.cloudinary) {
      console.error("Cloudinary no está cargado");
      mostrarNotificacion('Error: Cloudinary no disponible', 'error');
      return;
    }
    
    cloudinaryWidget = cloudinary.createUploadWidget(
      {
        cloudName: CLOUDINARY_CONFIG.cloudName,
        uploadPreset: CLOUDINARY_CONFIG.uploadPreset,
        sources: CLOUDINARY_CONFIG.sources,
        maxFiles: CLOUDINARY_CONFIG.maxFiles,
        maxFileSize: CLOUDINARY_CONFIG.maxFileSize,
        folder: `${CLOUDINARY_CONFIG.folder}/${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, '0')}`,
        clientAllowedFormats: CLOUDINARY_CONFIG.clientAllowedFormats,
        multiple: true,
        theme: 'white',
        styles: {
          palette: {
            window: "#FFFFFF",
            windowBorder: "#1976d2",
            tabIcon: "#1976d2",
            menuIcons: "#1976d2",
            textDark: "#333333",
            textLight: "#FFFFFF",
            link: "#1976d2",
            action: "#1976d2",
            inactiveTabIcon: "#999999",
            error: "#F44336",
            inProgress: "#1976d2",
            complete: "#4CAF50",
            sourceBg: "#F5F5F5"
          }
        }
      },
      (error, result) => {
        if (!error && result && result.event === "success") {
          console.log("Imagen subida a Cloudinary:", result.info);
          procesarImagenCloudinary(result.info);
        }
        
        if (error) {
          console.error("Error en Cloudinary:", error);
          mostrarNotificacion('Error al subir imagen: ' + error.message, 'error');
        }
      }
    );
    
    console.log("Widget de Cloudinary inicializado");
  }

  function procesarImagenCloudinary(info) {
    if (fotografiasCloudinary.length >= 2) {
      mostrarNotificacion('Máximo 2 fotografías permitidas', 'error');
      return;
    }
    
    const fotoCloudinary = {
      public_id: info.public_id,
      secure_url: info.secure_url,
      url: info.url,
      format: info.format,
      bytes: info.bytes,
      width: info.width,
      height: info.height,
      original_filename: info.original_filename,
      created_at: info.created_at,
      folder: info.folder,
      // Para compatibilidad
      name: info.original_filename,
      preview: info.secure_url,
      size: info.bytes,
      type: `image/${info.format}`
    };
    
    fotografiasCloudinary.push(fotoCloudinary);
    
    console.log(`Foto ${fotografiasCloudinary.length}/2 agregada a Cloudinary`);
    mostrarNotificacion(`Imagen "${info.original_filename}" subida correctamente`, 'success');
    
    mostrarVistaPrevia();
    actualizarContadorFotos();
  }

  function mostrarVistaPrevia() {
    const filePreview = document.getElementById('filePreview');
    if (!filePreview) return;
    filePreview.innerHTML = '';
    
    fotografiasCloudinary.forEach((foto, index) => {
      const previewItem = document.createElement('div');
      previewItem.className = 'file-preview-item';
      
      const previewUrl = foto.secure_url ? 
        `${foto.secure_url.replace('/upload/', '/upload/w_200,h_150,c_fill,q_auto,f_auto/')}` : 
        foto.preview;
      
      const tamaño = foto.bytes ? 
        (foto.bytes / 1024 / 1024).toFixed(2) : 
        (foto.size / 1024 / 1024).toFixed(2);
      
      previewItem.innerHTML = `
        <img src="${previewUrl}" alt="${foto.name}" loading="lazy">
        <div class="file-preview-info">
          <div class="file-preview-name">${foto.name}</div>
          <div class="file-preview-size">${tamaño} MB</div>
          <div class="cloudinary-badge">☁️ Cloudinary</div>
        </div>
        <button type="button" class="file-remove" onclick="eliminarFoto(${index})">
          <i class="fas fa-times"></i>
        </button>
      `;
      filePreview.appendChild(previewItem);
    });
  }

  function actualizarContadorFotos() {
    const fileUploadArea = document.getElementById('fileUploadArea');
    if (!fileUploadArea) return;
    
    let contador = fileUploadArea.querySelector('.foto-contador');
    if (!contador) {
      contador = document.createElement('div');
      contador.className = 'foto-contador';
      fileUploadArea.appendChild(contador);
    }
    
    contador.innerHTML = `${fotografiasCloudinary.length}/2 fotos`;
    
    if (fotografiasCloudinary.length >= 2) {
      fileUploadArea.style.opacity = '0.7';
      fileUploadArea.style.pointerEvents = 'none';
      
      let mensaje = fileUploadArea.querySelector('.limite-mensaje');
      if (!mensaje) {
        mensaje = document.createElement('div');
        mensaje.className = 'limite-mensaje';
        mensaje.textContent = 'Límite alcanzado';
        fileUploadArea.appendChild(mensaje);
      }
    } else {
      fileUploadArea.style.opacity = '1';
      fileUploadArea.style.pointerEvents = 'auto';
      
      const mensaje = fileUploadArea.querySelector('.limite-mensaje');
      if (mensaje) mensaje.remove();
    }
  }

  window.eliminarFoto = function(index) {
    console.log(`Eliminando foto ${index}`);
    fotografiasCloudinary.splice(index, 1);
    mostrarVistaPrevia();
    actualizarContadorFotos();
    mostrarNotificacion(`Imagen eliminada`, 'info');
  };

  // Configurar área de subida
  const fileUploadArea = document.getElementById('fileUploadArea');
  if (fileUploadArea) {
    fileUploadArea.addEventListener('click', function() {
      if (fotografiasCloudinary.length >= 2) {
        mostrarNotificacion('Máximo 2 fotografías permitidas', 'error');
        return;
      }
      
      if (!cloudinaryWidget) {
        mostrarNotificacion('Inicializando Cloudinary...', 'info');
        inicializarCloudinary();
        setTimeout(() => {
          if (cloudinaryWidget) {
            cloudinaryWidget.open();
          }
        }, 1000);
      } else {
        cloudinaryWidget.open();
      }
    });
  }

  /* ============================================================
     FUNCIONES AUXILIARES DEL FORMULARIO
     ============================================================ */

  window.mostrarOtraDependencia = function() {
    const seleccion = document.getElementById("dependenciaSelect")?.value || '';
    const otraDiv = document.getElementById("otraDependenciaDiv");
    if (otraDiv) {
      otraDiv.style.display = seleccion === "Otra" ? "block" : "none";
    }
  };

  window.mostrarLink = function() {
    const fuente = document.getElementById("fuenteNoticia")?.value || '';
    const campoLink = document.getElementById("linkNoticia");
    if (campoLink) {
      campoLink.style.display = fuente === "Noticia" ? "block" : "none";
    }
  };

  document.querySelectorAll('select[name="Usuario_involucrado (1)"], select[name="Usuario_involucrado (2)"]').forEach(select => {
    select.addEventListener('change', () => {
      const valor1 = document.querySelector('select[name="Usuario_involucrado (1)"]')?.value || '';
      const valor2 = document.querySelector('select[name="Usuario_involucrado (2)"]')?.value || '';
      const mostrar = valor1 === "Chofer de transporte público" || valor2 === "Chofer de transporte público";

      const transporteDiv = document.getElementById("transportePublicoDiv");
      if (transporteDiv) transporteDiv.style.display = mostrar ? "block" : "none";

      if (!mostrar) {
        const datosDiv = document.getElementById("datosConductorDiv");
        if (datosDiv) datosDiv.style.display = "none";
      }
    });
  });

  window.buscarConductor = function() {
    const placaInput = document.getElementById("placaTransporte");
    if (!placaInput) return;
    
    const placa = placaInput.value.trim().toUpperCase();
    if (!placa) {
      mostrarNotificacion("Ingresa una placa", 'error');
      return;
    }

    mostrarProgreso('Buscando conductor...');

    fetch(CONDUCTOR_API_URL + "?placa=" + encodeURIComponent(placa))
      .then(res => res.json())
      .then(data => {
        ocultarProgreso();
        const datosDiv = document.getElementById("datosConductorDiv");
        
        if (data && data.Placa && datosDiv) {
          datosDiv.style.display = "block";
          
          const campos = {
            "campoConcesionado": data.Concesionado || "",
            "campoNoEconomico": data["No.  Económico"] || "",
            "campoConcesion": data.Concesión || "",
            "campoModalidad": data.Modalidad || "",
            "campoPlaca": data.Placa || "",
            "campoMarca": data.Marca || "",
            "campoTipo": data.Tipo || "",
            "campoMotor": data.Motor || "",
            "campoSerie": data.Serie || "",
            "campoModelo": data.Modelo || ""
          };
          
          Object.entries(campos).forEach(([id, valor]) => {
            const campo = document.getElementById(id);
            if (campo) campo.value = valor;
          });
          
          mostrarNotificacion("Conductor encontrado", 'success');
        } else {
          mostrarNotificacion("Placa no encontrada", 'error');
          if (datosDiv) datosDiv.style.display = "none";
        }
      })
      .catch(error => {
        console.error("Error:", error);
        ocultarProgreso();
        mostrarNotificacion("Error al buscar conductor", 'error');
      });
  };

  /* ============================================================
     ENVÍO DEL FORMULARIO CON CLOUDINARY
     ============================================================ */

  async function enviarFormularioCompleto(datos) {
    const mensaje = document.getElementById("respuesta");
    const submitBtn = document.querySelector('button[type="submit"]');
    const originalText = submitBtn ? submitBtn.innerHTML : '';
    
    if (submitBtn) {
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
      submitBtn.disabled = true;
    }
    
    const esForzado = datos.get('forzar_insercion') === 'true';
    mostrarProgreso(esForzado ? 'Forzando envío...' : 'Enviando registro...', 'Procesando datos');
    
    try {
      console.log("Enviando a:", REGISTRO_API_URL);
      console.log("Fotos Cloudinary:", fotografiasCloudinary.length);
      
      // Agregar URLs de Cloudinary al FormData
      fotografiasCloudinary.forEach((foto, index) => {
        datos.append(`cloudinary_url_${index}`, foto.secure_url);
        datos.append(`cloudinary_public_id_${index}`, foto.public_id);
        datos.append(`cloudinary_filename_${index}`, foto.original_filename);
        datos.append(`cloudinary_size_${index}`, foto.bytes.toString());
        datos.append(`cloudinary_format_${index}`, foto.format);
        datos.append(`cloudinary_width_${index}`, foto.width.toString());
        datos.append(`cloudinary_height_${index}`, foto.height.toString());
      });
      
      datos.append('numeroFotografias', fotografiasCloudinary.length.toString());
      datos.append('origen_fotos', 'cloudinary');
      datos.append('cloudinary_folder', `siniestros-viales/${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, '0')}`);
      
      const response = await fetch(REGISTRO_API_URL, {
        method: "POST",
        body: datos
      });
      
      console.log("Status:", response.status);
      
      const responseText = await response.text();
      console.log("Respuesta:", responseText.substring(0, 500));
      
      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch (parseError) {
        if (response.ok && responseText.includes('OK')) {
          responseData = { status: 'exito', mensaje: 'Registro guardado' };
        } else {
          throw new Error(responseText);
        }
      }
      
      ocultarProgreso();
      
      // Manejo de duplicados
      if (responseData.status === 'duplicado') {
        console.log("Duplicado detectado:", responseData.similitud + '%');
        mostrarModalDuplicados(datos, responseData);
        
        if (submitBtn) {
          submitBtn.innerHTML = originalText;
          submitBtn.disabled = false;
        }
        return;
      }
      
      // Éxito
      if (responseData.status === 'exito' || response.ok) {
        console.log("Envío exitoso");
        
        if (mensaje) {
          mensaje.innerHTML = `
            <div class="mensaje-exito">
              <i class="fas fa-check-circle"></i>
              <div>
                <strong>Registro enviado correctamente</strong>
                <p>Fotografías: ${fotografiasCloudinary.length}/2 almacenadas en Cloudinary</p>
                ${esForzado ? '<p><small>Duplicado forzado</small></p>' : ''}
              </div>
            </div>
          `;
        }
        
        mostrarNotificacion('Registro enviado correctamente', 'success');
        limpiarFormularioCompleto();
        
      } else {
        throw new Error(responseData.mensaje || 'Error desconocido');
      }
      
    } catch (error) {
      console.error("Error:", error);
      ocultarProgreso();
      
      if (mensaje) {
        mensaje.innerHTML = `
          <div class="mensaje-error">
            <i class="fas fa-exclamation-circle"></i>
            <div>
              <strong>Error al enviar</strong>
              <p>${error.message}</p>
            </div>
          </div>
        `;
      }
      mostrarNotificacion('Error al enviar el registro', 'error');
    } finally {
      if (submitBtn && !document.getElementById('modalDuplicados')?.style.display !== 'flex') {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
      }
    }
  }

  /* ============================================================
     MANEJO DEL FORMULARIO
     ============================================================ */
  const form = document.getElementById("formIncidente");
  if (form) {
    form.addEventListener("submit", async function(e) {
      e.preventDefault();
      
      console.log("Iniciando envío del formulario");
      
      // Validaciones
      const camposRequeridos = ['Municipio', 'Correo_Electronico', 'Fecha_del_siniestro'];
      let validacion = true;
      
      camposRequeridos.forEach(campo => {
        const elemento = document.querySelector(`[name="${campo}"]`);
        if (!elemento || !elemento.value.trim()) {
          mostrarNotificacion(`El campo ${campo.replace(/_/g, ' ')} es requerido`, 'error');
          validacion = false;
        }
      });
      
      if (fotografiasCloudinary.length > 2) {
        mostrarNotificacion('Máximo 2 fotografías', 'error');
        validacion = false;
      }
      
      if (!validacion) return;
      
      const datos = new FormData(form);
      enviarFormularioCompleto(datos);
    });
  }

  function limpiarFormularioCompleto() {
    const form = document.getElementById("formIncidente");
    if (form) form.reset();
    
    fotografiasCloudinary = [];
    mostrarVistaPrevia();
    actualizarContadorFotos();
    
    if (marker) {
      map.removeLayer(marker);
      marker = null;
    }
    
    const otraDepDiv = document.getElementById("otraDependenciaDiv");
    if (otraDepDiv) otraDepDiv.style.display = "none";
    
    const linkDiv = document.getElementById("linkNoticia");
    if (linkDiv) linkDiv.style.display = "none";
    
    const transporteDiv = document.getElementById("transportePublicoDiv");
    if (transporteDiv) transporteDiv.style.display = "none";
    
    const datosDiv = document.getElementById("datosConductorDiv");
    if (datosDiv) datosDiv.style.display = "none";
    
    const mensaje = document.getElementById("respuesta");
    if (mensaje) mensaje.innerHTML = '';
    
    console.log("Formulario limpiado");
  }

  /* ============================================================
     MODAL DE DUPLICADOS
     ============================================================ */

  function mostrarModalDuplicados(datosNuevos, respuestaServidor) {
    console.log("Mostrando modal de duplicados");
    
    datosFormularioTemp = datosNuevos;
    const modal = document.getElementById('modalDuplicados');
    
    if (!modal) {
      console.error("Modal no encontrado");
      return;
    }
    
    const similitud = respuestaServidor.similitud || 0;
    actualizarPuntuacionSimilitud(similitud);
    llenarComparacionRegistros(datosNuevos, respuestaServidor.registroExistente || {});
    
    modal.style.display = 'flex';
    
    setTimeout(() => {
      const content = modal.querySelector('.modal-content');
      if (content) {
        content.style.transform = 'scale(1)';
        content.style.opacity = '1';
      }
    }, 100);
  }

  function actualizarPuntuacionSimilitud(porcentaje) {
    const scoreText = document.getElementById('scoreText');
    const scoreFill = document.querySelector('.score-fill');
    
    if (scoreText) {
      scoreText.textContent = Math.round(porcentaje) + '%';
    }
    
    if (scoreFill) {
      const circumference = 2 * Math.PI * 45;
      const offset = circumference - (porcentaje / 100) * circumference;
      scoreFill.style.strokeDasharray = `${circumference} ${circumference}`;
      scoreFill.style.strokeDashoffset = offset;
      
      if (porcentaje >= 80) {
        scoreFill.style.stroke = '#dc3545';
      } else if (porcentaje >= 60) {
        scoreFill.style.stroke = '#ffc107';
      } else {
        scoreFill.style.stroke = '#28a745';
      }
    }
  }

  function llenarComparacionRegistros(datosNuevos, registroExistente) {
    const nuevoDiv = document.getElementById('nuevoRegistro');
    const existenteDiv = document.getElementById('registroExistente');
    
    if (!nuevoDiv || !existenteDiv) return;
    
    const campos = [
      { key: 'Municipio', label: 'Municipio', icon: 'fa-city', index: 0 },
      { key: 'Fecha_del_siniestro', label: 'Fecha', icon: 'fa-calendar', index: 1 },
      { key: 'Tipo_de_siniestro', label: 'Tipo', icon: 'fa-car-crash', index: 7 },
      { key: 'Causa_del_siniestro', label: 'Causa', icon: 'fa-search', index: 8 },
      { key: 'Coordenadas_Geograficas', label: 'Coordenadas', icon: 'fa-map-marker-alt', index: 27 },
      { key: 'Direccion', label: 'Dirección', icon: 'fa-map-pin', index: 26 }
    ];
    
    nuevoDiv.innerHTML = '';
    existenteDiv.innerHTML = '';
    
    campos.forEach(campo => {
      const valorNuevo = datosNuevos.get(campo.key) || '';
      const valorExistente = (registroExistente[campo.index] || '').toString();
      
      let tipoCoincidencia = 'different';
      if (valorNuevo && valorExistente && valorNuevo.toString().toLowerCase() === valorExistente.toLowerCase()) {
        tipoCoincidencia = 'exact';
      }
      
      const nuevoElemento = crearElementoComparacion(campo, valorNuevo, tipoCoincidencia);
      const existenteElemento = crearElementoComparacion(campo, valorExistente, tipoCoincidencia);
      
      nuevoDiv.appendChild(nuevoElemento);
      existenteDiv.appendChild(existenteElemento);
    });
  }

  function crearElementoComparacion(campo, valor, tipoCoincidencia) {
    const div = document.createElement('div');
    div.className = 'field-comparison';
    
    div.innerHTML = `
      <div class="field-label">
        <i class="fas ${campo.icon}"></i>
        ${campo.label}
      </div>
      <div class="field-value ${tipoCoincidencia}">
        ${valor || '<span class="empty-state">Sin información</span>'}
      </div>
    `;
    
    return div;
  }

  window.cerrarModalDuplicados = function() {
    const modal = document.getElementById('modalDuplicados');
    if (modal) {
      modal.style.display = 'none';
    }
    datosFormularioTemp = null;
    
    const submitBtn = document.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.innerHTML = '<i class="fas fa-check-circle"></i> Enviar Registro';
      submitBtn.disabled = false;
    }
  };

  window.cancelarEnvio = function() {
    console.log("Envío cancelado");
    cerrarModalDuplicados();
    mostrarNotificacion('Envío cancelado', 'info');
  };

  window.forzarEnvio = function() {
    console.log("Forzando envío");
    
    if (!datosFormularioTemp) {
      mostrarNotificacion('Error: No hay datos', 'error');
      return;
    }
    
    datosFormularioTemp.set('forzar_insercion', 'true');
    cerrarModalDuplicados();
    enviarFormularioCompleto(datosFormularioTemp);
  };

  /* ============================================================
     EVENTOS DEL MODAL
     ============================================================ */
  const modalDuplicados = document.getElementById('modalDuplicados');
  if (modalDuplicados) {
    modalDuplicados.addEventListener('click', function(e) {
      if (e.target === this) {
        cerrarModalDuplicados();
      }
    });
  }

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      const modal = document.getElementById('modalDuplicados');
      if (modal && modal.style.display === 'flex') {
        cerrarModalDuplicados();
      }
    }
  });

  /* ============================================================
     INICIALIZACIÓN
     ============================================================ */
  
  console.log("Sistema de registro inicializando...");
  
  // Inicializar Cloudinary
  if (typeof cloudinary !== 'undefined' && CLOUDINARY_CONFIG.cloudName) {
    console.log("Inicializando Cloudinary...");
    inicializarCloudinary();
    console.log("Cloudinary configurado correctamente");
  } else {
    console.warn("Cloudinary no disponible");
    mostrarNotificacion('Cloudinary no configurado correctamente', 'error');
  }
  
  actualizarContadorFotos();
  
  console.log("Sistema de registro completamente cargado");
});