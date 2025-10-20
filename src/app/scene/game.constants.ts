/**
 * Game Constants
 * 
 * Responsabilidad: Centralizar todas las constantes del juego para facilitar
 * el mantenimiento y configuración.
 * 
 * Principios aplicados:
 * - DRY (Don't Repeat Yourself): Evita duplicación de valores
 * - Single Source of Truth: Un solo lugar para cada constante
 * - Configuration Management: Fácil de modificar valores
 */

import * as THREE from 'three';

// ===========================================
// 🎮 CONFIGURACIÓN DE CONTROLES
// ===========================================
export const CONTROL_CONFIG = {
  // Sensibilidad de controles
  PAN_SENSITIVITY: 0.02,
  ZOOM_SENSITIVITY: 0.003,
  
  // Límites de zoom
  ZOOM_MIN: 0.8,
  ZOOM_MAX: 1.5,
  
  // Límites de paneo
  PAN_MIN: -20,
  PAN_MAX: 20,
  
  // Umbrales de joystick
  JOYSTICK_THRESHOLD: 0.3,
  JOYSTICK_MAX_DISTANCE: 50,
} as const;

// ===========================================
// 🚗 CONFIGURACIÓN DEL VEHÍCULO
// ===========================================
export const VEHICLE_CONFIG = {
  // Motor y velocidad
  MAX_FORCE: 800,
  MAX_SPEED_KMH: 30,
  
  // Frenos
  BRAKE_FORCE: 200,
  BRAKE_SMOOTHNESS: 0.3,
  
  // Chasis
  CHASSIS_MASS: 1200,
  CHASSIS_RESTITUTION: 0.1,
  CHASSIS_FRICTION: 0.8,
  LINEAR_DAMPING: 0.15,
  ANGULAR_DAMPING: 0.2,
  
  // Ruedas
  WHEEL_RADIUS: 0.38,
  SUSPENSION_STIFFNESS: 60,
  SUSPENSION_REST_LENGTH: 0.2,
  FRICTION_SLIP: 25,
  DAMPING_RELAXATION: 4.0,
  DAMPING_COMPRESSION: 6.0,
  ROLL_INFLUENCE: 0.02,
  
  // Dirección
  MAX_STEER: Math.PI / 8, // 22.5 grados
  
  // Recuperación automática
  RECOVERY_DELAY: 2.0,
  RECOVERY_SPEED: 2.0,
} as const;

// ===========================================
// 📱 CONFIGURACIÓN MÓVIL
// ===========================================
export const MOBILE_CONFIG = {
  // Detección de móvil
  MOBILE_BREAKPOINT: 768,
  
  // Controles táctiles
  TOUCH_SENSITIVITY: 0.02,
  
  // Tamaños de controles
  JOYSTICK_SIZE: 120,
  JOYSTICK_KNOB_SIZE: 50,
  BUTTON_SIZE: 80,
  
  // Responsive
  MOBILE_JOYSTICK_SIZE: 100,
  MOBILE_JOYSTICK_KNOB_SIZE: 40,
  MOBILE_BUTTON_SIZE: 70,
} as const;

// ===========================================
// 🎥 CONFIGURACIÓN DE CÁMARA
// ===========================================
export const CAMERA_CONFIG = {
  // Configuración básica
  FOV: 55,
  NEAR: 0.1,
  FAR: 1000,
  
  // Posición isométrica
  IDEAL_OFFSET: new THREE.Vector3(15, 12, 10),
  IDEAL_LOOKAT: new THREE.Vector3(0, 0, 0),
  
  // Suavizado
  CAMERA_LERP_SPEED: 3.0,
  TARGET_LERP_SPEED: 2.0,
  PAN_LERP_SPEED: 3.0,
} as const;

