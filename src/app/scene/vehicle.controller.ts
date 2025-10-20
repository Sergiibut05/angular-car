/**
 * Vehicle Controller
 * 
 * Responsabilidad: Control del vehículo físico, incluyendo física, controles,
 * sincronización visual y sistema de recuperación automática.
 * 
 * Principios aplicados:
 * - Single Responsibility: Solo maneja el vehículo
 * - Dependency Injection: Recibe dependencias por constructor
 * - Clean Code: Métodos pequeños y bien nombrados
 * - Constants Usage: Usa constantes centralizadas
 */

import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { VEHICLE_CONFIG, CAR_MATERIALS_CONFIG } from './game.constants';
import { CarLightsService } from './car-lights.service';

// --- Material Físico del Chasis ---
export const chassisMaterial = new CANNON.Material('chassis');
// ---------------------------------

export class VehicleController {
  carMesh!: THREE.Group;
  wheelsMeshes: THREE.Mesh[] = [];
  vehicle!: CANNON.RaycastVehicle;
  chassisBody!: CANNON.Body;
  world: CANNON.World;

  // ===========================================
  // 🚗 CONFIGURACIÓN DE RENDIMIENTO DEL COCHE
  // ===========================================
  
  // 🎯 DIRECCIÓN Y MANEJO
  maxSteer = VEHICLE_CONFIG.MAX_STEER;
  
  // ⚡ MOTOR Y VELOCIDAD
  maxForce = VEHICLE_CONFIG.MAX_FORCE;
  maxSpeedKmh = VEHICLE_CONFIG.MAX_SPEED_KMH;
  maxSpeedMs = this.maxSpeedKmh / 3.6;
  
  // 🛑 FRENOS
  brakeForce = VEHICLE_CONFIG.BRAKE_FORCE;
  brakeSmoothness = VEHICLE_CONFIG.BRAKE_SMOOTHNESS;
  
  // 🏗️ CHASIS Y ESTABILIDAD
  chassisMass = VEHICLE_CONFIG.CHASSIS_MASS;
  chassisRestitution = VEHICLE_CONFIG.CHASSIS_RESTITUTION;
  chassisFriction = VEHICLE_CONFIG.CHASSIS_FRICTION;
  linearDamping = VEHICLE_CONFIG.LINEAR_DAMPING;
  angularDamping = VEHICLE_CONFIG.ANGULAR_DAMPING;
  
  // 🛞 RUEDAS Y SUSPENSIÓN
  wheelRadius = VEHICLE_CONFIG.WHEEL_RADIUS;
  suspensionStiffness = VEHICLE_CONFIG.SUSPENSION_STIFFNESS;
  suspensionRestLength = VEHICLE_CONFIG.SUSPENSION_REST_LENGTH;
  frictionSlip = VEHICLE_CONFIG.FRICTION_SLIP;
  dampingRelaxation = VEHICLE_CONFIG.DAMPING_RELAXATION;
  dampingCompression = VEHICLE_CONFIG.DAMPING_COMPRESSION;
  rollInfluence = VEHICLE_CONFIG.ROLL_INFLUENCE;

  // ===========================================
  // 🎮 SISTEMA DE CONTROLES
  // ===========================================
  keys: { [key: string]: boolean } = {};
  
  // ===========================================
  // 💡 SISTEMA DE LUCES DEL COCHE
  // ===========================================
  private carLightsService: CarLightsService;
  
  // ===========================================
  // 🔄 SISTEMA DE RECUPERACIÓN AUTOMÁTICA
  // ===========================================
  private recoveryTimer = 0;
  private recoveryDelay = VEHICLE_CONFIG.RECOVERY_DELAY;
  private isRecovering = false;
  private originalPosition = new CANNON.Vec3();
  private originalQuaternion = new CANNON.Quaternion();

