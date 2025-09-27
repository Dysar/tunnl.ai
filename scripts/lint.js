#!/usr/bin/env node

/**
 * Linting script for tunnl.ai Chrome Extension
 * Checks code quality and style
 */

const fs = require('fs-extra');
const path = require('path');

// Simple linting rules (can be enhanced with ESLint later)
const LINT_RULES = {
    // Check for console.log statements in production code
    noConsoleLog: {
        enabled: true,
        message: 'console.log statements should be removed from production code'
    },
    
    // Check for TODO comments
    noTodo: {
        enabled: true,
        message: 'TODO comments should be resolved before release'
    },
    
    // Check for proper file structure
    fileStructure: {
        enabled: true,
        message: 'Files should be in proper directory structure'
    }
};

async function lint() {
    console.log('🔍 Starting linting process...');
    
    const issues = [];
    const srcDir = 'src';
    
    try {
        // Check if src directory exists
        if (!await fs.pathExists(srcDir)) {
            issues.push({
                type: 'fileStructure',
                message: 'src directory not found',
                file: 'project root'
            });
        }

        // Lint all JavaScript files
        await lintDirectory(srcDir, issues);
        
        // Report results
        if (issues.length === 0) {
            console.log('✅ No linting issues found!');
        } else {
            console.log(`❌ Found ${issues.length} linting issues:`);
            issues.forEach(issue => {
                console.log(`  - ${issue.type}: ${issue.message} (${issue.file}:${issue.line || 'N/A'})`);
            });
            
            if (process.argv.includes('--fix')) {
                console.log('🔧 Auto-fix not implemented yet');
            }
        }
        
    } catch (error) {
        console.error('❌ Linting failed:', error);
        process.exit(1);
    }
}

async function lintDirectory(dir, issues) {
    const files = await fs.readdir(dir);
    
    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = await fs.stat(filePath);
        
        if (stat.isDirectory()) {
            await lintDirectory(filePath, issues);
        } else if (file.endsWith('.js')) {
            await lintFile(filePath, issues);
        }
    }
}

async function lintFile(filePath, issues) {
    const content = await fs.readFile(filePath, 'utf8');
    const lines = content.split('\n');
    
    lines.forEach((line, index) => {
        const lineNumber = index + 1;
        
        // Check for console.log statements
        if (LINT_RULES.noConsoleLog.enabled && line.includes('console.log')) {
            issues.push({
                type: 'noConsoleLog',
                message: LINT_RULES.noConsoleLog.message,
                file: filePath,
                line: lineNumber
            });
        }
        
        // Check for TODO comments
        if (LINT_RULES.noTodo.enabled && line.includes('TODO')) {
            issues.push({
                type: 'noTodo',
                message: LINT_RULES.noTodo.message,
                file: filePath,
                line: lineNumber
            });
        }
    });
}

// Run lint if called directly
if (require.main === module) {
    lint();
}

module.exports = { lint };
