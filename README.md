# 🚗 Angular ThreeJS CannonJS Car Game

Un simulador de coche 3D desarrollado con Angular, Three.js y Cannon.js, que incluye física realista, controles móviles y efectos visuales avanzados.

## ✨ Características

### 🎮 Controles
- **Desktop**: Teclado (WASD / Flechas) para conducir
- **Móvil**: Joystick virtual + botones táctiles
- **Cámara**: Mouse/touch para mover la vista isométrica
- **Zoom**: Rueda del mouse para acercar/alejar

### 🚗 Física del Vehículo
- **Motor realista**: Aceleración, velocidad máxima y frenado suave
- **Suspensión**: Sistema de suspensión con amortiguación
- **Ruedas**: 4 ruedas independientes con física realista
- **Recuperación automática**: Sistema que endereza el coche si se vuelca

### 💡 Sistema de Luces
- **Luces delanteras**: Se encienden al acelerar hacia adelante
- **Transiciones suaves**: Cambios graduales de color y emisión
- **Materiales dinámicos**: Luces más claras cuando están apagadas

### 📱 Controles Móviles
- **Joystick virtual**: Control de dirección intuitivo
- **Botones táctiles**: Acelerar (▲) y frenar (▼)
- **Detección automática**: Se activan automáticamente en dispositivos móviles
- **Controles de cámara**: Deslizar para mover la vista

### 🎨 Efectos Visuales
- **Iluminación realista**: Sistema de luces con sombras suavizadas
- **Post-procesado**: Efecto de profundidad de campo (bokeh)
- **Materiales mejorados**: Texturas y reflejos realistas
- **Suelo infinito**: Mundo expandible con textura azul

## 🛠️ Tecnologías Utilizadas

- **Angular 17+**: Framework principal
- **Three.js**: Renderizado 3D y gráficos
- **Cannon.js**: Motor de física
- **TypeScript**: Tipado estático
- **SCSS**: Estilos avanzados

## 🏗️ Arquitectura del Proyecto

El proyecto sigue principios de **Clean Code** y **SOLID**:

### 📁 Estructura de Archivos
```
src/app/scene/
├── scene.ts                 # Componente principal
├── scene.html              # Template con controles móviles
├── scene.scss              # Estilos responsive
├── vehicle.controller.ts    # Controlador del vehículo
├── world.controller.ts      # Controlador del mundo 3D
├── camera.controller.ts     # Controlador de cámara isométrica
├── mobile-controls.service.ts # Servicio de controles móviles
├── car-lights.service.ts    # Servicio de luces del coche
└── game.constants.ts        # Constantes centralizadas
```

### 🎯 Principios Aplicados
- **Single Responsibility**: Cada clase tiene una responsabilidad específica
- **Dependency Injection**: Dependencias inyectadas por constructor
- **DRY**: Eliminación de código duplicado
- **Constants**: Configuración centralizada
- **Separation of Concerns**: Separación clara de responsabilidades

## 🚀 Instalación y Uso

### Prerrequisitos
- Node.js 18+ 
- npm o yarn
- Angular CLI

### Instalación
```bash
# Clonar el repositorio
git clone https://github.com/Sergiibut05/angular-car.git

# Navegar al directorio
cd angular-car

# Instalar dependencias
npm install

# Servir en modo desarrollo
ng serve
```

### Compilación para Producción
```bash
# Construir para producción
ng build --configuration production

# Servir archivos estáticos
ng serve --configuration production
```

## 🎮 Controles del Juego

### Desktop
| Tecla | Acción |
|-------|--------|
| `W` / `↑` | Acelerar hacia adelante |
| `S` / `↓` | Acelerar hacia atrás |
| `A` / `←` | Girar a la izquierda |
| `D` / `→` | Girar a la derecha |
| `Click izquierdo + arrastrar` | Mover cámara |
| `Rueda del mouse` | Zoom in/out |

### Móvil
| Control | Acción |
|---------|--------|
| **Joystick izquierdo** | Control de dirección |
| **Botón ▲** | Acelerar |
| **Botón ▼** | Frenar |
| **Deslizar pantalla** | Mover cámara |

## ⚙️ Configuración

### Parámetros del Vehículo
Los parámetros del coche se pueden ajustar en `game.constants.ts`:

```typescript
export const VEHICLE_CONFIG = {
  MAX_FORCE: 800,           // Fuerza del motor
  MAX_SPEED_KMH: 30,        // Velocidad máxima
  BRAKE_FORCE: 200,         // Fuerza de frenado
  CHASSIS_MASS: 1200,       // Masa del chasis
  // ... más configuraciones
};
```

### Configuración de Cámara
```typescript
export const CAMERA_CONFIG = {
  FOV: 55,                  // Campo de visión
  IDEAL_OFFSET: new THREE.Vector3(15, 12, 10), // Posición isométrica
  PAN_SENSITIVITY: 0.02,    // Sensibilidad de paneo
  // ... más configuraciones
};
```

## 🎨 Personalización

### Cambiar Colores de Luces
```typescript
// En game.constants.ts
export const CAR_LIGHTS_CONFIG = {
  HEADLIGHT_ON_COLOR: 0xFFFFFF,   // Blanco brillante
  HEADLIGHT_OFF_COLOR: 0xCCCCCC,  // Gris claro
  // ... más configuraciones
};
```

### Ajustar Física
```typescript
// En game.constants.ts
export const VEHICLE_CONFIG = {
  SUSPENSION_STIFFNESS: 60,      // Rigidez de suspensión
  FRICTION_SLIP: 25,             // Fricción de ruedas
  ROLL_INFLUENCE: 0.02,          // Influencia del balanceo
  // ... más configuraciones
};
```

## 🐛 Solución de Problemas

### Problemas Comunes

1. **Las luces no funcionan**
   - Verificar que el modelo 3D tenga materiales con nombre `headlight.001`
   - Revisar la consola para mensajes de advertencia

2. **Controles móviles no aparecen**
   - Verificar que la detección de móvil funcione correctamente
   - Comprobar que el viewport sea menor a 768px

3. **Física extraña**
   - Ajustar parámetros en `VEHICLE_CONFIG`
   - Verificar que el modelo 3D esté correctamente escalado

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📝 Licencia

Este proyecto está bajo la Licencia MIT. Ver `LICENSE` para más detalles.

## 👨‍💻 Autor

**Sergiibut05**
- GitHub: [@Sergiibut05](https://github.com/Sergiibut05)

## 🙏 Agradecimientos

- **Three.js** - Librería de gráficos 3D
- **Cannon.js** - Motor de física
- **Angular Team** - Framework web
- **Comunidad open source** - Por las herramientas y recursos

## 📊 Estadísticas del Proyecto

- **Líneas de código**: ~2000+
- **Archivos TypeScript**: 8
- **Servicios**: 3
- **Controladores**: 3
- **Constantes**: 1 archivo centralizado

---

⭐ **¡Dale una estrella al proyecto si te gusta!** ⭐