  // ===========================================
  // 🏗️ CONSTRUCTOR Y INICIALIZACIÓN
  // ===========================================
  constructor(world: CANNON.World) {
    this.world = world;
    this.carLightsService = new CarLightsService();
    this.initControls();
  }

  // ===========================================
  // 🚗 CARGA Y CONFIGURACIÓN DEL COCHE
  // ===========================================
  loadCar(mesh: THREE.Group) {
    this.carMesh = mesh; // Guardar referencia al mesh visual

    // 🔍 OBTENER REFERENCIAS A LAS RUEDAS
    // Busca las ruedas por nombre en el modelo 3D
    this.wheelsMeshes = [
        mesh.getObjectByName('Wheel_FL') as THREE.Mesh, // Rueda delantera izquierda
        mesh.getObjectByName('Wheel_FR') as THREE.Mesh, // Rueda delantera derecha
        mesh.getObjectByName('Wheel_RL') as THREE.Mesh, // Rueda trasera izquierda
        mesh.getObjectByName('Wheel_RR') as THREE.Mesh, // Rueda trasera derecha
    ];

    // 🔄 DESCONECTAR RUEDAS VISUALES DEL CHASIS
    // CRUCIAL: Las ruedas visuales deben estar en la escena principal,
    // no dentro del grupo del coche, para que puedan moverse independientemente
    this.wheelsMeshes.forEach(wheel => {
        if (mesh.parent) {
            mesh.parent.add(wheel); // Mueve la rueda a la escena principal
        }
        mesh.remove(wheel); // La quita del grupo del coche
    });

    // ===========================================
    // 🏗️ CREAR CUERPO FÍSICO DEL CHASIS
    // ===========================================
    const halfExtents = new CANNON.Vec3(
      VEHICLE_CONFIG.CHASSIS_HALF_WIDTH,
      VEHICLE_CONFIG.CHASSIS_HALF_HEIGHT,
      VEHICLE_CONFIG.CHASSIS_HALF_LENGTH
    ); // Dimensiones del chasis (ancho, alto, largo) - Nuevo modelo
    this.chassisBody = new CANNON.Body({ 
      mass: this.chassisMass, // Masa del chasis (kg)
      material: chassisMaterial, // Material físico del chasis
      // Propiedades físicas para estabilidad y realismo
      restitution: this.chassisRestitution, // Rebote (bajo = menos rebote)
      friction: this.chassisFriction, // Fricción del chasis
      linearDamping: this.linearDamping, // Amortiguación lineal (resistencia al movimiento)
      angularDamping: this.angularDamping // Amortiguación angular (resistencia a la rotación)
    }as any);
    this.chassisBody.addShape(new CANNON.Box(halfExtents)); // Forma de caja para el chasis
    // 📍 POSICIONAR EL CHASIS
    // Posición inicial alta para que caiga al suelo
    this.chassisBody.position.set(0, 6.0, 0); // Aparece a 6 metros de altura
    this.chassisBody.velocity.set(0, 0, 0); // Velocidad inicial cero
    this.chassisBody.angularVelocity.set(0, 0, 0); // Velocidad angular inicial cero
    this.chassisBody.updateMassProperties(); // Actualizar propiedades de masa
    this.world.addBody(this.chassisBody); // Añadir al mundo físico

    // Guardar posición y rotación originales para recuperación
    this.originalPosition.copy(this.chassisBody.position);
    this.originalQuaternion.copy(this.chassisBody.quaternion);

    // ===========================================
    // 🚗 CONFIGURAR EL VEHÍCULO FÍSICO
    // ===========================================
    this.vehicle = new CANNON.RaycastVehicle({
      chassisBody: this.chassisBody, // Cuerpo físico del chasis
      indexRightAxis: 0,    // Eje X = derecha
      indexForwardAxis: 2,  // Eje Z = adelante
      indexUpAxis: 1        // Eje Y = arriba
    });

    // ===========================================
    // 🛞 POSICIONES DE LAS RUEDAS
    // ===========================================
    // Posiciones relativas al centro del chasis (en metros) - Ajustadas para nuevo modelo
    const wheelPositions = [
        [-1.2, 0, 1.5],   // Rueda delantera izquierda - Más separadas
        [1.2, 0, 1.5],    // Rueda delantera derecha - Más separadas
        [-1.2, 0, -1.5],  // Rueda trasera izquierda - Más separadas
        [1.2, 0, -1.5]    // Rueda trasera derecha - Más separadas
    ];

    // ===========================================
    // ⚙️ CONFIGURACIÓN DE LAS RUEDAS
    // ===========================================
    const wheelOptions = {
        radius: this.wheelRadius, // Radio de las ruedas
        directionLocal: new CANNON.Vec3(0, -1, 0), // Dirección hacia abajo
        
        // 🏗️ SUSPENSIÓN
        suspensionStiffness: this.suspensionStiffness, // Rigidez de la suspensión
        suspensionRestLength: this.suspensionRestLength, // Longitud de reposo
        maxSuspensionForce: 100000, // Fuerza máxima de suspensión
        maxSuspensionTravel: 0.2, // Viaje máximo de suspensión
        
        // 🛞 FRICCIÓN Y AGARRE
        frictionSlip: this.frictionSlip, // Fricción de deslizamiento
        
        // 🎯 AMORTIGUACIÓN
        dampingRelaxation: this.dampingRelaxation, // Amortiguación de relajación
        dampingCompression: this.dampingCompression, // Amortiguación de compresión
        
        // 🏎️ BALANCEO Y MANEJO
        rollInfluence: this.rollInfluence, // Influencia del balanceo
        axleLocal: new CANNON.Vec3(-1, 0, 0), // Eje local de la rueda
        chassisConnectionPointLocal: new CANNON.Vec3(), // Punto de conexión (se establece por rueda)
        
        // 🔄 ROTACIÓN PERSONALIZADA
        customSlidingRotationalSpeed: -30, // Velocidad de rotación al deslizar
        useCustomSlidingRotationalSpeed: true // Usar rotación personalizada
    };

    wheelPositions.forEach(([x, y, z], index) => {
      wheelOptions.chassisConnectionPointLocal.set(x, y, z);
      this.vehicle.addWheel(wheelOptions);
    });

    this.vehicle.addToWorld(this.world);
    
    // ===========================================
    // 💡 CONFIGURAR SISTEMA DE LUCES
    // ===========================================
    this.carLightsService.setupCarLights(mesh);
  }

