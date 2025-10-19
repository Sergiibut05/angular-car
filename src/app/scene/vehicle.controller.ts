// vehicle.controller.ts

import * as THREE from 'three';
import * as CANNON from 'cannon-es';

// --- Material Físico del Chasis ---
export const chassisMaterial = new CANNON.Material('chassis');
// ---------------------------------

export class VehicleController {
  carMesh!: THREE.Group;
  wheelsMeshes: THREE.Mesh[] = [];
  vehicle!: CANNON.RaycastVehicle;
  chassisBody!: CANNON.Body;
  world: CANNON.World;

  maxSteer = Math.PI / 8;
  
  // --- ARREGLO: Coche más lento y estable ---
  maxForce = 350; // Mucha menos fuerza
  brakeForce = 400;
  maxSpeedKmh = 45; // Límite de velocidad bajo
  maxSpeedMs = this.maxSpeedKmh / 3.6; 
  // ---------------------------------------

  keys: { [key: string]: boolean } = {};
  
  // Sistema de recuperación automática
  private recoveryTimer = 0;
  private recoveryDelay = 2.0; // Segundos antes de activar recuperación
  private isRecovering = false;
  private originalPosition = new CANNON.Vec3();
  private originalQuaternion = new CANNON.Quaternion();

  constructor(world: CANNON.World) {
    this.world = world;
    this.initControls();
  }

  loadCar(mesh: THREE.Group) {
    this.carMesh = mesh;

    this.wheelsMeshes = [
        mesh.getObjectByName('Wheel_FL') as THREE.Mesh,
        mesh.getObjectByName('Wheel_FR') as THREE.Mesh,
        mesh.getObjectByName('Wheel_RL') as THREE.Mesh,
        mesh.getObjectByName('Wheel_RR') as THREE.Mesh,
    ];

    // Este código es CRUCIAL. Desconecta las ruedas visuales del
    // chasis visual y las añade a la escena principal.
    // Esto permite que el chasis siga al 'chassisBody' y las
    // ruedas sigan a los 'wheelInfo.worldTransform' independientemente.
    this.wheelsMeshes.forEach(wheel => {
        if (mesh.parent) {
            mesh.parent.add(wheel); // Mueve la rueda a la escena
        }
        mesh.remove(wheel); // La quita del grupo del coche
    });

    // Crear cuerpo físico del chasis
    const halfExtents = new CANNON.Vec3(0.9, 0.4, 2.1); 
    this.chassisBody = new CANNON.Body({ 
      mass: 1200, // Más masa para más inercia y estabilidad
      material: chassisMaterial,
      // Propiedades físicas estables para evitar rebotes
      restitution: 0.1, // Muy poco rebote
      friction: 0.8,   // Buena fricción
      linearDamping: 0.1, // Amortiguación lineal
      angularDamping: 0.1  // Amortiguación angular
    }as any);
    this.chassisBody.addShape(new CANNON.Box(halfExtents));
    const wheelRadius = 0.38;
    const suspensionRestLength = 0.2;

    // Posición inicial del coche más alta para evitar colisiones iniciales
    this.chassisBody.position.set(0, wheelRadius + suspensionRestLength + halfExtents.y + 1.0, 0);
    this.chassisBody.velocity.set(0, 0, 0); // Velocidad inicial cero
    this.chassisBody.angularVelocity.set(0, 0, 0); // Velocidad angular inicial cero
    this.chassisBody.updateMassProperties();
    this.world.addBody(this.chassisBody);

    // Guardar posición y rotación originales para recuperación
    this.originalPosition.copy(this.chassisBody.position);
    this.originalQuaternion.copy(this.chassisBody.quaternion);

    // Configurar el vehículo
    this.vehicle = new CANNON.RaycastVehicle({
      chassisBody: this.chassisBody,
      indexRightAxis: 0,    // x
      indexForwardAxis: 2,  // z
      indexUpAxis: 1        // y
    });

    // Estas posiciones son relativas al centro del CHASSISBODY.
    // Si has movido el chasis en Blender, puede que tengas que
    // ajustar estas coordenadas para que coincidan.
    const wheelPositions = [
        [-0.77, 0, 1.7],   // Front Left
        [0.77, 0, 1.7],    // Front Right
        [-0.77, 0, -0.8],  // Rear Left
        [0.77, 0, -0.8]    // Rear Right
    ];

    const wheelOptions = {
        radius: 0.38,
        directionLocal: new CANNON.Vec3(0, -1, 0),
        // --- ARREGLO: Suspensión más firme y amortiguada ---
        suspensionStiffness: 50, // Más rígida
        suspensionRestLength: 0.2,
        frictionSlip: 30, // Mucho más agarre
        dampingRelaxation: 3.0, // Más amortiguación
        dampingCompression: 5.0, // Más amortiguación
        // ---
        maxSuspensionForce: 100000, // Aumentado por si acaso
        rollInfluence: 0.01,
        axleLocal: new CANNON.Vec3(-1, 0, 0),
        chassisConnectionPointLocal: new CANNON.Vec3(),
        maxSuspensionTravel: 0.2,
        customSlidingRotationalSpeed: -30,
        useCustomSlidingRotationalSpeed: true
    };

    wheelPositions.forEach(([x, y, z], index) => {
      wheelOptions.chassisConnectionPointLocal.set(x, y, z);
      this.vehicle.addWheel(wheelOptions);
    });

    this.vehicle.addToWorld(this.world);
  }

