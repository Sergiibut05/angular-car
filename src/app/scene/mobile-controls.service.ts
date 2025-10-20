/**
 * Mobile Controls Service
 * 
 * Responsabilidad: Manejo de controles táctiles para dispositivos móviles,
 * incluyendo joystick virtual y botones de acelerar/frenar.
 * 
 * Principios aplicados:
 * - Single Responsibility: Solo maneja controles móviles
 * - Observer Pattern: Notifica cambios de estado
 * - Clean Code: Métodos pequeños y bien nombrados
 */

import { Injectable, ElementRef } from '@angular/core';

export interface JoystickState {
  x: number; // -1 a 1
  y: number; // -1 a 1
  active: boolean;
}

export interface MobileControlsState {
  accelerate: boolean;
  brake: boolean;
  steerX: number;
  steerY: number;
}

@Injectable({
  providedIn: 'root'
})
export class MobileControlsService {
  // Estado del joystick
  private joystickActive = false;
  private joystickCenter = { x: 0, y: 0 };
  private joystickMaxDistance = 50;
  private joystickDirection = { x: 0, y: 0 };
  
  // Estado de botones móviles
  private mobileAccelerate = false;
  private mobileBrake = false;

  // Callbacks para notificar cambios
  private onStateChange?: (state: MobileControlsState) => void;

  /**
   * Detecta si el dispositivo es móvil
   */
  isMobileDevice(): boolean {
    const userAgent = navigator.userAgent.toLowerCase();
    const isMobileUA = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
    const isMobileSize = window.innerWidth <= 768 || window.innerHeight <= 768;
    
    return isMobileUA || isMobileSize;
  }

  /**
   * Inicializa los controles móviles
   * @param joystickContainer Contenedor del joystick
   * @param joystickKnob Knob del joystick
   * @param accelerateBtn Botón de acelerar
   * @param brakeBtn Botón de frenar
   * @param onStateChangeCallback Callback para cambios de estado
   */
  initControls(
    joystickContainer: ElementRef<HTMLDivElement>,
    joystickKnob: ElementRef<HTMLDivElement>,
    accelerateBtn: ElementRef<HTMLButtonElement>,
    brakeBtn: ElementRef<HTMLButtonElement>,
    onStateChangeCallback?: (state: MobileControlsState) => void
  ): void {
    this.onStateChange = onStateChangeCallback;
    
    if (!joystickContainer || !joystickKnob) return;
    
    this.setupJoystick(joystickContainer, joystickKnob);
    this.setupMobileButtons(accelerateBtn, brakeBtn);
  }

  /**
   * Obtiene el estado actual de los controles móviles
   */
  getCurrentState(): MobileControlsState {
    return {
      accelerate: this.mobileAccelerate,
      brake: this.mobileBrake,
      steerX: this.joystickDirection.x,
      steerY: this.joystickDirection.y
    };
  }

  /**
   * Configura el joystick virtual
   */
  private setupJoystick(
    container: ElementRef<HTMLDivElement>,
    knob: ElementRef<HTMLDivElement>
  ): void {
    const containerEl = container.nativeElement;
    const knobEl = knob.nativeElement;
    
    // Obtener posición central del joystick
    const rect = containerEl.getBoundingClientRect();
    this.joystickCenter = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };
    
    // Eventos táctiles
    knobEl.addEventListener('touchstart', this.onJoystickStart.bind(this), { passive: false });
    knobEl.addEventListener('touchmove', this.onJoystickMove.bind(this), { passive: false });
    knobEl.addEventListener('touchend', this.onJoystickEnd.bind(this), { passive: false });
    
    // Eventos de mouse (para testing en desktop)
    knobEl.addEventListener('mousedown', this.onJoystickStart.bind(this));
    document.addEventListener('mousemove', this.onJoystickMove.bind(this));
    document.addEventListener('mouseup', this.onJoystickEnd.bind(this));
  }

  /**
   * Configura los botones móviles
   */
  private setupMobileButtons(
    accelerateBtn: ElementRef<HTMLButtonElement>,
    brakeBtn: ElementRef<HTMLButtonElement>
  ): void {
    if (!accelerateBtn || !brakeBtn) return;
    
    // Botón acelerar
    accelerateBtn.nativeElement.addEventListener('touchstart', () => {
      this.mobileAccelerate = true;
      this.notifyStateChange();
    }, { passive: false });
    
    accelerateBtn.nativeElement.addEventListener('touchend', () => {
      this.mobileAccelerate = false;
      this.notifyStateChange();
    }, { passive: false });
    
    // Botón frenar
    brakeBtn.nativeElement.addEventListener('touchstart', () => {
      this.mobileBrake = true;
      this.notifyStateChange();
    }, { passive: false });
    
    brakeBtn.nativeElement.addEventListener('touchend', () => {
      this.mobileBrake = false;
      this.notifyStateChange();
    }, { passive: false });
  }

  /**
   * Maneja el inicio del joystick
   */
  private onJoystickStart(event: TouchEvent | MouseEvent): void {
    this.joystickActive = true;
    event.preventDefault();
  }

  /**
   * Maneja el movimiento del joystick
   */
  private onJoystickMove(event: TouchEvent | MouseEvent): void {
    if (!this.joystickActive) return;
    
    event.preventDefault();
    
    const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
    const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;
    
    this.updateJoystickPosition(clientX, clientY);
  }

  /**
   * Maneja el fin del joystick
   */
  private onJoystickEnd(event: TouchEvent | MouseEvent): void {
    this.joystickActive = false;
    this.joystickDirection = { x: 0, y: 0 };
    
    // Resetear posición del knob visualmente
    this.updateJoystickVisualPosition(0, 0);
    
    event.preventDefault();
    this.notifyStateChange();
  }

  /**
   * Actualiza la posición del joystick
   */
  private updateJoystickPosition(clientX: number, clientY: number): void {
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
    this.updateJoystickVisualPosition(
      this.joystickDirection.x * this.joystickMaxDistance,
      this.joystickDirection.y * this.joystickMaxDistance
    );
    
    this.notifyStateChange();
  }

  /**
   * Actualiza la posición visual del joystick
   */
  private updateJoystickVisualPosition(x: number, y: number): void {
    // Esta función debería ser llamada desde el componente que tiene acceso al DOM
    // Por ahora solo actualizamos el estado interno
  }

  /**
   * Notifica cambios de estado a los observadores
   */
  private notifyStateChange(): void {
    if (this.onStateChange) {
      this.onStateChange(this.getCurrentState());
    }
  }

  /**
   * Resetea todos los controles móviles
   */
  reset(): void {
    this.joystickActive = false;
    this.joystickDirection = { x: 0, y: 0 };
    this.mobileAccelerate = false;
    this.mobileBrake = false;
    this.notifyStateChange();
  }
}
