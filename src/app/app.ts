import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Scene } from "./scene/scene";

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Scene],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('angular-car');
}
