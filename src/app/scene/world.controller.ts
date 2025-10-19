// world.controller.ts

import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Material físico único
export const worldMaterial = new CANNON.Material('world');

export class WorldController {
  private loader = new GLTFLoader();
  public worldMesh!: THREE.Group;
  
  // Lista de cuerpos físicos para limpieza
  private physicsBodies: CANNON.Body[] = [];

  constructor(private scene: THREE.Scene, private world: CANNON.World) {}

  async loadWorld(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Crear suelo infinito primero
      this.createInfiniteGround();

      this.loader.load(
        'models/world.glb',
        (gltf) => {
          this.worldMesh = gltf.scene;
          this.scene.add(this.worldMesh);

          // Configurar luces del modelo
          this.setupImportedLights();

          // Procesar todos los objetos como chocables estáticos
          this.processWorldObjects();

          console.log('✅ Mundo cargado correctamente');
          resolve();
        },
        undefined,
        (error) => {
          console.error('❌ Error al cargar world.glb:', error);
          reject(error);
        }
      );
    });
  }

  // 🏠 Crear suelo infinito (visual y físico)
  private createInfiniteGround(): void {
    // Suelo visual infinito
    const groundGeometry = new THREE.PlaneGeometry(1000, 1000);
    const groundMaterial = new THREE.MeshLambertMaterial({ 
      color: 0xF5E6D3, // Beige pastel
      transparent: true,
      opacity: 0.9
    });
    
    const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
    groundMesh.rotation.x = -Math.PI / 2; // Horizontal
    groundMesh.position.y = 0; // En altura 0
    groundMesh.receiveShadow = true;
    this.scene.add(groundMesh);

    // Suelo físico infinito
    const groundShape = new CANNON.Plane();
    const groundBody = new CANNON.Body({ 
      mass: 0, // Estático
      material: worldMaterial,
      type: CANNON.Body.KINEMATIC
    });
    groundBody.addShape(groundShape);
    groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
    groundBody.position.set(0, 0, 0); // En altura 0
    this.world.addBody(groundBody);
    this.physicsBodies.push(groundBody);

    console.log('✅ Suelo infinito creado en altura 0');
  }

  // 💡 Configurar luces importadas del modelo
  private setupImportedLights(): void {
    this.worldMesh.traverse((child) => {
      if ((child as THREE.Light).isLight) {
        const light = child as THREE.Light;
        light.intensity *= 0.5; // Reducir intensidad
        
        if (light instanceof THREE.DirectionalLight) {
          light.castShadow = true;
          light.shadow.mapSize.width = 1024;
          light.shadow.mapSize.height = 1024;
        }
      }
    });
  }

  // 🔍 Procesar todos los objetos como chocables estáticos
  private processWorldObjects(): void {
    this.worldMesh.traverse((child: any) => {
      if (!child.isMesh) return;

      // Todos los objetos son chocables estáticos
      this.createStaticCollidableObject(child);
    });
  }

  // 🧱 Objetos estáticos chocables
  private createStaticCollidableObject(mesh: THREE.Mesh): void {
    console.log(`🔧 Creando objeto chocable: ${mesh.name}`);
    
    // Obtener posición y escala mundiales
    mesh.updateWorldMatrix(true, false);
    const worldPosition = new THREE.Vector3();
    const worldScale = new THREE.Vector3();
    mesh.getWorldPosition(worldPosition);
    mesh.getWorldScale(worldScale);

    // Obtener bounding box con escala mundial aplicada
    const geometry = mesh.geometry.clone();
    geometry.scale(worldScale.x, worldScale.y, worldScale.z);
    const box = new THREE.Box3().setFromBufferAttribute(geometry.attributes['position'] as THREE.BufferAttribute);
    const size = box.getSize(new THREE.Vector3());

    // Crear collider Box
    const halfExtents = new CANNON.Vec3(
      Math.max(0.1, size.x / 2),
      Math.max(0.1, size.y / 2), 
      Math.max(0.1, size.z / 2)
    );

    const body = new CANNON.Body({
      mass: 0, // Estático
      material: worldMaterial,
      position: new CANNON.Vec3(worldPosition.x, worldPosition.y, worldPosition.z),
      type: CANNON.Body.KINEMATIC
    });

    body.addShape(new CANNON.Box(halfExtents));
    this.world.addBody(body);
    this.physicsBodies.push(body);

    // Configurar sombras
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    console.log(`✅ Objeto chocable creado: ${mesh.name}`);
  }

  // 🌀 Actualizar (no hay objetos dinámicos que sincronizar)
  public update(): void {
    // No hay nada que actualizar, todos los objetos son estáticos
  }

  // 🧹 Limpiar recursos
  public dispose(): void {
    // Remover todos los cuerpos físicos
    this.physicsBodies.forEach(body => {
      this.world.removeBody(body);
    });
    this.physicsBodies = [];

    // Remover mesh del mundo
    if (this.worldMesh) {
      this.scene.remove(this.worldMesh);
    }

    console.log('🧹 Recursos del mundo limpiados');
  }

  // 📊 Información de debug
  public getDebugInfo(): any {
    const info = {
      totalMeshes: 0,
      staticObjects: 0,
      physicsBodies: this.physicsBodies.length
    };

    if (this.worldMesh) {
      this.worldMesh.traverse((child: any) => {
        if (child.isMesh) {
          info.totalMeshes++;
          info.staticObjects++;
        }
      });
    }

    return info;
  }
}