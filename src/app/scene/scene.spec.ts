import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Scene } from './scene';

describe('Scene', () => {
  let component: Scene;
  let fixture: ComponentFixture<Scene>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Scene]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Scene);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
