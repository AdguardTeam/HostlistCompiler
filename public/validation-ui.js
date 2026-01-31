/**
 * Validation UI Component
 *
 * Displays validation errors from agtree in a user-friendly format
 */

const ValidationUI = {
    /**
     * Render validation report in a container
     * @param {ValidationReport} report - The validation report
     * @param {HTMLElement} container - Container element
     */
    renderReport(report, container) {
        if (!report || !container) {
            return;
        }

        // Clear existing content
        container.innerHTML = '';

        // Create summary section
        const summary = this.createSummary(report);
        container.appendChild(summary);

        // Create errors list if there are any
        if (report.errors && report.errors.length > 0) {
            const errorsList = this.createErrorsList(report.errors);
            container.appendChild(errorsList);
        }
    },

    /**
     * Create summary section
     * @param {ValidationReport} report
     * @returns {HTMLElement}
     */
    createSummary(report) {
        const summary = document.createElement('div');
        summary.className = 'validation-summary';
        summary.style.cssText = `
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 10px;
            margin-bottom: 20px;
        `;

        const stats = [
            { label: 'Total Rules', value: report.totalRules, color: '#667eea' },
            { label: 'Valid', value: report.validRules, color: '#28a745' },
            { label: 'Invalid', value: report.invalidRules, color: '#dc3545' },
            { label: 'Errors', value: report.errorCount, color: '#dc3545' },
            { label: 'Warnings', value: report.warningCount, color: '#ffc107' },
        ];

        stats.forEach(stat => {
            const card = document.createElement('div');
            card.style.cssText = `
                padding: 15px;
                background: var(--section-bg);
                border-left: 4px solid ${stat.color};
                border-radius: 4px;
            `;
            card.innerHTML = `
                <div style="font-size: 1.5rem; font-weight: bold; color: ${stat.color};">${stat.value}</div>
                <div style="font-size: 0.9rem; color: var(--text-muted);">${stat.label}</div>
            `;
            summary.appendChild(card);
        });

        return summary;
    },

    /**
     * Create errors list
     * @param {ValidationError[]} errors
     * @returns {HTMLElement}
     */
    createErrorsList(errors) {
        const container = document.createElement('div');
        container.className = 'validation-errors';

        const header = document.createElement('div');
        header.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
        `;

        const title = document.createElement('h4');
        title.textContent = 'Validation Issues';
        title.style.margin = '0';
        title.style.color = 'var(--tab-active)';

        const filterGroup = document.createElement('div');
        filterGroup.style.cssText = 'display: flex; gap: 10px;';

        // Create filter buttons
        const filters = [
            { label: 'All', value: 'all' },
            { label: 'Errors', value: 'error' },
            { label: 'Warnings', value: 'warning' },
        ];

        let activeFilter = 'all';

        const updateList = () => {
            const filteredErrors = activeFilter === 'all'
                ? errors
                : errors.filter(e => e.severity === activeFilter);
            
            errorsList.innerHTML = '';
            filteredErrors.forEach(error => {
                errorsList.appendChild(this.createErrorItem(error));
            });

            if (filteredErrors.length === 0) {
                const empty = document.createElement('div');
                empty.style.cssText = `
                    text-align: center;
                    padding: 20px;
                    color: var(--text-muted);
                `;
                empty.textContent = `No ${activeFilter === 'all' ? '' : activeFilter + ' '}issues found`;
                errorsList.appendChild(empty);
            }
        };

        filters.forEach(filter => {
            const btn = document.createElement('button');
            btn.textContent = filter.label;
            btn.style.cssText = `
                padding: 6px 12px;
                border: 2px solid var(--border-color);
                background: var(--container-bg);
                color: var(--text-color);
                border-radius: 4px;
                cursor: pointer;
                font-size: 0.85rem;
                transition: all 0.3s;
            `;
            
            if (filter.value === activeFilter) {
                btn.style.background = 'var(--tab-active)';
                btn.style.color = 'white';
                btn.style.borderColor = 'var(--tab-active)';
            }

            btn.addEventListener('click', () => {
                activeFilter = filter.value;
                // Update button styles
                filterGroup.querySelectorAll('button').forEach(b => {
                    b.style.background = 'var(--container-bg)';
                    b.style.color = 'var(--text-color)';
                    b.style.borderColor = 'var(--border-color)';
                });
                btn.style.background = 'var(--tab-active)';
                btn.style.color = 'white';
                btn.style.borderColor = 'var(--tab-active)';
                updateList();
            });

            filterGroup.appendChild(btn);
        });

        header.appendChild(title);
        header.appendChild(filterGroup);
        container.appendChild(header);

        // Create scrollable list
        const errorsList = document.createElement('div');
        errorsList.style.cssText = `
            max-height: 400px;
            overflow-y: auto;
            border: 2px solid var(--border-color);
            border-radius: 6px;
        `;

        updateList();

        container.appendChild(errorsList);
        return container;
    },

    /**
     * Get color scheme for error type
     * @param {string} errorType
     * @returns {object}
     */
    getErrorTypeColor(errorType) {
        const errorTypeColors = {
            parse_error: { primary: '#dc3545', secondary: '#f8d7da' },
            syntax_error: { primary: '#dc3545', secondary: '#f8d7da' },
            unsupported_modifier: { primary: '#fd7e14', secondary: '#ffe5d0' },
            invalid_hostname: { primary: '#e83e8c', secondary: '#fce4ec' },
            ip_not_allowed: { primary: '#6610f2', secondary: '#e7d6ff' },
            pattern_too_short: { primary: '#ffc107', secondary: '#fff3cd' },
            public_suffix_match: { primary: '#ff6b6b', secondary: '#ffe0e0' },
            invalid_characters: { primary: '#d63384', secondary: '#f7d6e6' },
            cosmetic_not_supported: { primary: '#0dcaf0', secondary: '#cff4fc' },
            modifier_validation_failed: { primary: '#ffc107', secondary: '#fff3cd' },
        };
        return errorTypeColors[errorType] || { primary: '#6c757d', secondary: '#e9ecef' };
    },

    /**
     * Create individual error item
     * @param {ValidationError} error
     * @returns {HTMLElement}
     */
    createErrorItem(error) {
        const item = document.createElement('div');
        item.className = 'validation-error-item';
        
        const severityColors = {
            error: { bg: 'var(--alert-error-bg)', border: 'var(--alert-error-border)', text: 'var(--alert-error-text)' },
            warning: { bg: 'var(--log-warn-bg)', border: 'var(--log-warn-border)', text: 'var(--log-warn-text)' },
            info: { bg: 'var(--alert-info-bg)', border: 'var(--alert-info-border)', text: 'var(--alert-info-text)' },
        };

        const colors = severityColors[error.severity] || severityColors.error;
        const typeColor = this.getErrorTypeColor(error.type);

        item.style.cssText = `
            padding: 12px;
            border-left: 4px solid ${colors.border};
            background: ${colors.bg};
            color: ${colors.text};
            border-bottom: 1px solid var(--border-color);
        `;

        // Severity badge
        const badge = document.createElement('span');
        badge.textContent = error.severity.toUpperCase();
        badge.style.cssText = `
            display: inline-block;
            padding: 2px 8px;
            background: ${colors.border};
            color: white;
            border-radius: 3px;
            font-size: 0.75rem;
            font-weight: 600;
            margin-right: 8px;
        `;

        // Error type with color coding
        const type = document.createElement('span');
        type.textContent = this.formatErrorType(error.type);
        type.style.cssText = `
            display: inline-block;
            padding: 2px 8px;
            background: ${typeColor.secondary};
            color: ${typeColor.primary};
            border-radius: 3px;
            font-weight: 600;
            font-size: 0.8rem;
            margin-right: 8px;
        `;

        // Line number if available
        let lineInfo = '';
        if (error.lineNumber !== undefined) {
            lineInfo = ` (Line ${error.lineNumber})`;
        }

        // Source name if available
        let sourceInfo = '';
        if (error.sourceName) {
            sourceInfo = ` [${error.sourceName}]`;
        }

        const header = document.createElement('div');
        header.style.marginBottom = '8px';
        header.appendChild(badge);
        header.appendChild(type);
        
        const meta = document.createElement('span');
        meta.style.cssText = `
            font-size: 0.85rem;
            opacity: 0.8;
        `;
        meta.textContent = `${lineInfo}${sourceInfo}`;
        header.appendChild(meta);

        // Message
        const message = document.createElement('div');
        message.textContent = error.message;
        message.style.cssText = `
            font-weight: 600;
            margin-bottom: 4px;
        `;

        // Details if available
        const details = document.createElement('div');
        if (error.details) {
            details.textContent = error.details;
            details.style.cssText = `
                font-size: 0.85rem;
                opacity: 0.9;
                margin-bottom: 8px;
            `;
        }

        // Rule text with syntax highlighting
        const rule = document.createElement('div');
        rule.style.cssText = `
            font-family: 'Courier New', monospace;
            font-size: 0.85rem;
            background: rgba(0, 0, 0, 0.1);
            padding: 8px 10px;
            border-radius: 4px;
            margin-top: 8px;
            overflow-x: auto;
            white-space: pre-wrap;
            word-break: break-all;
            border-left: 3px solid ${typeColor.primary};
        `;
        rule.innerHTML = this.highlightRule(error.ruleText, error.type);

        item.appendChild(header);
        item.appendChild(message);
        if (error.details) {
            item.appendChild(details);
        }
        item.appendChild(rule);

        // Add AST visualization if available
        if (error.ast) {
            const astSection = this.createASTVisualization(error.ast);
            item.appendChild(astSection);
        }

        return item;
    },

    /**
     * Format error type for display
     * @param {string} type
     * @returns {string}
     */
    formatErrorType(type) {
        return type.split('_').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
    },

    /**
     * Highlight rule syntax based on error type
     * @param {string} ruleText
     * @param {string} errorType
     * @returns {string} HTML with syntax highlighting
     */
    highlightRule(ruleText, errorType) {
        // Escape HTML
        const escaped = ruleText
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        // Apply syntax highlighting based on rule type
        let highlighted = escaped;

        // Network rules: ||domain^$modifiers
        if (ruleText.startsWith('||')) {
            highlighted = highlighted.replace(
                /^(\|\|)([^\^\$]+)(\^)?(\$)?(.*)$/,
                '<span style="color: #6c757d;">$1</span>' +
                '<span style="color: #0d6efd; font-weight: bold;">$2</span>' +
                '<span style="color: #6c757d;">$3</span>' +
                '<span style="color: #dc3545;">$4</span>' +
                '<span style="color: #fd7e14;">$5</span>'
            );
        }
        // Exception rules: @@
        else if (ruleText.startsWith('@@')) {
            highlighted = highlighted.replace(
                /^(@@)(.*)$/,
                '<span style="color: #198754; font-weight: bold;">$1</span>' +
                '<span style="color: #0d6efd;">$2</span>'
            );
        }
        // Host rules: 0.0.0.0 domain
        else if (ruleText.match(/^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}/)) {
            highlighted = highlighted.replace(
                /^([0-9.]+)\s+(.*)$/,
                '<span style="color: #6610f2;">$1</span> ' +
                '<span style="color: #0d6efd; font-weight: bold;">$2</span>'
            );
        }
        // Cosmetic rules: ##, #@#, etc.
        else if (ruleText.includes('##') || ruleText.includes('#@#')) {
            highlighted = highlighted.replace(
                /^(.+?)(#@?#)(.*)$/,
                '<span style="color: #0d6efd;">$1</span>' +
                '<span style="color: #d63384; font-weight: bold;">$2</span>' +
                '<span style="color: #198754;">$3</span>'
            );
        }
        // Comments: !
        else if (ruleText.startsWith('!')) {
            highlighted = '<span style="color: #6c757d; font-style: italic;">' + highlighted + '</span>';
        }

        // Highlight specific problematic parts based on error type
        if (errorType === 'unsupported_modifier') {
            // Highlight the modifier section
            highlighted = highlighted.replace(
                /\$([^\s]+)/g,
                '<span style="background: rgba(255, 0, 0, 0.2); padding: 1px 3px; border-radius: 2px;">$$$1</span>'
            );
        } else if (errorType === 'invalid_hostname') {
            // Highlight the hostname
            highlighted = highlighted.replace(
                /([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
                '<span style="background: rgba(255, 0, 0, 0.2); padding: 1px 3px; border-radius: 2px;">$1</span>'
            );
        } else if (errorType === 'ip_not_allowed') {
            // Highlight IP addresses
            highlighted = highlighted.replace(
                /([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})/g,
                '<span style="background: rgba(102, 16, 242, 0.2); padding: 1px 3px; border-radius: 2px;">$1</span>'
            );
        }

        return highlighted;
    },

    /**
     * Create AST visualization
     * @param {object} ast - The AST node
     * @returns {HTMLElement}
     */
    createASTVisualization(ast) {
        const container = document.createElement('div');
        container.style.cssText = `
            margin-top: 10px;
            border-top: 1px solid rgba(0, 0, 0, 0.1);
            padding-top: 10px;
        `;

        const toggleBtn = document.createElement('button');
        toggleBtn.textContent = '🔍 Show AST';
        toggleBtn.style.cssText = `
            padding: 4px 8px;
            font-size: 0.75rem;
            background: var(--container-bg);
            color: var(--text-color);
            border: 1px solid var(--border-color);
            border-radius: 3px;
            cursor: pointer;
            transition: all 0.2s;
        `;

        const astContent = document.createElement('div');
        astContent.style.cssText = `
            display: none;
            margin-top: 8px;
            padding: 10px;
            background: rgba(0, 0, 0, 0.05);
            border-radius: 4px;
            font-family: 'Courier New', monospace;
            font-size: 0.8rem;
            overflow-x: auto;
            max-height: 300px;
            overflow-y: auto;
        `;

        let isExpanded = false;
        toggleBtn.addEventListener('click', () => {
            isExpanded = !isExpanded;
            astContent.style.display = isExpanded ? 'block' : 'none';
            toggleBtn.textContent = isExpanded ? '🔼 Hide AST' : '🔍 Show AST';
        });

        // Render AST tree
        astContent.appendChild(this.renderASTNode(ast, 0));

        container.appendChild(toggleBtn);
        container.appendChild(astContent);

        return container;
    },

    /**
     * Render AST node with color coding
     * @param {object} node - AST node
     * @param {number} depth - Indentation depth
     * @returns {HTMLElement}
     */
    renderASTNode(node, depth = 0) {
        const container = document.createElement('div');
        container.style.paddingLeft = `${depth * 20}px`;

        if (!node || typeof node !== 'object') {
            const text = document.createElement('span');
            text.textContent = String(node);
            text.style.color = '#198754';
            container.appendChild(text);
            return container;
        }

        // Get color for node type
        const nodeColor = this.getASTNodeColor(node);

        // Node type/category
        if (node.type || node.category) {
            const typeLabel = document.createElement('div');
            typeLabel.style.cssText = `
                display: inline-block;
                padding: 2px 6px;
                background: ${nodeColor.bg};
                color: ${nodeColor.text};
                border-radius: 3px;
                font-weight: bold;
                margin: 2px 0;
            `;
            typeLabel.textContent = node.type || node.category;
            container.appendChild(typeLabel);
        }

        // Render key properties
        const importantProps = ['value', 'name', 'pattern', 'exception', 'syntax'];
        const propsDiv = document.createElement('div');
        propsDiv.style.marginLeft = '10px';

        for (const prop of importantProps) {
            if (node[prop] !== undefined && typeof node[prop] !== 'object') {
                const propLine = document.createElement('div');
                propLine.innerHTML = `
                    <span style="color: #6c757d;">${prop}:</span>
                    <span style="color: ${this.getValueColor(node[prop])}; font-weight: 500;">${this.escapeHtml(String(node[prop]))}</span>
                `;
                propsDiv.appendChild(propLine);
            }
        }

        if (propsDiv.children.length > 0) {
            container.appendChild(propsDiv);
        }

        // Recursively render child nodes
        for (const key in node) {
            if (Object.prototype.hasOwnProperty.call(node, key) && !importantProps.includes(key) && 
                key !== 'type' && key !== 'category' && key !== 'raws' && key !== 'loc') {
                
                const value = node[key];
                if (value && typeof value === 'object') {
                    const childLabel = document.createElement('div');
                    childLabel.style.cssText = `
                        color: #0d6efd;
                        font-style: italic;
                        margin-top: 4px;
                    `;
                    childLabel.textContent = `${key}:`;
                    container.appendChild(childLabel);

                    if (Array.isArray(value)) {
                        value.forEach((item, idx) => {
                            const itemDiv = document.createElement('div');
                            itemDiv.style.cssText = `
                                margin-left: 20px;
                                border-left: 2px solid rgba(0, 0, 0, 0.1);
                                padding-left: 10px;
                                margin-top: 2px;
                            `;
                            const indexLabel = document.createElement('span');
                            indexLabel.style.color = '#6c757d';
                            indexLabel.textContent = `[${idx}] `;
                            itemDiv.appendChild(indexLabel);
                            itemDiv.appendChild(this.renderASTNode(item, depth + 1));
                            container.appendChild(itemDiv);
                        });
                    } else {
                        container.appendChild(this.renderASTNode(value, depth + 1));
                    }
                }
            }
        }

        return container;
    },

    /**
     * Get color scheme for AST node type
     * @param {object} node
     * @returns {object}
     */
    getASTNodeColor(node) {
        const colorMap = {
            // Categories
            'Network': { bg: '#0d6efd', text: '#ffffff' },
            'Cosmetic': { bg: '#d63384', text: '#ffffff' },
            'Comment': { bg: '#6c757d', text: '#ffffff' },
            'Empty': { bg: '#adb5bd', text: '#000000' },
            'Invalid': { bg: '#dc3545', text: '#ffffff' },
            
            // Network types
            'NetworkRule': { bg: '#0dcaf0', text: '#000000' },
            'HostRule': { bg: '#6610f2', text: '#ffffff' },
            
            // Cosmetic types
            'ElementHidingRule': { bg: '#d63384', text: '#ffffff' },
            'CssInjectionRule': { bg: '#e83e8c', text: '#ffffff' },
            'ScriptletInjectionRule': { bg: '#fd7e14', text: '#000000' },
            
            // Comment types
            'CommentRule': { bg: '#6c757d', text: '#ffffff' },
            'MetadataCommentRule': { bg: '#20c997', text: '#000000' },
            'HintCommentRule': { bg: '#ffc107', text: '#000000' },
            
            // Components
            'Modifier': { bg: '#fd7e14', text: '#000000' },
            'ModifierList': { bg: '#ffe5d0', text: '#000000' },
            'DomainList': { bg: '#cfe2ff', text: '#000000' },
        };

        const type = node.type || node.category;
        return colorMap[type] || { bg: '#e9ecef', text: '#000000' };
    },

    /**
     * Get color for value type
     * @param {any} value
     * @returns {string}
     */
    getValueColor(value) {
        if (typeof value === 'boolean') return value ? '#198754' : '#dc3545';
        if (typeof value === 'number') return '#6610f2';
        if (typeof value === 'string') return '#0d6efd';
        return '#6c757d';
    },

    /**
     * Escape HTML
     * @param {string} text
     * @returns {string}
     */
    escapeHtml(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    },

    /**
     * Create validation section in the DOM
     * @returns {HTMLElement}
     */
    createValidationSection() {
        const section = document.createElement('div');
        section.id = 'validation-section';
        section.className = 'validation-section';
        section.style.cssText = `
            display: none;
            margin-top: 20px;
            padding: 20px;
            background: var(--section-bg);
            border-radius: 6px;
            border: 2px solid var(--border-color);
        `;

        const header = document.createElement('div');
        header.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
        `;

        const title = document.createElement('h3');
        title.textContent = '🔍 Validation Report';
        title.style.margin = '0';
        title.style.color = 'var(--tab-active)';

        const downloadBtn = document.createElement('button');
        downloadBtn.textContent = 'Download Report';
        downloadBtn.className = 'btn-secondary';
        downloadBtn.style.cssText = `
            padding: 6px 12px;
            font-size: 0.9rem;
        `;
        downloadBtn.addEventListener('click', () => this.downloadReport());

        header.appendChild(title);
        header.appendChild(downloadBtn);
        section.appendChild(header);

        const content = document.createElement('div');
        content.id = 'validation-content';
        section.appendChild(content);

        return section;
    },

    /**
     * Show validation section with report
     * @param {ValidationReport} report
     */
    showReport(report) {
        let section = document.getElementById('validation-section');
        if (!section) {
            section = this.createValidationSection();
            const resultsSection = document.getElementById('results');
            if (resultsSection) {
                resultsSection.parentNode.insertBefore(section, resultsSection);
            }
        }

        section.style.display = 'block';
        const content = document.getElementById('validation-content');
        this.renderReport(report, content);

        // Store report for download
        this._currentReport = report;
    },

    /**
     * Hide validation section
     */
    hideReport() {
        const section = document.getElementById('validation-section');
        if (section) {
            section.style.display = 'none';
        }
        this._currentReport = null;
    },

    /**
     * Download validation report as JSON
     */
    downloadReport() {
        if (!this._currentReport) {
            return;
        }

        const json = JSON.stringify(this._currentReport, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `validation-report-${Date.now()}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
    },
};

// Export for use in other scripts
if (typeof window !== 'undefined') {
    window.ValidationUI = ValidationUI;
}
