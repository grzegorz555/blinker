import { Component } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

/** Placeholder home page; the communication screen arrives in stage 2. */
@Component({
  selector: 'app-home',
  imports: [TranslocoPipe],
  templateUrl: './home.html',
})
export class Home {}
