#!/usr/bin/env -S deno run --allow-read --allow-net

/**
 * OpenAPI Specification Validator
 *
 * Validates the openapi.yaml file against the OpenAPI 3.0 specification.
 * Also performs additional checks for consistency and best practices.
 */

import { parse } from 'https://deno.land/std@0.224.0/yaml/mod.ts';
import { existsSync } from 'https://deno.land/std@0.224.0/fs/mod.ts';

interface ValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}

const OPENAPI_PATH = './openapi.yaml';

async function validateOpenAPI(): Promise<ValidationResult> {
    const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
    };

    console.log('🔍 Validating OpenAPI specification...\n');

    // Check if file exists
    if (!existsSync(OPENAPI_PATH)) {
        result.valid = false;
        result.errors.push(`OpenAPI file not found: ${OPENAPI_PATH}`);
        return result;
    }

    // Parse YAML
    let spec: any;
    try {
        const content = await Deno.readTextFile(OPENAPI_PATH);
        spec = parse(content);
        console.log('✅ YAML syntax is valid');
    } catch (error) {
        result.valid = false;
        result.errors.push(`Failed to parse YAML: ${error.message}`);
        return result;
    }

    // Validate OpenAPI version
    if (!spec.openapi) {
        result.valid = false;
        result.errors.push('Missing "openapi" field');
    } else if (!spec.openapi.startsWith('3.0')) {
        result.warnings.push(`OpenAPI version ${spec.openapi} - consider upgrading to 3.1`);
    } else {
        console.log(`✅ OpenAPI version: ${spec.openapi}`);
    }

    // Validate info section
    if (!spec.info) {
        result.valid = false;
        result.errors.push('Missing "info" section');
    } else {
        console.log(`✅ Title: ${spec.info.title}`);
        console.log(`✅ Version: ${spec.info.version}`);

        if (!spec.info.title) {
            result.errors.push('Missing info.title');
            result.valid = false;
        }
        if (!spec.info.version) {
            result.errors.push('Missing info.version');
            result.valid = false;
        }
        if (!spec.info.description) {
            result.warnings.push('Missing info.description');
        }
    }

    // Validate servers
    if (!spec.servers || spec.servers.length === 0) {
        result.warnings.push('No servers defined');
    } else {
        console.log(`✅ Servers: ${spec.servers.length} defined`);
        spec.servers.forEach((server: any, i: number) => {
            if (!server.url) {
                result.errors.push(`Server ${i} missing URL`);
                result.valid = false;
            }
        });
    }

    // Validate paths
    if (!spec.paths || Object.keys(spec.paths).length === 0) {
        result.valid = false;
        result.errors.push('No paths defined');
    } else {
        const pathCount = Object.keys(spec.paths).length;
        console.log(`✅ Paths: ${pathCount} endpoints defined`);

        let operationCount = 0;
        const operationIds = new Set<string>();
        const missingOperationIds: string[] = [];

        for (const [path, pathItem] of Object.entries(spec.paths)) {
            const methods = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'];

            for (const method of methods) {
                if ((pathItem as any)[method]) {
                    operationCount++;
                    const operation = (pathItem as any)[method];

                    // Check operationId
                    if (operation.operationId) {
                        if (operationIds.has(operation.operationId)) {
                            result.errors.push(`Duplicate operationId: ${operation.operationId}`);
                            result.valid = false;
                        }
                        operationIds.add(operation.operationId);
                    } else {
                        missingOperationIds.push(`${method.toUpperCase()} ${path}`);
                    }

                    // Check for summary/description
                    if (!operation.summary && !operation.description) {
                        result.warnings.push(`${method.toUpperCase()} ${path} missing summary/description`);
                    }

                    // Check for responses
                    if (!operation.responses || Object.keys(operation.responses).length === 0) {
                        result.errors.push(`${method.toUpperCase()} ${path} has no responses defined`);
                        result.valid = false;
                    } else {
                        // Check for 200/201 success response
                        const hasSuccess = Object.keys(operation.responses).some((code) => code.startsWith('2'));
                        if (!hasSuccess) {
                            result.warnings.push(`${method.toUpperCase()} ${path} has no success response (2xx)`);
                        }
                    }

                    // Validate request body for POST/PUT/PATCH
                    if (['post', 'put', 'patch'].includes(method)) {
                        if (!operation.requestBody) {
                            result.warnings.push(`${method.toUpperCase()} ${path} might need a requestBody`);
                        }
                    }
                }
            }
        }

        console.log(`✅ Operations: ${operationCount} total`);

        if (missingOperationIds.length > 0) {
            result.warnings.push(`${missingOperationIds.length} operations missing operationId`);
        }
    }

    // Validate components/schemas
    if (spec.components?.schemas) {
        const schemaCount = Object.keys(spec.components.schemas).length;
        console.log(`✅ Schemas: ${schemaCount} defined`);

        for (const [name, schema] of Object.entries(spec.components.schemas)) {
            const schemaObj = schema as any;

            // Check for description
            if (!schemaObj.description) {
                result.warnings.push(`Schema "${name}" missing description`);
            }

            // Check for required fields in objects
            if (schemaObj.type === 'object' && schemaObj.properties) {
                if (!schemaObj.required || schemaObj.required.length === 0) {
                    result.warnings.push(`Schema "${name}" has properties but no required fields`);
                }
            }
        }
    } else {
        result.warnings.push('No component schemas defined');
    }

    // Validate security schemes
    if (spec.components?.securitySchemes) {
        const securityCount = Object.keys(spec.components.securitySchemes).length;
        console.log(`✅ Security schemes: ${securityCount} defined`);
    }

    // Validate tags
    if (spec.tags) {
        console.log(`✅ Tags: ${spec.tags.length} defined`);

        // Check if all tags used in operations are defined
        const definedTags = new Set(spec.tags.map((t: any) => t.name));
        const usedTags = new Set<string>();

        for (const pathItem of Object.values(spec.paths)) {
            const methods = ['get', 'post', 'put', 'patch', 'delete'];
            for (const method of methods) {
                const operation = (pathItem as any)[method];
                if (operation?.tags) {
                    operation.tags.forEach((tag: string) => usedTags.add(tag));
                }
            }
        }

        usedTags.forEach((tag) => {
            if (!definedTags.has(tag)) {
                result.warnings.push(`Tag "${tag}" used but not defined in tags section`);
            }
        });
    }

    return result;
}