  // ===========================================
  // 🎮 INICIALIZAR CONTROLES DE TECLADO
  // ===========================================
  private initControls() {
    // Escuchar eventos de teclado para detectar cuando se presionan/sueltan teclas
    window.addEventListener('keydown', (e) => (this.keys[e.key.toLowerCase()] = true));
    window.addEventListener('keyup', (e) => (this.keys[e.key.toLowerCase()] = false));
  }

    // ===========================================
    // 🔄 ACTUALIZACIÓN PRINCIPAL DEL VEHÍCULO
    // ===========================================
    update(delta: number, mobileControls?: { accelerate: boolean, brake: boolean, steerX: number, steerY: number }) {
      if (!this.vehicle) return; // Salir si no hay vehículo

        // 🔄 Sistema de recuperación automática
      this.updateRecovery(delta);

      // 🎮 PROCESAR CONTROLES DE ENTRADA
      let engineForce = 0; // Fuerza del motor (0 = sin aceleración)
      let steerValue = 0;  // Valor de dirección (0 = recto)

      // 📊 CALCULAR VELOCIDAD ACTUAL
      const currentSpeedMs = this.chassisBody.velocity.length(); // Velocidad en m/s
      const isOverMaxSpeed = currentSpeedMs > this.maxSpeedMs; // ¿Excede velocidad máxima?

      // ⌨️ MAPEAR TECLAS Y CONTROLES MÓVILES A CONTROLES
      // Aceleración hacia adelante (W, flecha arriba, o botón móvil acelerar)
      if (((this.keys['w'] || this.keys['arrowup']) || (mobileControls?.accelerate)) && !isOverMaxSpeed) {
        engineForce = -this.maxForce; // Negativo = hacia adelante
      }
      // Aceleración hacia atrás (S, flecha abajo, o botón móvil frenar)
      if ((this.keys['s'] || this.keys['arrowdown']) || (mobileControls?.brake)) {
        engineForce = this.maxForce; // Positivo = hacia atrás
      }
      
      // Dirección izquierda (A, flecha izquierda, o joystick izquierda)
      if ((this.keys['a'] || this.keys['arrowleft']) || (mobileControls?.steerX && mobileControls.steerX < -0.3)) {
        steerValue = this.maxSteer; // Positivo = izquierda
      }
      // Dirección derecha (D, flecha derecha, o joystick derecha)
      if ((this.keys['d'] || this.keys['arrowright']) || (mobileControls?.steerX && mobileControls.steerX > 0.3)) {
        steerValue = -this.maxSteer; // Negativo = derecha
      }

      // ===========================================
      // ⚡ APLICAR FUERZAS AL VEHÍCULO
      // ===========================================
      
      // 🚗 TRACCIÓN TOTAL (4WD - Tracción en las 4 ruedas)
      // Aplicar fuerza del motor a todas las ruedas para mejor aceleración
      this.vehicle.applyEngineForce(engineForce, 0); // Rueda delantera izquierda
      this.vehicle.applyEngineForce(engineForce, 1); // Rueda delantera derecha
      this.vehicle.applyEngineForce(engineForce, 2); // Rueda trasera izquierda
      this.vehicle.applyEngineForce(engineForce, 3); // Rueda trasera derecha

      // 🎯 DIRECCIÓN (Solo ruedas delanteras)
      this.vehicle.setSteeringValue(steerValue, 0); // Rueda delantera izquierda
      this.vehicle.setSteeringValue(steerValue, 1); // Rueda delantera derecha

    // ===========================================
    // 🎨 SINCRONIZACIÓN VISUAL
    // ===========================================
    
    // 🚗 SINCRONIZAR CHASIS VISUAL CON FÍSICO
    // El chasis visual sigue al cuerpo físico del chasis
    this.carMesh.position.copy(this.chassisBody.position as any);
    this.carMesh.quaternion.copy(this.chassisBody.quaternion as any);

    // 🛞 SINCRONIZAR RUEDAS VISUALES CON FÍSICAS
    // Las ruedas visuales (que están en la escena principal) siguen
    // las transformaciones físicas de cada rueda individualmente
    for (let i = 0; i < this.vehicle.wheelInfos.length; i++) {
        const wheel = this.vehicle.wheelInfos[i]; // Información física de la rueda
        const wheelMesh = this.wheelsMeshes[i];   // Mesh visual de la rueda

        if (wheel.worldTransform && wheelMesh) {
            // Copiar posición y rotación física a la visual
            wheelMesh.position.copy(wheel.worldTransform.position as any);
            wheelMesh.quaternion.copy(wheel.worldTransform.quaternion as any);
        }
    }

    // ===========================================
    // 🛑 SISTEMA DE FRENADO SUAVE
    // ===========================================
    
    // 🎯 FRENADO AUTOMÁTICO SUAVE
    // Si no hay aceleración, aplicar frenado suave gradual
    if (Math.abs(engineForce) < 1) {
        // Calcular fuerza de frenado suave basada en velocidad
        const currentSpeed = Math.abs(currentSpeedMs);
        const smoothBrakeForce = Math.min(
            this.brakeForce * this.brakeSmoothness, // Fuerza base suave
            currentSpeed * 50 // Proporcional a la velocidad
        );
        
        // Aplicar frenado suave a todas las ruedas
        this.vehicle.setBrake(smoothBrakeForce, 0); // Rueda delantera izquierda
        this.vehicle.setBrake(smoothBrakeForce, 1); // Rueda delantera derecha
        this.vehicle.setBrake(smoothBrakeForce, 2); // Rueda trasera izquierda
        this.vehicle.setBrake(smoothBrakeForce, 3); // Rueda trasera derecha
    } else {
        // Si hay aceleración, no frenar
        this.vehicle.setBrake(0, 0);
        this.vehicle.setBrake(0, 1);
        this.vehicle.setBrake(0, 2);
        this.vehicle.setBrake(0, 3);
    }

    // ===========================================
    // 💡 CONTROL DE LUCES DEL COCHE
    // ===========================================
    this.carLightsService.updateLights(engineForce, currentSpeedMs);
  }

