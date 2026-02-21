#!/usr/bin/env node

import { spawn } from 'child_process';
import { createWriteStream, unlinkSync, chmodSync } from 'fs';
import { tmpdir, platform } from 'os';
import { join } from 'path';
import { pipeline } from 'stream/promises';

function getShellInfo() {
  const platformName = platform();
  
  switch (platformName) {
    case 'win32':
      // Windows: try Git Bash, WSL bash, or fallback to PowerShell
      return {
        shells: [
          { command: 'bash', args: [], name: 'Git Bash/WSL' },
          { command: 'wsl', args: ['bash'], name: 'WSL bash' },
          { command: 'powershell', args: ['-File'], name: 'PowerShell', extension: '.ps1' }
        ],
        scriptExtension: '.sh'
      };
    case 'darwin':
    case 'linux':
    default:
      return {
        shells: [
          { command: 'bash', args: [], name: 'bash' },
          { command: 'sh', args: [], name: 'sh' }
        ],
        scriptExtension: '.sh'
      };
  }
}

function isYamlFile(url) {
  return url.toLowerCase().endsWith('.yml') || url.toLowerCase().endsWith('.yaml');
}

function isJavaScriptFile(url) {
  return url.toLowerCase().endsWith('.js');
}

function executeWithTaskfile(taskfilePath, args) {
  return new Promise((resolve, reject) => {
    const commandArgs = ['@go-task/cli', '--dir', process.cwd(), '--taskfile', taskfilePath, ...args];
    
    const child = spawn('npx', commandArgs, {
      stdio: 'inherit',
      shell: false
    });
    
    child.on('close', (code) => {
      resolve(code);
    });
    
    child.on('error', (error) => {
      reject(error);
    });
  });
}

function executeJavaScriptWithDeps(scriptPath, args) {
  return new Promise(async (resolve, reject) => {
    try {
      // Read the JavaScript file to extract dependencies
      const fs = await import('fs');
      const path = await import('path');
      const scriptContent = fs.readFileSync(scriptPath, 'utf8');
      
      // Check if the script uses ES6 imports/exports
      const hasES6Modules = /^\s*(import|export)\s+/m.test(scriptContent);
      
      // Extract dependencies
      let dependencies = [];
      try {
        const depsMatch = scriptContent.match(/(?:const|let|var|export\s+const)\s+deps\s*=\s*(\[[^\]]*\])/);
        
        if (depsMatch) {
          try {
            dependencies = JSON.parse(depsMatch[1]);
          } catch (parseError) {
            try {
              dependencies = eval(depsMatch[1]);
            } catch (evalError) {
              console.error(`Debug: Failed to eval deps array: ${evalError.message}`);
            }
          }
        }
      } catch (error) {
        console.error(`Debug: Exception during extraction: ${error.message}`);
      }
      
      // Create a temporary directory for the project
      const tempProjectDir = join(tmpdir(), `nipox-project-${Date.now()}`);
      fs.mkdirSync(tempProjectDir);
      
      // Create package.json with dependencies
      const packageJson = {
        name: "nipox-temp-project",
        version: "1.0.0",
        type: hasES6Modules ? "module" : "commonjs",
        dependencies: {}
      };
      
      for (const dep of dependencies) {
        packageJson.dependencies[dep] = "latest";
      }
      
      fs.writeFileSync(
        join(tempProjectDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );
      
      // Copy script to temp project directory
      const tempScriptName = 'script.js';
      const tempScriptPath = join(tempProjectDir, tempScriptName);
      
      // Modify the script content
      const modifiedContent = `${scriptContent}

// Parse command line arguments (added by nipox)
const scriptArgs = process.argv.slice(2);
const positional = [];
const named = {};

for (let i = 0; i < scriptArgs.length; i++) {
  const arg = scriptArgs[i];
  if (arg.startsWith('--')) {
    const key = arg.substring(2);
    const nextArg = scriptArgs[i + 1];
    if (nextArg && !nextArg.startsWith('--')) {
      named[key] = nextArg;
      i++; // Skip the next argument as it's the value
    } else {
      named[key] = true;
    }
  } else {
    positional.push(arg);
  }
}

// Execute the script function if it exists (added by nipox)
if (typeof script === 'function') {
  script({ positional, named });
}
`;
      
      fs.writeFileSync(tempScriptPath, modifiedContent);
      
      console.error(`Executing JavaScript${hasES6Modules ? ' (ES6)' : ''} with dependencies: ${dependencies.join(', ') || 'none'}`);
      
      const originalCwd = process.cwd();
      // Install dependencies and run script
      const child = spawn('npx', ['--yes', '--', 'npm', 'install', '&&', 'node', tempScriptName, '--workdir', originalCwd, ...args], {
        stdio: 'inherit',
        shell: true,
        cwd: tempProjectDir
      });
      
      child.on('close', (code) => {
        // Clean up temporary directory
        try {
          fs.rmSync(tempProjectDir, { recursive: true, force: true });
        } catch (cleanupError) {
          console.error(`Cleanup warning: ${cleanupError.message}`);
        }
        resolve(code);
      });
      
      child.on('error', (error) => {
        // Clean up temporary directory
        try {
          fs.rmSync(tempProjectDir, { recursive: true, force: true });
        } catch (cleanupError) {
          console.error(`Cleanup warning: ${cleanupError.message}`);
        }
        reject(error);
      });
    } catch (error) {
      reject(error);
    }
  });
}

