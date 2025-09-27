#!/usr/bin/env node

/**
 * Package script for tunnl.ai Chrome Extension
 * Creates a zip file for distribution
 */

const fs = require('fs-extra');
const path = require('path');
const archiver = require('archiver');

const BUILD_DIR = 'dist';
const PACKAGE_DIR = 'packages';

async function package() {
    console.log('📦 Starting packaging process...');
    
    try {
        // Ensure build directory exists
        if (!await fs.pathExists(BUILD_DIR)) {
            console.log('❌ Build directory not found. Run "npm run build" first.');
            process.exit(1);
        }

        // Create packages directory
        await fs.ensureDir(PACKAGE_DIR);

        // Read version from package.json
        const packageJson = await fs.readJson('package.json');
        const version = packageJson.version;
        const timestamp = new Date().toISOString().split('T')[0];
        
        // Create zip file
        const zipName = `tunnl-ai-extension-v${version}-${timestamp}.zip`;
        const zipPath = path.join(PACKAGE_DIR, zipName);
        
        const output = fs.createWriteStream(zipPath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        return new Promise((resolve, reject) => {
            output.on('close', () => {
                console.log('🎉 Packaging completed successfully!');
                console.log(`📦 Package created: ${zipPath}`);
                console.log(`📊 Archive size: ${(archive.pointer() / 1024 / 1024).toFixed(2)} MB`);
                resolve();
            });

            archive.on('error', (err) => {
                console.error('❌ Packaging failed:', err);
                reject(err);
            });

            archive.pipe(output);
            archive.directory(BUILD_DIR, false);
            archive.finalize();
        });
        
    } catch (error) {
        console.error('❌ Packaging failed:', error);
        process.exit(1);
    }
}

// Run package if called directly
if (require.main === module) {
    package();
}

module.exports = { package };
