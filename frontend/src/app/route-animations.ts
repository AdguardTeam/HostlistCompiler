/**
 * Route Transition Animations
 *
 * Defines a fade-in/out animation trigger for route transitions.
 * Applied to the <router-outlet> container in AppComponent.
 *
 * Uses Angular's animation DSL with :enter/:leave transitions
 * for a clean crossfade between routes.
 */

import { trigger, transition, style, animate, query, group } from '@angular/animations';

export const routeAnimation = trigger('routeAnimation', [
    transition('* <=> *', [
        // Set up: both entering and leaving views positioned absolutely
        query(':enter, :leave', [
            style({
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
            }),
        ], { optional: true }),

        // Run leave and enter in parallel
        group([
            query(':leave', [
                animate('200ms ease-out', style({ opacity: 0 })),
            ], { optional: true }),
            query(':enter', [
                style({ opacity: 0 }),
                animate('300ms 100ms ease-in', style({ opacity: 1 })),
            ], { optional: true }),
        ]),
    ]),
]);