  private initControls() {
    window.addEventListener('keydown', (e) => (this.keys[e.key.toLowerCase()] = true));
    window.addEventListener('keyup', (e) => (this.keys[e.key.toLowerCase()] = false));
  }

  update(delta: number) {
    if (!this.vehicle) return;

    // Sistema de recuperación automática
    this.updateRecovery(delta);

    let engineForce = 0;
    let steerValue = 0;

    const currentSpeedMs = this.chassisBody.velocity.length();
    const isOverMaxSpeed = currentSpeedMs > this.maxSpeedMs;

    // Controles
    if ((this.keys['w'] || this.keys['arrowup']) && !isOverMaxSpeed) engineForce = -this.maxForce;
    if (this.keys['s'] || this.keys['arrowdown']) engineForce = this.maxForce;
    
    if (this.keys['a'] || this.keys['arrowleft']) steerValue = this.maxSteer;
    if (this.keys['d'] || this.keys['arrowright']) steerValue = -this.maxSteer;

    // Tracción Total (4WD)
    this.vehicle.applyEngineForce(engineForce, 0); 
    this.vehicle.applyEngineForce(engineForce, 1); 
    this.vehicle.applyEngineForce(engineForce, 2); 
    this.vehicle.applyEngineForce(engineForce, 3); 

    // Dirección
    this.vehicle.setSteeringValue(steerValue, 0);
    this.vehicle.setSteeringValue(steerValue, 1);

    // --- SINCRONIZACIÓN VISUAL ---
    // Esto es correcto: el chasis visual sigue al body físico.
    this.carMesh.position.copy(this.chassisBody.position as any);
    this.carMesh.quaternion.copy(this.chassisBody.quaternion as any);

    // Y las ruedas visuales (que están en la escena, NO en el carMesh)
    // siguen sus transformaciones de rueda individuales.
    for (let i = 0; i < this.vehicle.wheelInfos.length; i++) {
        const wheel = this.vehicle.wheelInfos[i];
        const wheelMesh = this.wheelsMeshes[i];

        if (wheel.worldTransform && wheelMesh) {
            wheelMesh.position.copy(wheel.worldTransform.position as any);
            wheelMesh.quaternion.copy(wheel.worldTransform.quaternion as any);
        }
    }

    // Freno automático
    if (Math.abs(engineForce) < 1) {
        this.vehicle.setBrake(this.brakeForce * 0.5, 0);
        this.vehicle.setBrake(this.brakeForce * 0.5, 1);
        this.vehicle.setBrake(this.brakeForce * 0.5, 2);
        this.vehicle.setBrake(this.brakeForce * 0.5, 3);
    } else {
        this.vehicle.setBrake(0, 0);
        this.vehicle.setBrake(0, 1);
        this.vehicle.setBrake(0, 2);
        this.vehicle.setBrake(0, 3);
    }
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
    const recoverySpeed = 2.0; // Velocidad de recuperación
    
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