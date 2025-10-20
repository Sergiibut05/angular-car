/**
 * Camera Controller
 * 
 * Responsabilidad: Manejo de la cámara isométrica, controles de mouse/touch,
 * zoom, paneo y seguimiento del vehículo.
 * 
 * Principios aplicados:
 * - Single Responsibility: Solo maneja la cámara
 * - Dependency Injection: Recibe dependencias por constructor
 * - Clean Code: Métodos pequeños y con nombres descriptivos
 */

import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export interface CameraConfig {
  fov: number;
  near: number;
  far: number;
  idealOffset: THREE.Vector3;
  idealLookat: THREE.Vector3;
  panSensitivity: number;
  zoomLimits: { min: number; max: number };
  panLimits: { min: number; max: number };
}

export interface MobileControls {
  accelerate: boolean;
  brake: boolean;
  steerX: number;
  steerY: number;
}

export class CameraController {
  private camera: THREE.PerspectiveCamera;
  private bokehPass: any;
  
  // Estado de la cámara
  private cameraTarget = new THREE.Vector3();
  private cameraScrollZoom = 1.0;
  private cameraPanOffset = new THREE.Vector3(0, 0, 0);
  private isPanning = false;
  private isDetached = false;
  private lastMouseX = 0;
  private lastMouseY = 0;
  private lastCarPosition = new CANNON.Vec3(0, 0, 0);
  
  // Configuración
  private config: CameraConfig;
  
  constructor(camera: THREE.PerspectiveCamera, bokehPass: any, config: CameraConfig) {
    this.camera = camera;
    this.bokehPass = bokehPass;
    this.config = config;
  }

