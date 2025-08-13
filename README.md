# Repository Manager

<div align="center">

![Repository Manager](app-icon.svg)

**A powerful Tauri-based desktop application for managing and analyzing Git repositories**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Built with Tauri](https://img.shields.io/badge/Built%20with-Tauri-24C8D8)](https://tauri.app/)
[![React](https://img.shields.io/badge/React-18-61DAFB)](https://reactjs.org/)
[![Rust](https://img.shields.io/badge/Rust-000000?logo=rust&logoColor=white)](https://www.rust-lang.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

[Features](#features) • [Installation](#installation) • [Usage](#usage) • [Development](#development) • [Architecture](#architecture)

</div>

## 🚀 Features

### 📊 **Repository Analysis**
- **Real-time scanning** with progress tracking (`Analyzing 67/419: project-name`)
- **Language detection** using tokei with smart optimization
- **Git status analysis** (branches, uncommitted changes, remotes)
- **Size calculation** and code metrics
- **Activity tracking** with last commit information

### ⚡ **Performance Optimized**
- **< 500ms startup** with intelligent caching system
- **No hanging** on large directories (50+ million lines of code)
- **Smart exclusions** (node_modules, .git, dist, build)
- **Size limits** to prevent analysis of massive directories
- **Incremental scanning** with ADD mode for new repositories

### 🎯 **Smart Scanning**
- **Path conflict detection** prevents scanning entire drives accidentally
- **Concurrent scan protection** with lock mechanism
- **Deduplication** ensures no duplicate repositories
- **Two-pass scanning** for accurate progress tracking
- **Cache persistence** across application restarts

### 🖥️ **Modern Interface**
- **Clean, responsive design** with Tailwind CSS
- **Advanced filtering** (Git only, with changes, without remotes)
- **Search functionality** with real-time results
- **Bulk operations** for multiple repositories
- **Detailed repository views** with comprehensive information

### 📈 **Analytics Dashboard**
- **Repository statistics** overview
- **Largest repositories** by size
- **Most active repositories** by recent commits
- **Repositories needing attention** (uncommitted changes, no remotes)
- **Language distribution** across your codebase

## 📸 Screenshots

### Dashboard Overview
Clean interface showing repository statistics and insights

### Repository Grid
Advanced filtering and selection with repository cards

### Batch Operations
Bulk Git operations across multiple repositories

## 🛠️ Installation

### Prerequisites

- **Node.js** 18+ and npm/yarn
- **Rust** 1.70+ with Cargo
- **Git** for repository analysis

### Quick Start

```bash
# Clone the repository
git clone https://github.com/phuongwd/repo-manager.git
cd repo-manager

# Install dependencies
npm install

# Run in development mode
npm run tauri:dev

# Build for production
npm run tauri:build
```

### Pre-built Releases

Download the latest release for your platform:
- **macOS**: `.dmg` installer
- **Windows**: `.msi` installer  
- **Linux**: `.AppImage` or `.deb` package

## 🎯 Usage

### Getting Started

1. **Launch the application**
2. **Select a directory** to scan using "Replace All" button
3. **View results** in the dashboard and repository grid
4. **Add more directories** using "Add More" button for incremental scanning

### Key Workflows

#### **Initial Setup**
```
Select Directory → Scan → View Results → Cache Created
```

#### **Adding More Repositories**
```
Add More → Select Directory → Merge with Existing → Updated Results
```

#### **Bulk Operations**
```
Select Repositories → Batch Tab → Choose Operation → Execute
```

### Pro Tips

- **Use ADD mode** to scan multiple separate directories
- **Check for conflicts** when scanning overlapping paths
- **Leverage caching** for instant startup on subsequent launches
- **Filter repositories** to focus on specific needs
- **Use batch operations** for Git maintenance across multiple repos

## 🏗️ Development

### Tech Stack

- **Frontend**: React 18 + TypeScript + Tailwind CSS
- **Backend**: Rust + Tauri v2
- **Git Operations**: libgit2 (git2 crate)
- **Language Analysis**: tokei
- **File Operations**: ignore crate for .gitignore support
- **Caching**: JSON-based with serde serialization

### Project Structure

```
repo-manager/
├── src/                          # React frontend
│   ├── components/              # UI components
│   ├── types/                   # TypeScript definitions
│   └── utils/                   # Utility functions
├── src-tauri/                   # Rust backend
│   ├── src/
│   │   ├── adapters/           # External library adapters
│   │   ├── cache/              # Caching system
│   │   ├── commands/           # Tauri commands
│   │   ├── models/             # Data structures
│   │   └── services/           # Business logic
│   └── Cargo.toml              # Rust dependencies
└── DEVELOPMENT_PROGRESS.md      # Detailed progress tracking
```

### Development Commands

```bash
# Frontend development
npm run dev                      # Vite dev server
npm run build                    # Build frontend
npm run preview                  # Preview build

# Tauri development  
npm run tauri:dev               # Run app in dev mode
npm run tauri:build             # Build production app

# Code quality
npm run lint                    # ESLint checking
npm run lint:fix                # Fix ESLint issues
npx tsc --noEmit               # TypeScript checking
```

### Contributing

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Follow** conventional commit format
4. **Add** tests for new functionality
5. **Submit** a pull request

## 🏛️ Architecture

### Backend (Rust)

```rust
// Adapter Pattern for External Dependencies
GitAdapter       → libgit2 operations
TokeiAdapter     → Language analysis with optimizations  
FilesystemAdapter → Directory operations
IgnoreAdapter    → .gitignore parsing

// Service Layer
RepositoryService → Business logic orchestration

// Cache System
CacheService     → Persistent storage with versioning
```

### Frontend (React)

```typescript
// Component Architecture
App              → Main application state
Sidebar          → Navigation and controls
RepositoryGrid   → Repository list with filtering
RepositoryDetails → Detailed repository information
StatsOverview    → Analytics dashboard
BatchOperations  → Bulk Git operations
```

### Performance Optimizations

- **Size limits**: Skip tokei analysis for directories > 5MB
- **Smart exclusions**: Comprehensive directory filtering
- **Progress tracking**: Real-time feedback with directory names
- **Concurrent protection**: Prevent multiple simultaneous scans
- **Path deduplication**: Avoid scanning overlapping directories

## 📊 Performance Metrics

### Before Optimizations
- **Scan time**: 10+ minutes for large directories
- **Hanging**: Frequent hangs on node_modules
- **Memory**: High usage from unoptimized analysis
- **Feedback**: Generic "Scanning..." messages

### After Optimizations  
- **Scan time**: < 2 minutes for 419 directories
- **Startup**: < 500ms with cached data
- **Reliability**: No hanging, graceful handling
- **Progress**: "Analyzing (67/419): project-name" updates

## 🔧 Configuration

### Cache Location
- **macOS**: `~/Library/Application Support/com.phuong.repo-manager/cache/`
- **Windows**: `%APPDATA%/com.phuong.repo-manager/cache/`
- **Linux**: `~/.config/com.phuong.repo-manager/cache/`

### Performance Settings
The application automatically optimizes performance based on:
- Directory size thresholds
- Subdirectory count limits  
- File type exclusions
- Git repository detection

## 🐛 Known Issues

- **Large repositories**: Some edge cases may still cause delays
- **Cancel functionality**: No ability to stop running scans (planned)

## 🚧 Roadmap

See [DEVELOPMENT_PROGRESS.md](DEVELOPMENT_PROGRESS.md) for detailed feature tracking:

### Phase 10: UI/UX Enhancements (Tasks 47-60)
- Repository grouping and workspace organization
- Enhanced batch operations and contextual actions
- Data visualization and analytics improvements

### Phase 12: Advanced Features (Tasks 35-45)
- Git HEAD SHA tracking for incremental updates
- Smart cache invalidation logic
- Export/import functionality
- Performance optimizations

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Tauri** - For the excellent desktop app framework
- **tokei** - For fast and accurate language analysis
- **libgit2** - For robust Git operations
- **React** - For the fantastic UI framework
- **Tailwind CSS** - For beautiful, responsive styling

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/phuongwd/repo-manager/issues)
- **Discussions**: [GitHub Discussions](https://github.com/phuongwd/repo-manager/discussions)
- **Documentation**: [Development Progress](DEVELOPMENT_PROGRESS.md)

---

<div align="center">

**Made with ❤️ using Tauri, Rust, and React**

[⭐ Star this repository](https://github.com/phuongwd/repo-manager) if you find it helpful!

</div>