// ===========================================
// 🌞 CONFIGURACIÓN DE ILUMINACIÓN
// ===========================================
export const LIGHTING_CONFIG = {
  // Luz principal (sol)
  SUN_COLOR: 0xFFE4B5,
  SUN_INTENSITY: 2.2,
  SUN_POSITION: new THREE.Vector3(30, 40, 20),
  
  // Luz de relleno
  FILL_COLOR: 0xB0E0E6,
  FILL_INTENSITY: 0.6,
  FILL_POSITION: new THREE.Vector3(-20, 25, -15),
  
  // Luz ambiental
  AMBIENT_COLOR: 0xFFF8DC,
  AMBIENT_INTENSITY: 0.8,
  
  // Luz adicional
  RIM_COLOR: 0xFFF5E6,
  RIM_INTENSITY: 0.3,
  RIM_POSITION: new THREE.Vector3(10, 15, -20),
  
  // Configuración de sombras
  SHADOW_MAP_SIZE: 16384,
  SHADOW_CAMERA_FAR: 500,
  SHADOW_CAMERA_AREA: 150,
  SHADOW_BIAS: -0.00005,
  SHADOW_NORMAL_BIAS: 0.08,
  SHADOW_RADIUS: 12,
  SHADOW_BLUR_SAMPLES: 25,
} as const;

// ===========================================
// 💡 CONFIGURACIÓN DE LUCES DEL COCHE
// ===========================================
export const CAR_LIGHTS_CONFIG = {
  // Luces delanteras
  HEADLIGHT_ON_COLOR: 0xFFFFFF,
  HEADLIGHT_OFF_COLOR: 0xCCCCCC,
  HEADLIGHT_EMISSIVE_ON: 0x444444,
  HEADLIGHT_EMISSIVE_OFF: 0x000000,
  
  // Luces traseras
  TAILLIGHT_ON_COLOR: 0xFF0000,
  TAILLIGHT_OFF_COLOR: 0x660000,
  TAILLIGHT_EMISSIVE_ON: 0x440000,
  TAILLIGHT_EMISSIVE_OFF: 0x000000,
  
  // Transiciones
  LIGHT_LERP_SPEED_ON: 0.1,
  LIGHT_LERP_SPEED_OFF: 0.05,
  TAILLIGHT_LERP_SPEED_ON: 0.15,
  TAILLIGHT_LERP_SPEED_OFF: 0.08,
  
  // Umbrales
  ACCELERATION_THRESHOLD: -50,
  BRAKING_THRESHOLD: 1,
  SPEED_THRESHOLD: 0.5,
  REVERSING_THRESHOLD: 50,
} as const;

// ===========================================
// 🎨 CONFIGURACIÓN DE POST-PROCESADO
// ===========================================
export const POST_PROCESSING_CONFIG = {
  // Bokeh (desenfoque)
  BOKEH_FOCUS: 25.0,
  BOKEH_APERTURE: 0.00005,
  BOKEH_MAX_BLUR: 0.002,
  
  // Renderer
  TONE_MAPPING: THREE.ACESFilmicToneMapping,
  TONE_MAPPING_EXPOSURE: 1.0,
} as const;

// ===========================================
// 🌍 CONFIGURACIÓN DEL MUNDO
// ===========================================
export const WORLD_CONFIG = {
  // Gravedad
  GRAVITY: -9.82,
  
  // Materiales de contacto
  CAR_WORLD_FRICTION: 0.4,
  CAR_WORLD_RESTITUTION: 0.1,
  
  // Suelo
  GROUND_COLOR: 0xBBDEFB,
  GROUND_ROUGHNESS: 0.5,
  GROUND_METALNESS: 0.0,
  GROUND_SIZE: 1000,
} as const;

// ===========================================
// 🎯 CONFIGURACIÓN DE MATERIALES DEL COCHE
// ===========================================
export const CAR_MATERIALS_CONFIG = {
  // Materiales por defecto
  DEFAULT_METALNESS: 0.5,
  DEFAULT_ROUGHNESS: 0.4,
  MIN_METALNESS: 0.5,
  MAX_ROUGHNESS: 0.6,
  
  // Nombres de materiales de luces
  HEADLIGHT_MATERIAL_NAME: 'headlight.001',
  TAILLIGHT_MATERIAL_NAME: 'backlight.001',
} as const;

// ===========================================
// 🎮 CONFIGURACIÓN DE TECLAS
// ===========================================
export const KEYBOARD_CONFIG = {
  // Teclas de movimiento
  ACCELERATE_KEYS: ['w', 'arrowup'],
  BRAKE_KEYS: ['s', 'arrowdown'],
  STEER_LEFT_KEYS: ['a', 'arrowleft'],
  STEER_RIGHT_KEYS: ['d', 'arrowright'],
} as const;
