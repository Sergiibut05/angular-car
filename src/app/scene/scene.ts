// scene.ts

import { Component, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { GLTFLoader } from 'three-stdlib';
import { VehicleController, chassisMaterial } from './vehicle.controller';
// import { OrbitControls } from 'three-stdlib'; // --- ARREGLO: ELIMINADO ---
import { WorldController, worldMaterial } from './world.controller';


// --- ARREGLO: Imports para Post-Procesado (Desenfoque) ---
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
// ---------------------------------------------------------

@Component({
  selector: 'app-scene',
  templateUrl: './scene.html',
  styleUrls: ['./scene.scss'],
  // imports: [], // Asegúrate de que esto esté bien en tu proyecto Angular
  // standalone: true, 
})
export class Scene implements AfterViewInit {

  @ViewChild('rendererCanvas', { static: true })
  rendererCanvas!: ElementRef<HTMLCanvasElement>;
  
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
  // -----------------------------------------------

  ngAfterViewInit(): void {
    this.initScene();
    this.initCameraControls(); // Inicializa los listeners de la nueva cámara

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
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    // Iluminación profesional y confortable
    const sunLight = new THREE.DirectionalLight(0xfff8dc, 1.8); // Luz cálida y suave
    sunLight.position.set(25, 35, 15); // Posición del sol
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 4096; 
    sunLight.shadow.mapSize.height = 4096;
    sunLight.shadow.camera.near = 0.1;
    sunLight.shadow.camera.far = 200;
    sunLight.shadow.camera.left = -80; 
    sunLight.shadow.camera.right = 80;
    sunLight.shadow.camera.top = 80;
    sunLight.shadow.camera.bottom = -80;
    sunLight.shadow.bias = -0.0005; // Reducir artefactos de sombra
    sunLight.shadow.normalBias = 0.02; // Suavizar sombras
    this.scene.add(sunLight);

    // Luz de relleno suave
    const fillLight = new THREE.DirectionalLight(0x87CEEB, 0.4); // Azul cielo suave
    fillLight.position.set(-15, 20, -10);
    this.scene.add(fillLight);

    // Luz ambiental cálida
    const ambientLight = new THREE.AmbientLight(0xfff5e6, 0.6); // Ambiente cálido
    this.scene.add(ambientLight);

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
      focus: 20.0,      // Distancia de enfoque
      aperture: 0.00001, // Desenfoque muy sutil
      maxblur: 0.0005,   // Desenfoque máximo muy pequeño (solo bordes)
      width: window.innerWidth,
      height: window.innerHeight
    } as any);
    this.composer.addPass(this.bokehPass);
    // -----------------------------------------------------------
  }

  // --- ARREGLO: Listeners para la nueva cámara ---
  private initCameraControls(): void {
    this.renderer.domElement.addEventListener('wheel', this.onMouseWheel.bind(this), { passive: false });
    this.renderer.domElement.addEventListener('mousedown', this.onMouseDown.bind(this));
    window.addEventListener('mousemove', this.onMouseMove.bind(this));
    window.addEventListener('mouseup', this.onMouseUp.bind(this));
    
    // Listeners de teclado para detectar conducción
    window.addEventListener('keydown', (e) => (this.keys[e.key.toLowerCase()] = true));
    window.addEventListener('keyup', (e) => (this.keys[e.key.toLowerCase()] = false));
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
    
    // Paneo isométrico corregido: invertir direcciones para movimiento natural
    this.cameraPanOffset.x += deltaX * 0.08; // Mouse izquierda -> cámara derecha (invertido)
    this.cameraPanOffset.z -= deltaY * 0.08; // Mouse arriba -> cámara arriba, mouse abajo -> cámara abajo
    
    // Limitar el paneo
    this.cameraPanOffset.x = Math.max(-20, Math.min(20, this.cameraPanOffset.x));
    this.cameraPanOffset.z = Math.max(-20, Math.min(20, this.cameraPanOffset.z));
  }
  
  private onMouseUp(event: MouseEvent): void {
    if (event.button === 0) {
      this.isPanning = false;
    }
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
    this.vehicle?.update(delta);
    this.worldController?.update();

    // Actualizar cámara personalizada
    this.updateCamera(delta);
 
    // this.renderer.render(this.scene, this.camera); // --- ARREGLO: Reemplazado por el composer ---
    this.composer.render(); // Usa el composer para renderizar con el efecto de desenfoque
  }
}