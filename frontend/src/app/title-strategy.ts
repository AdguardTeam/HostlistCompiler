/**
 * Angular - Custom Title Strategy
 *
 * WCAG 2.4.2 (Page Titled) — Level A
 *
 * Appends the application name to every route title so each page
 * gets a unique, descriptive <title> element. Screen reader users
 * and keyboard/tab users can immediately identify the current page.
 *
 * Route config example:
 *   { path: 'compiler', title: 'Compiler', ... }
 *
 * Resulting document title:
 *   "Compiler | Adblock Compiler"
 *
 * When no title is defined on the route the fallback is just:
 *   "Adblock Compiler"
 */

import { Injectable } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';

const APP_NAME = 'Adblock Compiler';

@Injectable({ providedIn: 'root' })
export class AppTitleStrategy extends TitleStrategy {
    constructor(private readonly title: Title) {
        super();
    }

    override updateTitle(snapshot: RouterStateSnapshot): void {
        const routeTitle = this.buildTitle(snapshot);
        this.title.setTitle(routeTitle ? `${routeTitle} | ${APP_NAME}` : APP_NAME);
    }
}
