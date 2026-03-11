// AdBlock Compiler — mdBook custom JS
// Inject a PDF download link into the top navigation bar
(function () {
    function injectPdfLink() {
        // Try to find the nav buttons area in mdBook's theme
        const nav = document.querySelector('.right-buttons') || document.querySelector('nav.nav-wrapper .right-buttons');
        if (!nav) return;

        // Avoid injecting twice
        if (document.getElementById('pdf-download-link')) return;

        const link = document.createElement('a');
        link.id = 'pdf-download-link';
        link.href = '/pdf/adblock-compiler.pdf';
        link.title = 'Download PDF';
        link.setAttribute('aria-label', 'Download documentation as PDF');
        link.style.cssText = 'display:inline-flex;align-items:center;gap:4px;padding:0 8px;font-size:0.85em;opacity:0.8;';
        link.innerHTML = '&#x1F4C4; PDF';
        link.target = '_blank';
        link.rel = 'noopener noreferrer';

        nav.appendChild(link);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectPdfLink);
    } else {
        injectPdfLink();
    }
})();
