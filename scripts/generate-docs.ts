#!/usr/bin/env -S deno run --allow-read --allow-write --allow-net

/**
 * OpenAPI Documentation Generator
 *
 * Generates beautiful HTML documentation from the OpenAPI specification.
 * Uses Redoc for rendering.
 */

import { parse } from 'https://deno.land/std@0.224.0/yaml/mod.ts';
import { ensureDir } from 'https://deno.land/std@0.224.0/fs/mod.ts';

const OPENAPI_PATH = './openapi.yaml';
const OUTPUT_DIR = './docs/api';
const OUTPUT_FILE = `${OUTPUT_DIR}/index.html`;

async function generateDocs(): Promise<void> {
    console.log('📚 Generating API documentation...\n');

    // Read OpenAPI spec
    const content = await Deno.readTextFile(OPENAPI_PATH);
    const spec = parse(content);

    console.log('✅ Loaded OpenAPI specification');

    // Ensure output directory exists
    await ensureDir(OUTPUT_DIR);
    console.log(`✅ Created output directory: ${OUTPUT_DIR}`);

    // Generate HTML using Redoc
    const html = generateRedocHTML(JSON.stringify(spec, null, 2));

    // Write to file
    await Deno.writeTextFile(OUTPUT_FILE, html);
    console.log(`✅ Generated documentation: ${OUTPUT_FILE}`);

    // Also generate a markdown version
    await generateMarkdownDocs(spec);

    console.log('\n🎉 Documentation generation complete!\n');
    console.log(`📖 View documentation:`);
    console.log(`   HTML: file://${Deno.cwd()}/${OUTPUT_FILE}`);
    console.log(`   Markdown: ${OUTPUT_DIR}/README.md\n`);
}

