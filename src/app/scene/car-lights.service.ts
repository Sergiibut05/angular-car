/**
 * Car Lights Service
 * 
 * Responsabilidad: Manejo del sistema de luces delanteras del coche,
 * incluyendo configuración, activación y transiciones.
 * 
 * Principios aplicados:
 * - Single Responsibility: Solo maneja las luces delanteras del coche
 * - State Management: Mantiene el estado de las luces
 * - Clean Code: Métodos pequeños y bien nombrados
 */

import * as THREE from 'three';
import { CAR_LIGHTS_CONFIG, CAR_MATERIALS_CONFIG } from './game.constants';

export interface CarLightsState {
  headlightsOn: boolean;
}

export class CarLightsService {
  // Referencias a las luces
  private headlightMesh?: THREE.Mesh;
  private headlightMaterial?: THREE.MeshStandardMaterial;
  
  // Colores de las luces
  private headlightOnColor = new THREE.Color(CAR_LIGHTS_CONFIG.HEADLIGHT_ON_COLOR);
  private headlightOffColor = new THREE.Color(CAR_LIGHTS_CONFIG.HEADLIGHT_OFF_COLOR);

  /**
   * Configura las luces del coche buscando por nombre de material
   * @param carMesh Mesh del coche donde buscar las luces
   */
  setupCarLights(carMesh: THREE.Group): void {
    carMesh.traverse((child) => {
      if ((child as THREE.Mesh).isMesh && (child as THREE.Mesh).material) {
        const mesh = child as THREE.Mesh;
        const material = mesh.material;
        
        // Manejar materiales en array - tomar el primer material
        let materialToUse: THREE.Material;
        let materialName: string | undefined;
        
        if (Array.isArray(material)) {
          materialToUse = material[0];
          materialName = (material[0] as any).name;
        } else {
          materialToUse = material;
          materialName = (material as any).name;
        }
        
        this.setupHeadlights(mesh, materialToUse, materialName);
      }
    });

    this.logSetupResults();
  }

  /**
   * Configura las luces delanteras
   */
  private setupHeadlights(mesh: THREE.Mesh, material: THREE.Material, materialName?: string): void {
    if (materialName === CAR_MATERIALS_CONFIG.HEADLIGHT_MATERIAL_NAME) {
      this.headlightMesh = mesh;
      this.headlightMaterial = this.createOrConfigureMaterial(
        material,
        this.headlightOffColor,
        new THREE.Color(0x000000)
      );
      mesh.material = this.headlightMaterial;
    }
  }

  /**
   * Crea o configura un material para las luces
   */
  private createOrConfigureMaterial(
    existingMaterial: THREE.Material,
    color: THREE.Color,
    emissive: THREE.Color
  ): THREE.MeshStandardMaterial {
    if (!(existingMaterial instanceof THREE.MeshStandardMaterial)) {
      return new THREE.MeshStandardMaterial({
        color: color,
        emissive: emissive,
        metalness: 0.1,
        roughness: 0.2
      });
    } else {
      const material = existingMaterial as THREE.MeshStandardMaterial;
      material.color.copy(color);
      material.emissive.copy(emissive);
      return material;
    }
  }

  /**
   * Registra los resultados de la configuración
   */
  private logSetupResults(): void {
    if (!this.headlightMesh) {
      console.warn(`⚠️ No se encontraron luces delanteras (material: ${CAR_MATERIALS_CONFIG.HEADLIGHT_MATERIAL_NAME})`);
    }
  }

  /**
   * Actualiza las luces basándose en el estado del vehículo
   * @param engineForce Fuerza del motor aplicada
   * @param currentSpeedMs Velocidad actual en m/s
   */
  updateLights(engineForce: number, currentSpeedMs: number): void {
    this.updateHeadlights(engineForce);
  }

  /**
   * Actualiza las luces delanteras
   */
  private updateHeadlights(engineForce: number): void {
    if (!this.headlightMaterial) return;

    const isAcceleratingForward = engineForce < CAR_LIGHTS_CONFIG.ACCELERATION_THRESHOLD;
    
    if (isAcceleratingForward) {
      this.turnOnHeadlights();
    } else {
      this.turnOffHeadlights();
    }
  }

  /**
   * Enciende las luces delanteras
   */
  private turnOnHeadlights(): void {
    if (!this.headlightMaterial) return;
    
    this.headlightMaterial.color.lerp(this.headlightOnColor, CAR_LIGHTS_CONFIG.LIGHT_LERP_SPEED_ON);
    this.headlightMaterial.emissive.lerp(
      new THREE.Color(CAR_LIGHTS_CONFIG.HEADLIGHT_EMISSIVE_ON), 
      CAR_LIGHTS_CONFIG.LIGHT_LERP_SPEED_ON
    );
  }

  /**
   * Apaga las luces delanteras
   */
  private turnOffHeadlights(): void {
    if (!this.headlightMaterial) return;
    
    this.headlightMaterial.color.lerp(this.headlightOffColor, CAR_LIGHTS_CONFIG.LIGHT_LERP_SPEED_OFF);
    this.headlightMaterial.emissive.lerp(
      new THREE.Color(CAR_LIGHTS_CONFIG.HEADLIGHT_EMISSIVE_OFF), 
      CAR_LIGHTS_CONFIG.LIGHT_LERP_SPEED_OFF
    );
  }

  /**
   * Obtiene el estado actual de las luces
   */
  getLightsState(): CarLightsState {
    return {
      headlightsOn: this.headlightMaterial ? 
        this.headlightMaterial.color.equals(this.headlightOnColor) : false
    };
  }

  /**
   * Resetea todas las luces al estado apagado
   */
  resetLights(): void {
    if (this.headlightMaterial) {
      this.headlightMaterial.color.copy(this.headlightOffColor);
      this.headlightMaterial.emissive.set(0x000000);
    }
  }
}
