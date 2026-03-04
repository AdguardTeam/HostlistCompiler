/**
 * Angular PoC - Application Bootstrap (Server)
 *
 * Angular 21 SSR Pattern: Server-side rendering entry point
 * Used by @angular/ssr to render the app on the server.
 *
 * The bootstrap function MUST accept the context argument supplied by
 * @angular/ssr's `getRoutesFromAngularRouterConfig` (and the render engine).
 * Without it, all SSR routes throw:
 *   NG0401: Missing Platform: bootstrapApplication called on the server
 *   without a BootstrapContext.
 */

import { bootstrapApplication, BootstrapContext } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appServerConfig } from './app/app.config.server';

const bootstrap = (ctx?: BootstrapContext) =>
    bootstrapApplication(AppComponent, appServerConfig, ctx);

export default bootstrap;
