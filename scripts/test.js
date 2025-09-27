#!/usr/bin/env node

/**
 * Test script for tunnl.ai Chrome Extension
 * Basic validation tests
 */

const fs = require('fs-extra');
const path = require('path');

async function runTests() {
    console.log('🧪 Starting test suite...');
    
    const tests = [
        testManifestExists,
        testManifestValid,
        testSourceFilesExist,
        testAssetsExist,
        testFileStructure
    ];
    
    let passed = 0;
    let failed = 0;
    
    for (const test of tests) {
        try {
            await test();
            console.log(`✅ ${test.name} passed`);
            passed++;
        } catch (error) {
            console.log(`❌ ${test.name} failed: ${error.message}`);
            failed++;
        }
    }
    
    console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed`);
    
    if (failed > 0) {
        console.log('❌ Some tests failed');
        process.exit(1);
    } else {
        console.log('🎉 All tests passed!');
    }
}

async function testManifestExists() {
    if (!await fs.pathExists('manifest.json')) {
        throw new Error('manifest.json not found');
    }
}

async function testManifestValid() {
    const manifest = await fs.readJson('manifest.json');
    
    const requiredFields = ['manifest_version', 'name', 'version', 'description'];
    for (const field of requiredFields) {
        if (!manifest[field]) {
            throw new Error(`Missing required field: ${field}`);
        }
    }
    
    if (manifest.manifest_version !== 3) {
        throw new Error('Manifest version must be 3');
    }
}

async function testSourceFilesExist() {
    const requiredFiles = [
        'src/background/background.js',
        'src/content/content.js',
        'src/popup/popup.html',
        'src/popup/popup.js',
        'src/options/options.html',
        'src/options/options.js'
    ];
    
    for (const file of requiredFiles) {
        if (!await fs.pathExists(file)) {
            throw new Error(`Required file not found: ${file}`);
        }
    }
}

async function testAssetsExist() {
    const requiredAssets = [
        'assets/images/access_denied.png',
        'assets/fonts/Excalifont Regular.woff2'
    ];
    
    for (const asset of requiredAssets) {
        if (!await fs.pathExists(asset)) {
            throw new Error(`Required asset not found: ${asset}`);
        }
    }
}

async function testFileStructure() {
    const requiredDirs = [
        'src',
        'src/background',
        'src/content',
        'src/popup',
        'src/options',
        'src/shared',
        'assets',
        'assets/images',
        'assets/fonts'
    ];
    
    for (const dir of requiredDirs) {
        if (!await fs.pathExists(dir)) {
            throw new Error(`Required directory not found: ${dir}`);
        }
    }
}

// Run tests if called directly
if (require.main === module) {
    runTests();
}

module.exports = { runTests };