  /**
   * Inicializa los controles de la cámara
   * @param rendererCanvas Canvas del renderer para eventos
   */
  initControls(rendererCanvas: HTMLCanvasElement): void {
    // Eventos de mouse (desktop)
    rendererCanvas.addEventListener('wheel', this.onMouseWheel.bind(this), { passive: false });
    rendererCanvas.addEventListener('mousedown', this.onMouseDown.bind(this));
    window.addEventListener('mousemove', this.onMouseMove.bind(this));
    window.addEventListener('mouseup', this.onMouseUp.bind(this));
    
    // Eventos táctiles (móvil) para controles de cámara
    rendererCanvas.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: false });
    rendererCanvas.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false });
    rendererCanvas.addEventListener('touchend', this.onTouchEnd.bind(this), { passive: false });
  }

  /**
   * Actualiza la posición de la cámara siguiendo al vehículo
   * @param delta Tiempo transcurrido
   * @param vehiclePosition Posición actual del vehículo
   * @param keys Estado de las teclas presionadas
   */
  update(delta: number, vehiclePosition: CANNON.Vec3, keys: { [key: string]: boolean }): void {
    if (!vehiclePosition) return;

    // Detectar si el usuario está conduciendo
    const isDriving = this.isUserDriving(keys);

    // Si está conduciendo, reconectar automáticamente la cámara al coche
    if (isDriving && this.isDetached) {
      this.isDetached = false;
      this.isPanning = false;
    }

    // Actualizar posición del coche solo si no está desconectada
    if (!this.isDetached) {
      if (vehiclePosition.distanceTo(this.lastCarPosition) > 0.01) {
        this.lastCarPosition.copy(vehiclePosition);
      }
    }

    // Suavizado del paneo solo si no está desconectada
    if (!this.isDetached && !this.isPanning) {
      this.cameraPanOffset.lerp(new THREE.Vector3(0, 0, 0), delta * 3.0);
    }

    this.updateCameraPosition(delta, vehiclePosition);
    this.updateDepthOfField(vehiclePosition);
  }

  /**
   * Verifica si el usuario está conduciendo
   */
  private isUserDriving(keys: { [key: string]: boolean }): boolean {
    return keys['w'] || keys['arrowup'] || 
           keys['s'] || keys['arrowdown'] ||
           keys['a'] || keys['arrowleft'] ||
           keys['d'] || keys['arrowright'];
  }

  /**
   * Actualiza la posición de la cámara
   */
  private updateCameraPosition(delta: number, vehiclePosition: CANNON.Vec3): void {
    // Offset isométrico fijo
    const offset = this.config.idealOffset.clone().multiplyScalar(this.cameraScrollZoom);

    // Aplicar paneo
    const pan = this.cameraPanOffset.clone();

    // Posición ideal de la cámara
    const idealPos = new THREE.Vector3().addVectors(vehiclePosition as any, offset).add(pan);

    // Punto al que mirar (coche o posición fija si está desconectada)
    let lookatPoint: THREE.Vector3;
    if (this.isDetached) {
      // Si está desconectada, mirar al punto donde estaba el coche + offset de paneo
      lookatPoint = new THREE.Vector3().addVectors(this.lastCarPosition as any, pan);
    } else {
      // Si está conectada, mirar al coche
      lookatPoint = new THREE.Vector3().addVectors(vehiclePosition as any, this.config.idealLookat);
    }

    // Suavizado de movimiento
    this.cameraTarget.lerp(lookatPoint, delta * 2.0);
    this.camera.position.lerp(idealPos, delta * 3.0);
    this.camera.lookAt(this.cameraTarget);
  }

  /**
   * Actualiza el efecto de profundidad de campo
   */
  private updateDepthOfField(vehiclePosition: CANNON.Vec3): void {
    if (!this.bokehPass) return;
    
    const distance = this.camera.position.distanceTo(vehiclePosition as any);
    (this.bokehPass.uniforms as any)['focus'].value = distance;
    (this.bokehPass.uniforms as any)['aperture'].value = 0.000005 * Math.max(1, distance / 25.0);
  }

  // ===========================================
  // EVENTOS DE MOUSE
  // ===========================================

  private onMouseWheel(event: WheelEvent): void {
    event.preventDefault();
    const zoomAmount = event.deltaY * 0.003;
    this.cameraScrollZoom = Math.max(
      this.config.zoomLimits.min, 
      Math.min(this.config.zoomLimits.max, this.cameraScrollZoom + zoomAmount)
    );
  }

  private onMouseDown(event: MouseEvent): void {
    if (event.button === 0) { // Click izquierdo
      this.isPanning = true;
      this.isDetached = true;
      this.lastMouseX = event.clientX;
      this.lastMouseY = event.clientY;
    }
  }

  private onMouseMove(event: MouseEvent): void {
    if (!this.isPanning) return;
    
    this.handlePanMovement(event.clientX, event.clientY);
  }

  private onMouseUp(event: MouseEvent): void {
    if (event.button === 0) {
      this.isPanning = false;
    }
  }

  // ===========================================
  // EVENTOS TÁCTILES
  // ===========================================

  private onTouchStart(event: TouchEvent): void {
    if (event.touches.length === 1) { // Solo un dedo para paneo
      this.isPanning = true;
      this.isDetached = true;
      this.lastMouseX = event.touches[0].clientX;
      this.lastMouseY = event.touches[0].clientY;
    }
    event.preventDefault();
  }

  private onTouchMove(event: TouchEvent): void {
    if (!this.isPanning || event.touches.length !== 1) return;
    
    event.preventDefault();
    this.handlePanMovement(event.touches[0].clientX, event.touches[0].clientY);
  }

  private onTouchEnd(event: TouchEvent): void {
    if (event.touches.length === 0) {
      this.isPanning = false;
    }
    event.preventDefault();
  }

  /**
   * Maneja el movimiento de paneo (común para mouse y touch)
   */
  private handlePanMovement(clientX: number, clientY: number): void {
    const deltaX = clientX - this.lastMouseX;
    const deltaY = clientY - this.lastMouseY;
    this.lastMouseX = clientX;
    this.lastMouseY = clientY;
    
    // Compensación trigonométrica para movimiento más "recto" en vista isométrica
    const angle = Math.PI / 4;
    const compensatedX = deltaY * Math.cos(angle) - deltaX * Math.sin(angle);
    const compensatedZ = deltaY * Math.sin(angle) + deltaX * Math.cos(angle);
    
    // Aplicar movimiento compensado
    this.cameraPanOffset.x += compensatedX * this.config.panSensitivity;
    this.cameraPanOffset.z += compensatedZ * this.config.panSensitivity;
    
    // Limitar el paneo
    this.cameraPanOffset.x = Math.max(
      this.config.panLimits.min, 
      Math.min(this.config.panLimits.max, this.cameraPanOffset.x)
    );
    this.cameraPanOffset.z = Math.max(
      this.config.panLimits.min, 
      Math.min(this.config.panLimits.max, this.cameraPanOffset.z)
    );
  }

  /**
   * Resetea la posición de la cámara al vehículo
   */
  resetToVehicle(): void {
    this.isDetached = false;
    this.isPanning = false;
    this.cameraPanOffset.set(0, 0, 0);
  }
}
