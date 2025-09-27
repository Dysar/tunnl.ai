#!/usr/bin/env node

/**
 * Bundle script for tunnl.ai Chrome Extension using esbuild
 * This script bundles TypeScript modules into single JavaScript files for Chrome extensions
 */

const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs-extra');

const BUILD_DIR = 'dist';
const SRC_DIR = 'src';

async function bundle() {
    console.log('🔨 Starting bundle process with esbuild...');
    
    try {
        // Clean build directory
        await fs.remove(BUILD_DIR);
        await fs.ensureDir(BUILD_DIR);
        console.log('✅ Cleaned build directory');

        // Bundle background script
        console.log('📦 Bundling background script...');
        await esbuild.build({
            entryPoints: [path.join(SRC_DIR, 'background/background.ts')],
            bundle: true,
            outfile: path.join(BUILD_DIR, 'background/background.js'),
            format: 'iife',
            globalName: 'TunnlBackground',
            target: 'es2020',
            platform: 'browser',
            sourcemap: true,
            minify: false,
            external: ['chrome']
        });
        console.log('✅ Background script bundled');

        // Bundle content script
        console.log('📦 Bundling content script...');
        await esbuild.build({
            entryPoints: [path.join(SRC_DIR, 'content/content.ts')],
            bundle: true,
            outfile: path.join(BUILD_DIR, 'content/content.js'),
            format: 'iife',
            globalName: 'TunnlContent',
            target: 'es2020',
            platform: 'browser',
            sourcemap: true,
            minify: false,
            external: ['chrome']
        });
        console.log('✅ Content script bundled');

        // Bundle other scripts that need bundling
        const otherScripts = [
            { src: 'popup/popup.ts', dest: 'popup/popup.js' },
            { src: 'options/options.ts', dest: 'options/options.js' },
            { src: 'blocked/blocked.ts', dest: 'blocked/blocked.js' }
        ];

        for (const script of otherScripts) {
            const srcPath = path.join(SRC_DIR, script.src);
            if (await fs.pathExists(srcPath)) {
                console.log(`📦 Bundling ${script.src}...`);
                await esbuild.build({
                    entryPoints: [srcPath],
                    bundle: true,
                    outfile: path.join(BUILD_DIR, script.dest),
                    format: 'iife',
                    target: 'es2020',
                    platform: 'browser',
                    sourcemap: true,
                    minify: false,
                    external: ['chrome']
                });
                console.log(`✅ ${script.src} bundled`);
            }
        }

        // Copy other files
        await copyOtherFiles();

        console.log('🎉 Bundle process completed successfully!');
        console.log(`📦 Extension ready in: ${BUILD_DIR}/`);
        
    } catch (error) {
        console.error('❌ Bundle failed:', error);
        process.exit(1);
    }
}

async function copyOtherFiles() {
    console.log('📋 Copying other files...');
    
    // Copy HTML and CSS files
    const htmlCssFiles = [
        'src/popup/popup.html',
        'src/popup/popup.css', 
        'src/options/options.html',
        'src/blocked/blocked.html',
        'src/blocked/blocked.css'
    ];
    
    for (const file of htmlCssFiles) {
        if (await fs.pathExists(file)) {
            const relativePath = path.relative('src', file);
            const destPath = path.join(BUILD_DIR, relativePath);
            await fs.ensureDir(path.dirname(destPath));
            await fs.copy(file, destPath);
            console.log(`✅ Copied ${file} to ${destPath}`);
        }
    }

    // Copy assets
    await fs.copy('assets', path.join(BUILD_DIR, 'assets'));
    console.log('✅ Copied assets');

    // Copy manifest.json
    await fs.copy('manifest.json', path.join(BUILD_DIR, 'manifest.json'));
    console.log('✅ Copied manifest.json');

    // Copy other root files
    const rootFiles = ['README.md', 'LICENSE', 'INSTALL.md'];
    for (const file of rootFiles) {
        if (await fs.pathExists(file)) {
            await fs.copy(file, path.join(BUILD_DIR, file));
            console.log(`✅ Copied ${file}`);
        }
    }

    // Create version info
    const packageJson = await fs.readJson('package.json');
    const versionInfo = {
        version: packageJson.version,
        buildDate: new Date().toISOString(),
        buildType: 'bundled'
    };
    
    await fs.writeJson(path.join(BUILD_DIR, 'version.json'), versionInfo, { spaces: 2 });
    console.log('✅ Created version info');
}

// Run bundle if called directly
if (require.main === module) {
    bundle();
}

module.exports = { bundle };