// Additional checks for best practices
async function checkBestPractices(result: ValidationResult): Promise<void> {
    console.log('\n📋 Checking best practices...\n');

    const content = await Deno.readTextFile(OPENAPI_PATH);
    const spec = parse(content) as any;

    // Check for examples
    let examplesCount = 0;
    for (const pathItem of Object.values(spec.paths)) {
        const methods = ['get', 'post', 'put', 'patch', 'delete'];
        for (const method of methods) {
            const operation = (pathItem as any)[method];
            if (operation?.requestBody?.content) {
                for (const mediaType of Object.values(operation.requestBody.content)) {
                    if ((mediaType as any).examples || (mediaType as any).example) {
                        examplesCount++;
                    }
                }
            }
        }
    }

    if (examplesCount > 0) {
        console.log(`✅ Request examples: ${examplesCount} found`);
    } else {
        result.warnings.push('No request examples found - consider adding examples for better docs');
    }

    // Check for external docs
    if (spec.externalDocs) {
        console.log(`✅ External docs: ${spec.externalDocs.url}`);
    } else {
        result.warnings.push('No external documentation link provided');
    }

    // Check contact info
    if (spec.info.contact) {
        console.log(`✅ Contact info provided`);
    } else {
        result.warnings.push('No contact information in info section');
    }

    // Check license
    if (spec.info.license) {
        console.log(`✅ License: ${spec.info.license.name}`);
    } else {
        result.warnings.push('No license information provided');
    }
}

// Print validation results
function printResults(result: ValidationResult): void {
    console.log('\n' + '='.repeat(60));
    console.log('VALIDATION RESULTS');
    console.log('='.repeat(60) + '\n');

    if (result.errors.length > 0) {
        console.log('❌ ERRORS:\n');
        result.errors.forEach((error) => console.log(`  • ${error}`));
        console.log();
    }

    if (result.warnings.length > 0) {
        console.log('⚠️  WARNINGS:\n');
        result.warnings.forEach((warning) => console.log(`  • ${warning}`));
        console.log();
    }

    if (result.valid && result.errors.length === 0) {
        console.log('✅ OpenAPI specification is VALID!\n');
    } else {
        console.log('❌ OpenAPI specification has ERRORS and is INVALID!\n');
    }

    console.log(`Summary: ${result.errors.length} errors, ${result.warnings.length} warnings\n`);
}

// Main execution
if (import.meta.main) {
    const result = await validateOpenAPI();
    await checkBestPractices(result);
    printResults(result);

    // Exit with error code if validation failed
    if (!result.valid || result.errors.length > 0) {
        Deno.exit(1);
    }
}
