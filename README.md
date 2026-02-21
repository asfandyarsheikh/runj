# nipox

Download and execute bash scripts from URLs or GitHub repositories with cross-platform support.

## Overview

nipox is a command-line tool that allows you to download and execute bash scripts directly from URLs or from the n-p-x GitHub organization repositories. It provides cross-platform support for Linux, macOS, and Windows (with Git Bash/WSL), and can also execute YAML Taskfiles.

## Installation

### Global Installation
```bash
npm install -g nipox
```

### One-time Execution
```bash
npx nipox <url|script-name> [args...]
```

## Usage

### Basic Syntax
```bash
nipox <url|script-name> [args...]
```

### Examples

#### 1. Execute a script from a direct URL
```bash
nipox https://example.com/setup.sh
nipox https://raw.githubusercontent.com/user/repo/main/install.sh --verbose
```

#### 2. Execute a script from the n-p-x/e repository (default)
```bash
nipox my-script
nipox deploy-app production
```

#### 3. Execute a script from a specific n-p-x repository
```bash
nipox docker/setup-container
nipox terraform/deploy-infrastructure us-east-1
```

#### 4. Execute YAML Taskfiles
```bash
nipox https://example.com/Taskfile.yml build
nipox tasks/build-project
```

## Platform Support

### Linux & macOS
- **bash** (preferred)
- **sh** (fallback)

### Windows
- **Git Bash** (recommended)
- **WSL bash** (Windows Subsystem for Linux)
- **PowerShell** (limited support, not yet implemented)

## Features

- **Cross-platform compatibility** - Works on Linux, macOS, and Windows
- **Multiple shell support** - Automatically detects and uses available shells
- **GitHub integration** - Easy execution of scripts from n-p-x repositories
- **Taskfile support** - Execute YAML-based task files using @go-task/cli
- **Temporary execution** - Scripts are downloaded to temp directory and cleaned up
- **Error handling** - Comprehensive error messages and troubleshooting guidance
- **Cache-busting** - Always downloads fresh copies of scripts

## Repository Structure

The tool supports scripts from the n-p-x GitHub organization:

- Default repository: `n-p-x/e`
- Custom repositories: `n-p-x/{repo-name}`

### URL Resolution Examples

| Input | Resolved URL |
|-------|-------------|
| `my-script` | `https://raw.githubusercontent.com/n-p-x/e/main/my-script` |
| `docker/setup` | `https://raw.githubusercontent.com/n-p-x/docker/main/setup` |
| `https://example.com/script.sh` | `https://example.com/script.sh` |

## Requirements

### Linux/macOS
- Node.js (for nipox)
- bash or sh shell

### Windows
- Node.js (for nipox)
- One of the following:
  - **Git for Windows** (includes Git Bash) - Recommended
  - **Windows Subsystem for Linux (WSL)**
  - PowerShell (limited support)

## Troubleshooting

### "No compatible shell found" Error

**On Windows:**
1. Install [Git for Windows](https://git-scm.com/download/win) (includes Git Bash)
2. Install [Windows Subsystem for Linux (WSL)](https://docs.microsoft.com/en-us/windows/wsl/install)

**On Linux:**
```bash
# Ubuntu/Debian
sudo apt install bash

# CentOS/RHEL/Fedora
sudo yum install bash
# or
sudo dnf install bash
```

**On macOS:**
```bash
# Using Homebrew
brew install bash
```

### Download Errors
- Check your internet connection
- Verify the URL is accessible
- Ensure the script exists in the specified repository

## Development

### Building from Source

```bash
git clone https://github.com/asfandyarsheikh/nipox.git
cd nipox
npm install
npm run build
```

### Project Structure
```
├── src/
│   └── index.js          # Main application logic
├── dist/                 # Compiled output (generated)
├── package.json          # Package configuration
├── tsup.config.js        # Build configuration
└── README.md            # This file
```

## License

ISC License

## Author

Asfandyar Sheikh

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Related Projects

- [@go-task/cli](https://taskfile.dev/) - Task runner used for YAML file execution
- [n-p-x organization](https://github.com/n-p-x) - Default source for scripts