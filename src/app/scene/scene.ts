// scene.ts

import { Component, ElementRef, ViewChild, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { GLTFLoader } from 'three-stdlib';
import { VehicleController, chassisMaterial } from './vehicle.controller';
// import { OrbitControls } from 'three-stdlib'; // --- ARREGLO: ELIMINADO ---
import { WorldController, worldMaterial } from './world.controller';
import { CommonModule, NgIf } from '@angular/common';


// --- ARREGLO: Imports para Post-Procesado (Desenfoque) ---
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
// ---------------------------------------------------------


@Component({
  selector: 'app-scene',
  templateUrl: './scene.html',
  styleUrls: ['./scene.scss'],
  imports: [CommonModule], 
  // standalone: true, 
})
export class Scene implements AfterViewInit {

  @ViewChild('rendererCanvas', { static: true })
  rendererCanvas!: ElementRef<HTMLCanvasElement>;
  
  // Referencias para controles móviles
  @ViewChild('joystickContainer', { static: false })
  joystickContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('joystickKnob', { static: false })
  joystickKnob!: ElementRef<HTMLDivElement>;
  @ViewChild('accelerateBtn', { static: false })
  accelerateBtn!: ElementRef<HTMLButtonElement>;
  @ViewChild('brakeBtn', { static: false })
  brakeBtn!: ElementRef<HTMLButtonElement>;
  
  private worldController!: WorldController;
  vehicle!: VehicleController;
  // private controls!: OrbitControls; // --- ARREGLO: ELIMINADO ---
  
  // Variables Three.js
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;

  // Mundo Cannon-es
  private world!: CANNON.World;
  
  private cannonDebugger!: { update: () => void };

  // --- ARREGLO: Post-Procesado ---
  private composer!: EffectComposer;
  private bokehPass!: BokehPass;
  // ------------------------------

  // --- ARREGLO: Estado de la Cámara Isométrica ---
  private cameraTarget = new THREE.Vector3(); // Punto al que la cámara mira
  private cameraIdealOffset = new THREE.Vector3(15, 12, 10); // Posición isométrica ideal
  private cameraIdealLookat = new THREE.Vector3(0, 0, 0); // Punto ideal a mirar (coche)
  private cameraScrollZoom = 1.0; // Multiplicador de zoom (rueda)
  private cameraPanOffset = new THREE.Vector3(0, 0, 0); // Desplazamiento por paneo (click)
  private isPanning = false;
  private isDetached = false; // Si la cámara está desconectada del coche
  private lastCarPosition = new CANNON.Vec3(0, 0, 0);
  private lastMouseX = 0;
  private lastMouseY = 0;
  
  // Controles del coche
  private keys: { [key: string]: boolean } = {};
  
  // ===========================================
  // 📱 DETECCIÓN MÓVIL Y CONTROLES TÁCTILES
  // ===========================================
  isMobile = false; // Detecta si es dispositivo móvil
  
  // Variables del joystick
  private joystickActive = false;
  private joystickCenter = { x: 0, y: 0 };
  private joystickMaxDistance = 50;
  private joystickDirection = { x: 0, y: 0 };
  
  // Estados de botones móviles
  private mobileAccelerate = false;
  private mobileBrake = false;

  constructor(private cdr: ChangeDetectorRef) {}

  ngAfterViewInit(): void {
    this.initScene();
    this.initCameraControls(); // Inicializa los listeners de la nueva cámara
    
    // Detectar si es dispositivo móvil (usar setTimeout para evitar error Angular)
    setTimeout(() => {
      this.detectMobile();
      this.cdr.detectChanges();
      
      // Inicializar controles móviles si es necesario
      if (this.isMobile) {
        this.initMobileControls();
      }
    }, 0);

    // Iniciar el bucle de animación
    this.animate();

    // 1. Cargar el mundo (suelo infinito y objetos del GLB)
    this.worldController = new WorldController(this.scene, this.world);
    this.worldController.loadWorld().then(() => {
      console.log('🌍 Mundo cargado correctamente');

      // 2. Cargar el coche DESPUÉS de que el mundo exista
      const loader = new GLTFLoader();
      loader.load('models/car.glb', (gltf) => {
        const carMesh = gltf.scene;
        this.scene.add(carMesh);

        this.vehicle = new VehicleController(this.world);
        this.vehicle.loadCar(carMesh);

        // Mejorar materiales del coche
        carMesh.traverse((child: any) => {
          if (child.isMesh) {
            if (child.material.isMeshStandardMaterial) {
               child.material.metalness = Math.max(child.material.metalness, 0.5);
               child.material.roughness = Math.min(child.material.roughness, 0.6);
            } else {
              child.material = new THREE.MeshStandardMaterial({
                color: child.material.color || new THREE.Color(0xffffff),
                metalness: 0.5,
                roughness: 0.4
              });
            }
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        
        // Posicionar cámara inicialmente
        this.lastCarPosition.copy(this.vehicle.chassisBody.position);
        this.updateCamera(0);
        
        console.log('🚗 Coche cargado y posicionado correctamente');
      });
    });
  }

  private initScene(): void {
    this.scene = new THREE.Scene();
    const bgColor = 0xFFF5E1;
    this.scene.background = new THREE.Color(bgColor);

    // --- ARREGLO: Cámara con menos FOV ---
    this.camera = new THREE.PerspectiveCamera(
      55, // FOV más bajo (de 75)
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.set(10, 10, 15);
    // ------------------------------------

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.rendererCanvas.nativeElement,
      antialias: true
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Suavizado de sombras
    this.renderer.shadowMap.autoUpdate = true; // Actualización automática
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    // ===========================================
    // 🌞 CONFIGURACIÓN AVANZADA DE SOMBRAS
    // ===========================================
    const sunLight = new THREE.DirectionalLight(0xFFE4B5, 2.2); // Color sol más cálido
    sunLight.position.set(30, 40, 20); // Posición del sol más alta
    sunLight.castShadow = true;
    
    // 🎯 RESOLUCIÓN ULTRA ALTA DE SOMBRAS
    sunLight.shadow.mapSize.width = 16384; // Resolución máxima
    sunLight.shadow.mapSize.height = 16384;
    
    // 📐 CONFIGURACIÓN DE CÁMARA DE SOMBRAS
    sunLight.shadow.camera.near = 0.1;
    sunLight.shadow.camera.far = 500; // Mayor rango
    sunLight.shadow.camera.left = -150; // Área más amplia
    sunLight.shadow.camera.right = 150;
    sunLight.shadow.camera.top = 150;
    sunLight.shadow.camera.bottom = -150;
    
    // 🎨 FILTROS DE SUAVIZADO AVANZADOS
    sunLight.shadow.bias = -0.00005; // Bias muy pequeño para reducir artefactos
    sunLight.shadow.normalBias = 0.08; // Normal bias aumentado para suavizar bordes
    sunLight.shadow.radius = 12; // Radio de suavizado aumentado
    
    // 🔧 CONFIGURACIÓN ADICIONAL PARA CALIDAD
    sunLight.shadow.blurSamples = 25; // Más muestras para mejor calidad
    sunLight.shadow.updateMatrices(sunLight); // Actualizar matrices

    this.scene.add(sunLight);

    // Luz de relleno del cielo
    const fillLight = new THREE.DirectionalLight(0xB0E0E6, 0.6); // Azul cielo más suave
    fillLight.position.set(-20, 25, -15);
    this.scene.add(fillLight);

    // Luz ambiental cálida y suave
    const ambientLight = new THREE.AmbientLight(0xFFF8DC, 0.8); // Ambiente más cálido
    this.scene.add(ambientLight);

    // Luz adicional para suavizar sombras
    const rimLight = new THREE.DirectionalLight(0xFFF5E6, 0.3);
    rimLight.position.set(10, 15, -20);
    this.scene.add(rimLight);

    // Mundo físico
    this.world = new CANNON.World();
    this.world.gravity.set(0, -9.82, 0);
    this.world.broadphase = new CANNON.SAPBroadphase(this.world); 
    this.world.defaultContactMaterial.friction = 0.1;

    // --- ARREGLO: Materiales de Contacto ---
    // Coche vs Mundo (suelo y objetos)
    const carWorldContact = new CANNON.ContactMaterial(
      chassisMaterial, worldMaterial,
      { 
        friction: 0.4, // Fricción para tracción
        restitution: 0.1 
      }
    );
    this.world.addContactMaterial(carWorldContact);
    // ------------------------------------
    
    // --- ARREGLO: Configuración de Post-Procesado (Desenfoque) ---
    this.composer = new EffectComposer(this.renderer);
    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);

    this.bokehPass = new BokehPass(this.scene, this.camera, {
      focus: 25.0,      // Distancia de enfoque aumentada
      aperture: 0.00005, // Desenfoque más notable
      maxblur: 0.002,   // Desenfoque máximo más visible en bordes
      width: window.innerWidth,
      height: window.innerHeight
    } as any);
    this.composer.addPass(this.bokehPass);
    // -----------------------------------------------------------
  }

  // --- ARREGLO: Listeners para la nueva cámara ---
  private initCameraControls(): void {
    // Eventos de mouse (desktop)
    this.renderer.domElement.addEventListener('wheel', this.onMouseWheel.bind(this), { passive: false });
    this.renderer.domElement.addEventListener('mousedown', this.onMouseDown.bind(this));
    window.addEventListener('mousemove', this.onMouseMove.bind(this));
    window.addEventListener('mouseup', this.onMouseUp.bind(this));
    
    // Eventos táctiles (móvil) para controles de cámara
    this.renderer.domElement.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: false });
    this.renderer.domElement.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false });
    this.renderer.domElement.addEventListener('touchend', this.onTouchEnd.bind(this), { passive: false });
    
    // Listeners de teclado para detectar conducción
    window.addEventListener('keydown', (e) => (this.keys[e.key.toLowerCase()] = true));
    window.addEventListener('keyup', (e) => (this.keys[e.key.toLowerCase()] = false));
  }

  // ===========================================
  // 📱 DETECCIÓN Y CONTROLES MÓVILES
  // ===========================================
  private detectMobile(): void {
    // Detectar dispositivo móvil por User Agent y tamaño de pantalla
    const userAgent = navigator.userAgent.toLowerCase();
    const isMobileUA = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
    const isMobileSize = window.innerWidth <= 768 || window.innerHeight <= 768;
    
    this.isMobile = isMobileUA || isMobileSize;
    console.log(`📱 Dispositivo móvil detectado: ${this.isMobile}`);
  }

  private initMobileControls(): void {
    if (!this.joystickContainer || !this.joystickKnob) return;
    
    // Configurar joystick
    this.setupJoystick();
    
    // Configurar botones
    this.setupMobileButtons();
  }

  private setupJoystick(): void {
    const container = this.joystickContainer.nativeElement;
    const knob = this.joystickKnob.nativeElement;
    
    // Obtener posición central del joystick
    const rect = container.getBoundingClientRect();
    this.joystickCenter = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };
    
    // Eventos táctiles
    knob.addEventListener('touchstart', this.onJoystickStart.bind(this), { passive: false });
    knob.addEventListener('touchmove', this.onJoystickMove.bind(this), { passive: false });
    knob.addEventListener('touchend', this.onJoystickEnd.bind(this), { passive: false });
    
    // Eventos de mouse (para testing en desktop) - Mejorados
    knob.addEventListener('mousedown', this.onJoystickStart.bind(this));
    document.addEventListener('mousemove', this.onJoystickMove.bind(this));
    document.addEventListener('mouseup', this.onJoystickEnd.bind(this));
  }

  private setupMobileButtons(): void {
    if (!this.accelerateBtn || !this.brakeBtn) return;
    
    // Botón acelerar
    this.accelerateBtn.nativeElement.addEventListener('touchstart', () => {
      this.mobileAccelerate = true;
    }, { passive: false });
    this.accelerateBtn.nativeElement.addEventListener('touchend', () => {
      this.mobileAccelerate = false;
    }, { passive: false });
    
    // Botón frenar
    this.brakeBtn.nativeElement.addEventListener('touchstart', () => {
      this.mobileBrake = true;
    }, { passive: false });
    this.brakeBtn.nativeElement.addEventListener('touchend', () => {
      this.mobileBrake = false;
    }, { passive: false });
  }

  private onJoystickStart(event: TouchEvent | MouseEvent): void {
    this.joystickActive = true;
    event.preventDefault();
  }

  private onJoystickMove(event: TouchEvent | MouseEvent): void {
    if (!this.joystickActive) return;
    
    event.preventDefault();
    
    const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
    const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;
    
    // Calcular dirección del joystick
    const deltaX = clientX - this.joystickCenter.x;
    const deltaY = clientY - this.joystickCenter.y;
    
    // Limitar distancia máxima
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const limitedDistance = Math.min(distance, this.joystickMaxDistance);
    
    // Calcular dirección normalizada
    this.joystickDirection = {
      x: limitedDistance > 0 ? (deltaX / distance) * (limitedDistance / this.joystickMaxDistance) : 0,
      y: limitedDistance > 0 ? (deltaY / distance) * (limitedDistance / this.joystickMaxDistance) : 0
    };
    
    // Mover knob visualmente
    const knob = this.joystickKnob.nativeElement;
    knob.style.transform = `translate(${this.joystickDirection.x * this.joystickMaxDistance}px, ${this.joystickDirection.y * this.joystickMaxDistance}px)`;
  }

  private onJoystickEnd(event: TouchEvent | MouseEvent): void {
    this.joystickActive = false;
    this.joystickDirection = { x: 0, y: 0 };
    
    // Resetear posición del knob
    const knob = this.joystickKnob.nativeElement;
    knob.style.transform = 'translate(0px, 0px)';
    
    event.preventDefault();
  }

  private onMouseWheel(event: WheelEvent): void {
    event.preventDefault();
    // Controla el zoom con la rueda (límites más restrictivos)
    const zoomAmount = event.deltaY * 0.003;
    this.cameraScrollZoom = Math.max(0.8, Math.min(1.5, this.cameraScrollZoom + zoomAmount)); // Zoom más limitado
  }

  private onMouseDown(event: MouseEvent): void {
    if (event.button === 0) { // Click izquierdo
      this.isPanning = true;
      this.isDetached = true; // Desconectar cámara del coche
      this.lastMouseX = event.clientX;
      this.lastMouseY = event.clientY;
    }
  }

  private onMouseMove(event: MouseEvent): void {
    if (!this.isPanning) return;
    // Controla el paneo horizontal y vertical
    const deltaX = event.clientX - this.lastMouseX;
    const deltaY = event.clientY - this.lastMouseY;
    this.lastMouseX = event.clientX;
    this.lastMouseY = event.clientY;
    
    // Compensación trigonométrica para movimiento más "recto" en vista isométrica
    const angle = Math.PI / 4; // Ángulo de la vista isométrica
    const compensatedX = deltaY * Math.cos(angle) - deltaX * Math.sin(angle);
    const compensatedZ = deltaY * Math.sin(angle) + deltaX * Math.cos(angle);
    
    // Aplicar movimiento compensado
    this.cameraPanOffset.x += compensatedX * 0.02;
    this.cameraPanOffset.z += compensatedZ * 0.02; 
    
    // Limitar el paneo
    this.cameraPanOffset.x = Math.max(-20, Math.min(20, this.cameraPanOffset.x));
    this.cameraPanOffset.z = Math.max(-20, Math.min(20, this.cameraPanOffset.z));
  }
  
  private onMouseUp(event: MouseEvent): void {
    if (event.button === 0) {
      this.isPanning = false;
    }
  }

  // ===========================================
  // 📱 CONTROLES TÁCTILES PARA CÁMARA
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
    
    // Usar la misma lógica que el mouse pero con coordenadas táctiles
    const deltaX = event.touches[0].clientX - this.lastMouseX;
    const deltaY = event.touches[0].clientY - this.lastMouseY;
    this.lastMouseX = event.touches[0].clientX;
    this.lastMouseY = event.touches[0].clientY;
    
    // Compensación trigonométrica para movimiento más "recto" en vista isométrica
    const angle = Math.PI / 4;
    const compensatedX = deltaY * Math.cos(angle) - deltaX * Math.sin(angle);
    const compensatedZ = deltaY * Math.sin(angle) + deltaX * Math.cos(angle);
    
    // Aplicar movimiento compensado
    this.cameraPanOffset.x += compensatedX * 0.02;
    this.cameraPanOffset.z += compensatedZ * 0.02;
    
    // Limitar el paneo
    this.cameraPanOffset.x = Math.max(-20, Math.min(20, this.cameraPanOffset.x));
    this.cameraPanOffset.z = Math.max(-20, Math.min(20, this.cameraPanOffset.z));
  }

  private onTouchEnd(event: TouchEvent): void {
    if (event.touches.length === 0) {
      this.isPanning = false;
    }
    event.preventDefault();
  }
  // --- FIN Listeners ---


  // --- ARREGLO: Bucle de actualización de cámara isométrica ---
  private updateCamera(delta: number): void {
    if (!this.vehicle) return;

    const carPos = this.vehicle.chassisBody.position;

    // Detectar si el usuario está conduciendo
    const isDriving = this.keys['w'] || this.keys['arrowup'] || 
                     this.keys['s'] || this.keys['arrowdown'] ||
                     this.keys['a'] || this.keys['arrowleft'] ||
                     this.keys['d'] || this.keys['arrowright'];

    // Si está conduciendo, reconectar automáticamente la cámara al coche
    if (isDriving && this.isDetached) {
      this.isDetached = false;
      this.isPanning = false;
    }

    // Actualizar posición del coche solo si no está desconectada
    if (!this.isDetached) {
      if (carPos.distanceTo(this.lastCarPosition) > 0.01) {
        this.lastCarPosition.copy(carPos);
      }
    }

    // Suavizado del paneo solo si no está desconectada
    if (!this.isDetached && !this.isPanning) {
      this.cameraPanOffset.lerp(new THREE.Vector3(0, 0, 0), delta * 3.0);
    }

    // Offset isométrico fijo
    const offset = this.cameraIdealOffset.clone().multiplyScalar(this.cameraScrollZoom);

    // Aplicar paneo
    const pan = this.cameraPanOffset.clone();

    // Posición ideal de la cámara
    const idealPos = new THREE.Vector3().addVectors(carPos as any, offset).add(pan);

    // Punto al que mirar (coche o posición fija si está desconectada)
    let lookatPoint: THREE.Vector3;
    if (this.isDetached) {
      // Si está desconectada, mirar al punto donde estaba el coche + offset de paneo
      lookatPoint = new THREE.Vector3().addVectors(this.lastCarPosition as any, pan);
    } else {
      // Si está conectada, mirar al coche
      lookatPoint = new THREE.Vector3().addVectors(carPos as any, this.cameraIdealLookat);
    }

    // Suavizado de movimiento
    this.cameraTarget.lerp(lookatPoint, delta * 2.0);
    this.camera.position.lerp(idealPos, delta * 3.0);
    this.camera.lookAt(this.cameraTarget);

    // DoF muy sutil solo en bordes
    const distance = this.camera.position.distanceTo(carPos as any);
    (this.bokehPass.uniforms as any)['focus'].value = distance;
    (this.bokehPass.uniforms as any)['aperture'].value = 0.000005 * Math.max(1, distance / 25.0);
  }

  // --- FIN Bucle de cámara ---

  private animate(): void {
    requestAnimationFrame(() => this.animate());

    const delta = 1 / 60; // Asumimos 60 FPS fijos

    // Físicas
    this.world.step(delta);
    
    // Preparar controles móviles si es necesario
    const mobileControls = this.isMobile ? {
      accelerate: this.mobileAccelerate,
      brake: this.mobileBrake,
      steerX: this.joystickDirection.x,
      steerY: this.joystickDirection.y
    } : undefined;
    
    this.vehicle?.update(delta, mobileControls);
    this.worldController?.update();

    // Actualizar cámara personalizada
    this.updateCamera(delta);
 
    // this.renderer.render(this.scene, this.camera); // --- ARREGLO: Reemplazado por el composer ---
    this.composer.render(); // Usa el composer para renderizar con el efecto de desenfoque
  }
}