function generateRedocHTML(specJson: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Adblock Compiler API Documentation</title>
    <link rel="icon" type="image/png" href="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==">
    <style>
        body {
            margin: 0;
            padding: 0;
        }
    </style>
</head>
<body>
    <!-- Redoc standalone bundle -->
    <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
    
    <script>
        const spec = ${specJson};
        
        Redoc.init(spec, {
            scrollYOffset: 50,
            theme: {
                colors: {
                    primary: {
                        main: '#2563eb'
                    }
                },
                typography: {
                    fontSize: '16px',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    headings: {
                        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                    }
                },
                sidebar: {
                    backgroundColor: '#f9fafb',
                    textColor: '#1f2937'
                },
                rightPanel: {
                    backgroundColor: '#1f2937'
                }
            },
            hideDownloadButton: false,
            disableSearch: false,
            expandResponses: '200,201',
            jsonSampleExpandLevel: 2,
            hideSingleRequestSampleTab: true,
            menuToggle: true,
            nativeScrollbars: false,
            pathInMiddlePanel: false,
            requiredPropsFirst: true,
            sortPropsAlphabetically: false,
            expandSingleSchemaField: true
        }, document.body);
    </script>
</body>
</html>`;
}

async function generateMarkdownDocs(spec: any): Promise<void> {
    const lines: string[] = [];

    lines.push(`# ${spec.info.title}`);
    lines.push('');
    lines.push(`**Version:** ${spec.info.version}`);
    lines.push('');

    if (spec.info.description) {
        lines.push('## Description');
        lines.push('');
        lines.push(spec.info.description);
        lines.push('');
    }

    // Servers
    if (spec.servers && spec.servers.length > 0) {
        lines.push('## Servers');
        lines.push('');
        spec.servers.forEach((server: any) => {
            lines.push(`- **${server.description || 'Server'}**: \`${server.url}\``);
        });
        lines.push('');
    }

    // Group endpoints by tag
    const endpointsByTag: Record<string, any[]> = {};

    for (const [path, pathItem] of Object.entries(spec.paths)) {
        const methods = ['get', 'post', 'put', 'patch', 'delete'];

        for (const method of methods) {
            const operation = (pathItem as any)[method];
            if (operation) {
                const tag = operation.tags?.[0] || 'Other';
                if (!endpointsByTag[tag]) {
                    endpointsByTag[tag] = [];
                }
                endpointsByTag[tag].push({
                    method: method.toUpperCase(),
                    path,
                    operation,
                });
            }
        }
    }

    // Generate documentation for each tag
    lines.push('## Endpoints');
    lines.push('');

    for (const [tag, endpoints] of Object.entries(endpointsByTag)) {
        lines.push(`### ${tag}`);
        lines.push('');

        for (const { method, path, operation } of endpoints) {
            lines.push(`#### \`${method} ${path}\``);
            lines.push('');

            if (operation.summary) {
                lines.push(`**Summary:** ${operation.summary}`);
                lines.push('');
            }

            if (operation.description) {
                lines.push(operation.description);
                lines.push('');
            }

            if (operation.operationId) {
                lines.push(`**Operation ID:** \`${operation.operationId}\``);
                lines.push('');
            }

            // Parameters
            if (operation.parameters && operation.parameters.length > 0) {
                lines.push('**Parameters:**');
                lines.push('');
                operation.parameters.forEach((param: any) => {
                    const required = param.required ? ' (required)' : '';
                    lines.push(`- \`${param.name}\` (${param.in})${required}: ${param.description || 'No description'}`);
                });
                lines.push('');
            }

            // Request body
            if (operation.requestBody) {
                lines.push('**Request Body:**');
                lines.push('');
                const content = operation.requestBody.content;
                if (content) {
                    for (const [mediaType, details] of Object.entries(content)) {
                        lines.push(`- Content-Type: \`${mediaType}\``);
                        if ((details as any).schema?.$ref) {
                            const schemaName = (details as any).schema.$ref.split('/').pop();
                            lines.push(`  - Schema: [\`${schemaName}\`](#${schemaName.toLowerCase()})`);
                        }
                    }
                }
                lines.push('');
            }

            // Responses
            if (operation.responses) {
                lines.push('**Responses:**');
                lines.push('');
                for (const [code, response] of Object.entries(operation.responses)) {
                    const desc = (response as any).description || 'No description';
                    lines.push(`- \`${code}\`: ${desc}`);
                }
                lines.push('');
            }

            lines.push('---');
            lines.push('');
        }
    }

    // Schemas
    if (spec.components?.schemas) {
        lines.push('## Schemas');
        lines.push('');

        for (const [name, schema] of Object.entries(spec.components.schemas)) {
            const schemaObj = schema as any;
            lines.push(`### ${name}`);
            lines.push('');

            if (schemaObj.description) {
                lines.push(schemaObj.description);
                lines.push('');
            }

            if (schemaObj.type === 'object' && schemaObj.properties) {
                lines.push('**Properties:**');
                lines.push('');

                for (const [propName, prop] of Object.entries(schemaObj.properties)) {
                    const propObj = prop as any;
                    const required = schemaObj.required?.includes(propName) ? ' (required)' : '';
                    const type = propObj.type || (propObj.$ref ? propObj.$ref.split('/').pop() : 'unknown');
                    const desc = propObj.description || '';
                    lines.push(`- \`${propName}\`${required}: \`${type}\` - ${desc}`);
                }
                lines.push('');
            }

            if (schemaObj.enum) {
                lines.push('**Enum values:**');
                lines.push('');
                schemaObj.enum.forEach((value: string) => {
                    lines.push(`- \`${value}\``);
                });
                lines.push('');
            }

            lines.push('---');
            lines.push('');
        }
    }

    // Write markdown
    const markdown = lines.join('\n');
    await Deno.writeTextFile(`${OUTPUT_DIR}/README.md`, markdown);
    console.log(`✅ Generated markdown documentation: ${OUTPUT_DIR}/README.md`);
}

if (import.meta.main) {
    try {
        await generateDocs();
    } catch (error) {
        console.error('❌ Error generating documentation:', error.message);
        Deno.exit(1);
    }
}
