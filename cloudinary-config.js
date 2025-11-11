// cloudinary-config.js
const CLOUDINARY_CONFIG = {
    cloudName: 'siniestros_viales', // ⚠️ CAMBIAR por tu cloud name
    uploadPreset: 'siniestros_viales', // El que creaste en el dashboard
    folder: 'siniestros-viales',
    maxFiles: 2,
    maxFileSize: 10000000, // 10MB
    sources: ['local', 'camera'],
    showAdvancedOptions: false,
    cropping: false,
    multiple: true,
    resourceType: 'image',
    clientAllowedFormats: ['jpg', 'jpeg', 'png', 'webp'],
    maxImageWidth: 2000,
    maxImageHeight: 2000
};