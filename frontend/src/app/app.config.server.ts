/**
 * Angular - Application Configuration (Server)
 *
 * Angular 21 SSR Pattern: Server-specific providers merged with browser config
 * Adds server-side rendering providers on top of the base app config
 *
 * Angular SSR 21.1+ Pattern: provideServerRendering(withRoutes()) replaces the
 * old provideServerRendering() + provideServerRoutesConfig() pair.
 */

import { mergeApplicationConfig, ApplicationConfig } from '@angular/core';
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';
import { API_BASE_URL } from './tokens';

const serverConfig: ApplicationConfig = {
    providers: [
        provideServerRendering(withRoutes(serverRoutes)),

        // Override API base URL for SSR — the server-side render needs an absolute
        // origin since there is no browser origin to resolve relative paths against.
        // Uses the same origin as the incoming request so this works on any deployment
        // (local wrangler dev, staging, production) without hardcoded hostnames.
        // The request origin is injected via Angular SSR's REQUEST token in production;
        // this value is the safe default that resolves correctly under wrangler dev.
        { provide: API_BASE_URL, useValue: '/api' },
    ],
};

export const appServerConfig = mergeApplicationConfig(appConfig, serverConfig);
