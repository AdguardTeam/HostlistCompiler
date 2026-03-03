/**
 * Angular PoC - Application Bootstrap (Server)
 *
 * Angular 21 SSR Pattern: Server-side rendering entry point
 * Used by @angular/ssr to render the app on the server
 */

import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appServerConfig } from './app/app.config.server';

const bootstrap = () => bootstrapApplication(AppComponent, appServerConfig);

export default bootstrap;
