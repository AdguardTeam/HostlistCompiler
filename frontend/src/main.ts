/**
 * Angular PoC - Application Bootstrap (Browser)
 *
 * Angular 21 Pattern: Application bootstrap using app.config.ts
 * Supports both browser and server-side rendering
 */

import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

bootstrapApplication(AppComponent, appConfig)
    .catch((err) => console.error(err));
