#!/usr/bin/env -S deno run --allow-read

/**
 * Display AST from AGTree
 *
 * This script demonstrates parsing adblock filter rules using AGTree
 * and displays their Abstract Syntax Tree (AST) representations.
 */

import { AGTreeParser } from './src/utils/AGTreeParser.ts';

// Example rules to parse
const exampleRules = [
    '||example.com^$third-party',
    '@@||example.com/allowed^',
    '127.0.0.1 ad.example.com',
    'example.com##.ad-banner',
    'example.com##+js(abort-on-property-read, ads)',
    '! This is a comment',
    '! Title: My Filter List',
    '! Description: Example filter list',
    'example.com,~subdomain.example.com##.selector',
    '||ads.example.com^$script,domain=example.com|example.org',
    '0.0.0.0 tracking.example.com',
    'example.com#@#.ad-banner',
    '||example.com^$important,third-party',
];

console.log('='.repeat(80));
console.log('AGTree AST Display');
console.log('='.repeat(80));
console.log();

for (const ruleText of exampleRules) {
    console.log('Rule:', ruleText);
    console.log('-'.repeat(80));

    const result = AGTreeParser.parse(ruleText);

    if (result.success && result.ast) {
        // Display basic information
        console.log('Category:', result.ast.category);
        console.log('Type:', result.ast.type);
        console.log('Syntax:', result.ast.syntax);
        console.log('Valid:', AGTreeParser.isValid(result.ast));

        // Type-specific information
        if (AGTreeParser.isNetworkRule(result.ast)) {
            console.log('\nNetwork Rule Properties:');
            const props = AGTreeParser.extractNetworkRuleProperties(result.ast);
            console.log('  Pattern:', props.pattern);
            console.log('  Is Exception:', props.isException);
            console.log('  Modifiers:', props.modifiers);
        } else if (AGTreeParser.isHostRule(result.ast)) {
            console.log('\nHost Rule Properties:');
            const props = AGTreeParser.extractHostRuleProperties(result.ast);
            console.log('  IP:', props.ip);
            console.log('  Hostnames:', props.hostnames);
            console.log('  Comment:', props.comment);
        } else if (AGTreeParser.isCosmeticRule(result.ast)) {
            console.log('\nCosmetic Rule Properties:');
            const props = AGTreeParser.extractCosmeticRuleProperties(result.ast);
            console.log('  Domains:', props.domains);
            console.log('  Separator:', props.separator);
            console.log('  Is Exception:', props.isException);
            console.log('  Body:', props.body);
            console.log('  Type:', props.type);
        } else if (AGTreeParser.isComment(result.ast)) {
            console.log('\nComment Rule');
            if (AGTreeParser.isMetadataComment(result.ast)) {
                console.log('  Header:', result.ast.header?.value || 'N/A');
            }
        }

        // Display full AST (formatted)
        console.log('\nFull AST:');
        console.log(JSON.stringify(result.ast, null, 2));
    } else {
        console.log('ERROR:', result.error || 'Failed to parse');
    }

    console.log();
    console.log('='.repeat(80));
    console.log();
}

// Display additional example: parse a filter list
console.log('\nFilter List Parsing Example');
console.log('='.repeat(80));

const filterListText = `! Title: Example Filter List
! Description: A small example
! Version: 1.0

||example.com^$third-party
@@||example.com/allowed^
example.com##.ad-banner`;

console.log('Input:');
console.log(filterListText);
console.log();

const filterList = AGTreeParser.parseFilterList(filterListText);
console.log('Parsed Filter List:');
console.log('  Total rules:', filterList.children.length);
console.log();

for (const [index, rule] of filterList.children.entries()) {
    console.log(`  Rule ${index + 1}: ${rule.category} / ${rule.type}`);
    if ('raws' in rule && rule.raws?.text) {
        console.log(`    Text: ${rule.raws.text}`);
    }
}

console.log();
console.log('Full Filter List AST:');
console.log(JSON.stringify(filterList, null, 2));