  // 🔄 Sistema de recuperación automática
  private updateRecovery(delta: number): void {
    const isUpsideDown = this.isCarUpsideDown();
    const isStuck = this.isCarStuck();
    const hasInput = this.hasAnyInput();

    if ((isUpsideDown || isStuck) && hasInput) {
      this.recoveryTimer += delta;
      
      if (this.recoveryTimer >= this.recoveryDelay && !this.isRecovering) {
        this.startRecovery();
      }
    } else {
      this.recoveryTimer = 0;
      this.isRecovering = false;
    }

    if (this.isRecovering) {
      this.performRecovery(delta);
    }
  }

  private isCarUpsideDown(): boolean {
    // Verificar si el coche está boca abajo usando el vector up del coche
    const upVector = new CANNON.Vec3(0, 1, 0);
    this.chassisBody.quaternion.vmult(upVector, upVector);
    return upVector.y < -0.5; // Si el vector up apunta hacia abajo
  }

  private isCarStuck(): boolean {
    // Verificar si el coche está muy inclinado
    const upVector = new CANNON.Vec3(0, 1, 0);
    this.chassisBody.quaternion.vmult(upVector, upVector);
    return Math.abs(upVector.y) < 0.3; // Si está muy inclinado
  }

  private hasAnyInput(): boolean {
    return this.keys['w'] || this.keys['arrowup'] || 
           this.keys['s'] || this.keys['arrowdown'] ||
           this.keys['a'] || this.keys['arrowleft'] ||
           this.keys['d'] || this.keys['arrowright'];
  }

