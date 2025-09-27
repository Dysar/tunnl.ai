#!/usr/bin/env node

/**
 * Build script for tunnl.ai Chrome Extension
 * This script prepares the extension for distribution
 */

const fs = require('fs-extra');
const path = require('path');

const BUILD_DIR = 'dist';
const SRC_DIR = 'src';
const ASSETS_DIR = 'assets';

async function build() {
    console.log('🔨 Starting build process...');
    
    try {
        // Clean build directory
        await fs.remove(BUILD_DIR);
        await fs.ensureDir(BUILD_DIR);
        console.log('✅ Cleaned build directory');

        // Copy HTML and CSS files from src to dist
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
        await fs.copy(ASSETS_DIR, path.join(BUILD_DIR, ASSETS_DIR));
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
            buildType: 'production'
        };
        
        await fs.writeJson(path.join(BUILD_DIR, 'version.json'), versionInfo, { spaces: 2 });
        console.log('✅ Created version info');

        console.log('🎉 Build completed successfully!');
        console.log(`📦 Extension ready in: ${BUILD_DIR}/`);
        
    } catch (error) {
        console.error('❌ Build failed:', error);
        process.exit(1);
    }
}

// Run build if called directly
if (require.main === module) {
    build();
}

module.exports = { build };