async function downloadFile(url, destination) {
  const response = await fetch(url, {
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to download: ${response.status} ${response.statusText}`);
  }
  
  const fileStream = createWriteStream(destination);
  await pipeline(response.body, fileStream);
}

async function findWorkingShell(shells) {
  for (const shell of shells) {
    try {
      // Test if the shell exists and works
      const testProcess = spawn(shell.command, ['--version'], { 
        stdio: 'pipe',
        shell: false 
      });
      
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          testProcess.kill();
          reject(new Error('Timeout'));
        }, 3000);
        
        testProcess.on('close', (code) => {
          clearTimeout(timeout);
          if (code === 0 || code === null) {
            resolve();
          } else {
            reject(new Error(`Exit code: ${code}`));
          }
        });
        
        testProcess.on('error', reject);
      });
      
      return shell;
    } catch (error) {
      console.error(`${shell.name} not available: ${error.message}`);
      continue;
    }
  }
  
  throw new Error('No compatible shell found. Please install bash, Git for Windows, or WSL.');
}

function executeScript(scriptPath, args, shell) {
  return new Promise((resolve, reject) => {
    let commandArgs;
    
    if (shell.extension === '.ps1') {
      // For PowerShell, we need to convert bash script to PowerShell
      reject(new Error('PowerShell execution not yet implemented. Please install Git Bash or WSL.'));
      return;
    } else {
      commandArgs = [...shell.args, scriptPath, ...args];
    }
    
    const child = spawn(shell.command, commandArgs, {
      stdio: 'inherit',
      shell: false,
      cwd: process.cwd()
    });
    
    child.on('close', (code) => {
      resolve(code);
    });
    
    child.on('error', (error) => {
      reject(error);
    });
  });
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('Usage: npx nipox <url|script-name> [args...]');
    console.error('');
    console.error('Examples:');
    console.error('  npx nipox https://example.com/script.sh arg1 arg2');
    console.error('  npx nipox my-script arg1 arg2  # downloads from n-p-x/e repo');
    console.error('  npx nipox repo/my-script arg1 arg2  # downloads from n-p-x/repo');
    console.error('');
    console.error('Platform:', platform());
    process.exit(1);
  }
  
  const [urlOrScript, ...scriptArgs] = args;
  let downloadUrl;
  
  // Determine if it's a URL or a script name from n-p-x repositories
  if (urlOrScript.startsWith('http://') || urlOrScript.startsWith('https://')) {
    downloadUrl = urlOrScript;
  } else {
    // Parse repo/file format or default to sh repo
    if (urlOrScript.includes('/')) {
      // Format: repo/file -> https://raw.githubusercontent.com/n-p-x/repo/main/file
      const [repo, ...fileParts] = urlOrScript.split('/');
      const file = fileParts.join('/');
      downloadUrl = `https://raw.githubusercontent.com/n-p-x/${repo}/main/${file}`;
    } else {
      // Default to sh repository for single script names
      downloadUrl = `https://raw.githubusercontent.com/n-p-x/e/main/${urlOrScript}`;
    }
  }
  
  // Get platform-specific shell information
  const shellInfo = getShellInfo();
  
  // Create temporary file for the script
  const tempDir = tmpdir();
  const isYaml = isYamlFile(downloadUrl);
  const isJavaScript = isJavaScriptFile(downloadUrl);
  const fileExtension = isYaml ? '.yml' : isJavaScript ? '.js' : shellInfo.scriptExtension;
  const scriptPath = join(tempDir, `nipox-${Date.now()}${fileExtension}`);
  
  try {
    console.error(`Platform: ${platform()}`);
    console.error(`Downloading: ${downloadUrl}`);
    await downloadFile(downloadUrl, scriptPath);
    
    // Make script executable on Unix-like systems
    if (platform() !== 'win32') {
      chmodSync(scriptPath, 0o755);
    }
    
    if (isYaml) {
      console.error('Detected YAML file. Executing with Taskfile...');
      const exitCode = await executeWithTaskfile(scriptPath, scriptArgs);
      unlinkSync(scriptPath);
      process.exit(exitCode);
    }
    
    if (isJavaScript) {
      console.error('Detected JavaScript file. Executing with dependencies...');
      const exitCode = await executeJavaScriptWithDeps(scriptPath, scriptArgs);
      unlinkSync(scriptPath);
      process.exit(exitCode);
    }
    
    // Find a working shell
    console.error('Finding compatible shell...');
    const shell = await findWorkingShell(shellInfo.shells);
    console.error(`Using: ${shell.name}`);
    
    console.error(`Executing: ${urlOrScript} ${scriptArgs.join(' ')}`);
    const exitCode = await executeScript(scriptPath, scriptArgs, shell);
    
    // Clean up temporary file
    unlinkSync(scriptPath);
    
    process.exit(exitCode);
  } catch (error) {
    // Clean up temporary file on error
    try {
      unlinkSync(scriptPath);
    } catch (cleanupError) {
      // Ignore cleanup errors
    }
    
    console.error(`Error: ${error.message}`);
    
    if (error.message.includes('No compatible shell found')) {
      console.error('');
      console.error('Solutions:');
      if (platform() === 'win32') {
        console.error('  - Install Git for Windows (includes Git Bash)');
        console.error('  - Install Windows Subsystem for Linux (WSL)');
        console.error('  - Use PowerShell (limited support)');
      } else {
        console.error('  - Install bash: sudo apt install bash (Ubuntu/Debian)');
        console.error('  - Install bash: brew install bash (macOS)');
      }
    }
    
    process.exit(1);
  }
}

(async () => {
  await main();
})();