  private startRecovery(): void {
    this.isRecovering = true;
    console.log('🔄 Iniciando recuperación automática del coche');
  }

  private performRecovery(delta: number): void {
    const recoverySpeed = VEHICLE_CONFIG.RECOVERY_SPEED;
    
    // Suavizar hacia la posición original
    const targetPos = this.originalPosition.clone();
    const targetQuat = this.originalQuaternion.clone();
    
    // Interpolar posición
    this.chassisBody.position.lerp(targetPos, delta * recoverySpeed, this.chassisBody.position);
    
    // Interpolar rotación usando slerp
    const currentQuat = this.chassisBody.quaternion.clone();
    currentQuat.slerp(targetQuat, delta * recoverySpeed);
    this.chassisBody.quaternion.copy(currentQuat);
    
    // Reducir velocidades gradualmente
    this.chassisBody.velocity.scale(0.95, this.chassisBody.velocity);
    this.chassisBody.angularVelocity.scale(0.95, this.chassisBody.angularVelocity);
    
    // Verificar si la recuperación está completa
    const positionDiff = this.chassisBody.position.distanceTo(targetPos);
    const rotationDiff = Math.abs(
      this.chassisBody.quaternion.x * targetQuat.x +
      this.chassisBody.quaternion.y * targetQuat.y +
      this.chassisBody.quaternion.z * targetQuat.z +
      this.chassisBody.quaternion.w * targetQuat.w
    );
    
    if (positionDiff < 0.1 && rotationDiff > 0.99) {
      this.isRecovering = false;
      this.recoveryTimer = 0;
      console.log('✅ Recuperación completada');
    }
  }
}