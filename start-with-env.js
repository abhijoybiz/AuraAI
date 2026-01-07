#!/usr/bin/env node

// Load environment variables from .env.local
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env.local');

if (fs.existsSync(envPath)) {
    console.log('env: load .env.local');

    const envContent = fs.readFileSync(envPath, 'utf-8');
    const lines = envContent.split('\n');

    lines.forEach(line => {
        line = line.trim();
        if (line && !line.startsWith('#')) {
            const [key, ...valueParts] = line.split('=');
            const value = valueParts.join('=').trim();

            if (key && value) {
                process.env[key.trim()] = value;
                console.log(`env: export ${key.trim()}`);
            }
        }
    });
} else {
    console.warn('Warning: .env.local file not found');
}

// Now start Expo
const { spawn } = require('child_process');
const args = process.argv.slice(2);

const expo = spawn('npx', ['expo', 'start', ...args], {
    stdio: 'inherit',
    shell: true,
    env: process.env
});

expo.on('exit', (code) => {
    process.exit(code);
});
