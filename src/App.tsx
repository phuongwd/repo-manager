import { useState, useEffect } from "react";
import * as core from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";
import { Sidebar } from "./components/Sidebar";

// TypeScript declaration for Tauri internals
declare global {
  interface Window {
    __TAURI_INTERNALS__?: any;
  }
}
import { RepositoryGrid } from "./components/RepositoryGrid";
import { RepositoryDetails } from "./components/RepositoryDetails";
import { StatsOverview } from "./components/StatsOverview";
import { BatchOperations } from "./components/BatchOperations";
import { Repository, DirectoryStats, FilterOptions } from "./types";

function App() {
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [stats, setStats] = useState<DirectoryStats | null>(null);
  const [selectedRepo, setSelectedRepo] = useState<Repository | null>(null);
  const [currentPath, setCurrentPath] = useState<string>("");
  const [scannedPaths, setScannedPaths] = useState<Set<string>>(new Set()); // User-selected scan roots
  const [scanRoots, setScanRoots] = useState<Set<string>>(new Set()); // Directories actually scanned (for UI display)
  const [loading, setLoading] = useState(false);
  const [scanProgress, setScanProgress] = useState<string>("");
  const [isScanning, setIsScanning] = useState(false); // Scan lock mechanism
  const [selectedRepos, setSelectedRepos] = useState<Set<string>>(new Set());
  const [activeView, setActiveView] = useState<'overview' | 'repositories' | 'batch'>('overview');
  const [filters, setFilters] = useState<FilterOptions>({
    showGitOnly: false,
    showWithChanges: false,
    showWithoutRemotes: false,
    searchTerm: '',
    sortBy: 'name',
    sortOrder: 'asc',
  });

  // Initialize Tauri but don't auto-scan
  useEffect(() => {
    const initTauri = async () => {
      let attempts = 0;
      const maxAttempts = 50;
      
      while (attempts < maxAttempts) {
        if (window.__TAURI_INTERNALS__ && typeof core.invoke === 'function') {
          console.log("Tauri is ready!");
          
          // Set up progress listener
          listen('scan-progress', (event: any) => {
            const { current_directory, scanned_count, total_count } = event.payload;
            // Show full path in a shortened form
            const pathParts = current_directory.split('/');
            const displayPath = pathParts.length > 3 
              ? `.../${pathParts.slice(-3).join('/')}` 
              : current_directory;
            setScanProgress(`Analyzing (${scanned_count}/${total_count}): ${displayPath}`);
          });
          
          // Try to load cached repositories on app startup
          try {
            console.log("🔄 Attempting to load cached repositories...");
            const cachedRepos = await core.invoke("load_cached_repositories") as Repository[] | null;
            
            if (cachedRepos && cachedRepos.length > 0) {
              console.log("✅ Loaded", cachedRepos.length, "repositories from cache");
              setRepositories(cachedRepos);
              
              // Calculate stats from cached data
              const gitRepos = cachedRepos.filter(r => r.is_git_repo);
              const directoryStats: DirectoryStats = {
                total_directories: cachedRepos.length,
                git_repositories: gitRepos.length,
                non_git_directories: cachedRepos.length - gitRepos.length,
                repositories_with_changes: gitRepos.filter(r => r.has_uncommitted_changes).length,
                repositories_with_remotes: gitRepos.filter(r => r.remotes.length > 0).length,
                total_size_mb: cachedRepos.reduce((sum, r) => sum + r.size_mb, 0),
                largest_repos: [...cachedRepos].sort((a, b) => b.size_mb - a.size_mb).slice(0, 10),
                most_active_repos: [...cachedRepos].sort((a, b) => {
                  const aTime = a.last_commit_date ? new Date(a.last_commit_date).getTime() : 0;
                  const bTime = b.last_commit_date ? new Date(b.last_commit_date).getTime() : 0;
                  return bTime - aTime;
                }).slice(0, 10),
                repos_needing_attention: gitRepos.filter(r => 
                  r.has_uncommitted_changes || r.remotes.length === 0
                ).slice(0, 20)
              };
              
              setStats(directoryStats);
              setScanProgress("Loaded from cache");
              setTimeout(() => setScanProgress(""), 2000);
            } else {
              console.log("ℹ️  No cached repositories found");
            }
          } catch (error) {
            console.log("⚠️  Failed to load cached repositories:", error);
          }
          
          // Set default path but don't auto-scan
          const defaultPath = "/Users/phuong/Documents";
          setCurrentPath(defaultPath);
          return;
        }
        attempts++;
        console.log(`Waiting for Tauri... attempt ${attempts}`);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      console.error("Tauri failed to initialize");
      alert("Tauri failed to initialize. Please refresh the page.");
    };
    
    initTauri();
  }, []);

  // Helper function to check if a path is a parent or child of existing scanned paths
  const checkPathConflicts = (newPath: string, existingPaths: Set<string>) => {
    const normalizedNew = newPath.replace(/\/$/, ''); // Remove trailing slash
    
    for (const existingPath of existingPaths) {
      const normalizedExisting = existingPath.replace(/\/$/, '');
      
      // Check if new path is a parent of existing path
      if (normalizedExisting.startsWith(normalizedNew + '/')) {
        return { 
          hasConflict: true, 
          type: 'parent',
          conflictPath: existingPath,
          message: `"${newPath}" contains already scanned directory "${existingPath}"`
        };
      }
      
      // Check if new path is a child of existing path
      if (normalizedNew.startsWith(normalizedExisting + '/')) {
        return { 
          hasConflict: true, 
          type: 'child',
          conflictPath: existingPath,
          message: `"${newPath}" is already included in scanned directory "${existingPath}"`
        };
      }
      
      // Check if paths are identical
      if (normalizedNew === normalizedExisting) {
        return { 
          hasConflict: true, 
          type: 'duplicate',
          conflictPath: existingPath,
          message: `"${newPath}" has already been scanned`
        };
      }
    }
    
    return { hasConflict: false };
  };

  const scanDirectory = async (path: string, addMode: boolean = false) => {
    if (!path) return;
    
    // Scan lock mechanism - prevent concurrent scans
    if (isScanning) {
      setScanProgress("⚠️ Another scan is already in progress. Please wait...");
      setTimeout(() => setScanProgress(""), 3000);
      return;
    }
    
    console.log("Scanning directory:", path, "Mode:", addMode ? "ADD" : "REPLACE");
    
    if (!window.__TAURI_INTERNALS__ || !core.invoke) {
      alert("Tauri API not ready");
      return;
    }
    
    // Smart path deduplication - check for conflicts in ADD mode
    if (addMode && scannedPaths.size > 0) {
      const pathCheck = checkPathConflicts(path, scannedPaths);
      if (pathCheck.hasConflict) {
        const shouldProceed = window.confirm(
          `Path Conflict Detected:\n\n${pathCheck.message}\n\nDo you want to proceed anyway? This may result in duplicate repositories.`
        );
        if (!shouldProceed) {
          setScanProgress("Scan cancelled due to path conflict");
          setTimeout(() => setScanProgress(""), 2000);
          return;
        }
      }
    }
    
    // Acquire scan lock
    setIsScanning(true);
    setLoading(true);
    setScanProgress("Initializing scan...");
    
    try {
      setScanProgress("Scanning directories for repositories...");
      console.log("Invoking scan_repositories...");
      const newRepos = await core.invoke<Repository[]>("scan_repositories", { 
        directoryPath: path, 
        addMode: addMode 
      });
      
      let allRepos: Repository[];
      let scanRootsToTrack = new Set(scanRoots);
      
      if (addMode && repositories.length > 0) {
        // Merge with existing repositories, removing duplicates
        const existingPaths = new Set(repositories.map(r => r.path));
        const uniqueNewRepos = newRepos.filter(r => !existingPaths.has(r.path));
        allRepos = [...repositories, ...uniqueNewRepos];
        scanRootsToTrack.add(path);
        setScanProgress(`Added ${uniqueNewRepos.length} new repositories (${newRepos.length - uniqueNewRepos.length} duplicates skipped)`);
      } else {
        // Replace mode
        allRepos = newRepos;
        scanRootsToTrack = new Set([path]);
        setScanProgress(`Found ${newRepos.length} repositories`);
      }
      
      // Sort repositories by name
      allRepos.sort((a, b) => a.name.localeCompare(b.name));
      
      // Recalculate stats for all repositories
      const gitRepos = allRepos.filter(r => r.is_git_repo);
      const directoryStats: DirectoryStats = {
        total_directories: allRepos.length,
        git_repositories: gitRepos.length,
        non_git_directories: allRepos.length - gitRepos.length,
        repositories_with_changes: gitRepos.filter(r => r.has_uncommitted_changes).length,
        repositories_with_remotes: gitRepos.filter(r => r.remotes.length > 0).length,
        total_size_mb: allRepos.reduce((sum, r) => sum + r.size_mb, 0),
        largest_repos: [...allRepos].sort((a, b) => b.size_mb - a.size_mb).slice(0, 10),
        most_active_repos: [...allRepos].sort((a, b) => {
          const aTime = a.last_commit_date ? new Date(a.last_commit_date).getTime() : 0;
          const bTime = b.last_commit_date ? new Date(b.last_commit_date).getTime() : 0;
          return bTime - aTime;
        }).slice(0, 10),
        repos_needing_attention: gitRepos.filter(r => 
          r.has_uncommitted_changes || r.remotes.length === 0
        ).slice(0, 20)
      };
      
      console.log("Scan results:", { totalRepos: allRepos.length, stats: directoryStats });
      setRepositories(allRepos);
      setStats(directoryStats);
      setScanRoots(scanRootsToTrack);
      
      // Update scannedPaths for conflict detection (keep track of user selections)
      const updatedScannedPaths = new Set(scannedPaths);
      if (addMode) {
        updatedScannedPaths.add(path);
      } else {
        updatedScannedPaths.clear();
        updatedScannedPaths.add(path);
      }
      setScannedPaths(updatedScannedPaths);
    } catch (error) {
      console.error("Failed to scan directory:", error);
      setScanProgress("Scan failed!");
      alert(`Failed to scan directory: ${error}`);
    } finally {
      // Release scan lock
      setIsScanning(false);
      setLoading(false);
      setTimeout(() => setScanProgress(""), 3000); // Clear progress after 3 seconds
    }
  };

  const selectDirectory = async (addMode: boolean = false) => {
    try {
      console.log("Opening directory dialog...", "Mode:", addMode ? "ADD" : "REPLACE");
      const selected = await open({
        directory: true,
        multiple: false,
        defaultPath: currentPath || "/Users/phuong/Documents",
      });
      
      console.log("Dialog result:", selected);
      
      if (selected && typeof selected === 'string') {
        console.log("Setting path to:", selected);
        if (!addMode) {
          setCurrentPath(selected);
        }
        await scanDirectory(selected, addMode);
      } else {
        console.log("No directory selected or dialog cancelled");
      }
    } catch (error) {
      console.error("Failed to select directory:", error);
      alert(`Failed to select directory: ${error}`);
    }
  };

  const refreshCurrentDirectory = async () => {
    // Scan lock mechanism - prevent concurrent operations
    if (isScanning) {
      setScanProgress("⚠️ Another scan is already in progress. Please wait...");
      setTimeout(() => setScanProgress(""), 3000);
      return;
    }
    
    if (scanRoots.size === 0 && currentPath) {
      // If no paths scanned yet but we have a current path, scan it
      await scanDirectory(currentPath, false);
    } else if (scanRoots.size > 0) {
      // Acquire scan lock for refresh operation
      setIsScanning(true);
      
      // Refresh all scanned paths
      setLoading(true);
      setScanProgress("Refreshing all directories...");
      
      let allRepos: Repository[] = [];
      let scanIndex = 0;
      
      for (const path of Array.from(scanRoots)) {
        scanIndex++;
        setScanProgress(`Refreshing ${scanIndex}/${scanRoots.size}: ${path.split('/').pop()}`);
        
        try {
          const repos = await core.invoke<Repository[]>("scan_repositories", { 
        directoryPath: path, 
        addMode: false  // Always false for refresh - don't merge during refresh
      });
          // Merge avoiding duplicates
          const existingPaths = new Set(allRepos.map(r => r.path));
          const uniqueRepos = repos.filter(r => !existingPaths.has(r.path));
          allRepos = [...allRepos, ...uniqueRepos];
        } catch (error) {
          console.error(`Failed to refresh ${path}:`, error);
        }
      }
      
      // Sort and update
      allRepos.sort((a, b) => a.name.localeCompare(b.name));
      
      // Recalculate stats
      const gitRepos = allRepos.filter(r => r.is_git_repo);
      const directoryStats: DirectoryStats = {
        total_directories: allRepos.length,
        git_repositories: gitRepos.length,
        non_git_directories: allRepos.length - gitRepos.length,
        repositories_with_changes: gitRepos.filter(r => r.has_uncommitted_changes).length,
        repositories_with_remotes: gitRepos.filter(r => r.remotes.length > 0).length,
        total_size_mb: allRepos.reduce((sum, r) => sum + r.size_mb, 0),
        largest_repos: [...allRepos].sort((a, b) => b.size_mb - a.size_mb).slice(0, 10),
        most_active_repos: [...allRepos].sort((a, b) => {
          const aTime = a.last_commit_date ? new Date(a.last_commit_date).getTime() : 0;
          const bTime = b.last_commit_date ? new Date(b.last_commit_date).getTime() : 0;
          return bTime - aTime;
        }).slice(0, 10),
        repos_needing_attention: gitRepos.filter(r => 
          r.has_uncommitted_changes || r.remotes.length === 0
        ).slice(0, 20)
      };
      
      setRepositories(allRepos);
      setStats(directoryStats);
      setScanProgress("Refresh completed!");
      
      // Release scan lock
      setIsScanning(false);
      setLoading(false);
      setTimeout(() => setScanProgress(""), 2000);
    }
  };

  const handleRepoSelect = (repo: Repository) => {
    setSelectedRepo(repo);
  };

  const handleRepoToggle = (repoPath: string) => {
    const newSelected = new Set(selectedRepos);
    if (newSelected.has(repoPath)) {
      newSelected.delete(repoPath);
    } else {
      newSelected.add(repoPath);
    }
    setSelectedRepos(newSelected);
  };

  const handleSelectAll = () => {
    const gitRepos = repositories.filter(r => r.is_git_repo);
    setSelectedRepos(new Set(gitRepos.map(r => r.path)));
  };

  const handleSelectNone = () => {
    setSelectedRepos(new Set());
  };

  const testCacheService = async () => {
    try {
      setScanProgress("Testing cache service...");
      const result = await core.invoke("test_cache_service") as string;
      setScanProgress(result);
      console.log("Cache test result:", result);
    } catch (error) {
      console.error("Cache test failed:", error);
      setScanProgress(`Cache test failed: ${error}`);
    }
  };

  return (
    <div className="flex h-screen bg-background text-foreground">
      <Sidebar 
        activeView={activeView}
        onViewChange={setActiveView}
        stats={stats}
        currentPath={currentPath}
        scannedPaths={scanRoots}
        onSelectDirectory={selectDirectory}
        onRefresh={refreshCurrentDirectory}
        loading={loading}
      />
      
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Loading State */}
        {loading && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-md">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-lg font-medium mb-2">Scanning repositories...</p>
              <p className="text-sm text-muted-foreground mb-4">
                Scanning for Git repositories and analyzing code...
              </p>
              {scanProgress && (
                <div className="text-xs text-muted-foreground bg-card p-3 rounded-lg border border-border">
                  <p className="font-mono">{scanProgress}</p>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Welcome State - No data yet */}
        {!loading && !stats && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-md">
              <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center">
                <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2V7zm0 0V5a2 2 0 012-2h6l2 2h6a2 2 0 012 2v2M7 13h10M7 17h10" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold mb-4">Repository Manager</h2>
              <p className="text-muted-foreground mb-6">
                Select a directory to start analyzing your Git repositories. 
                The app will scan for all repositories and provide insights about their status.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => selectDirectory(false)}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2V7zm0 0V5a2 2 0 012-2h6l2 2h6a2 2 0 012 2v2" />
                  </svg>
                  Select Directory to Scan
                </button>
                
                <button
                  onClick={testCacheService}
                  className="inline-flex items-center gap-2 px-4 py-3 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/90 transition-colors text-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12l4-4m-4 4l4 4" />
                  </svg>
                  Test Cache
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Content States - After scanning */}
        {!loading && stats && activeView === 'overview' && (
          <StatsOverview 
            stats={stats} 
            onNavigateToRepos={() => setActiveView('repositories')}
          />
        )}
        
        {!loading && activeView === 'repositories' && (
          <div className="flex-1 flex">
            <div className="flex-1 flex flex-col">
              <RepositoryGrid 
                repositories={repositories}
                loading={loading}
                selectedRepos={selectedRepos}
                filters={filters}
                onRepoSelect={handleRepoSelect}
                onRepoToggle={handleRepoToggle}
                onSelectAll={handleSelectAll}
                onSelectNone={handleSelectNone}
                onFiltersChange={setFilters}
              />
            </div>
            
            {selectedRepo && (
              <div className="w-96 border-l border-border">
                <RepositoryDetails 
                  repository={selectedRepo}
                  onClose={() => setSelectedRepo(null)}
                />
              </div>
            )}
          </div>
        )}
        
        {!loading && activeView === 'batch' && (
          <BatchOperations 
            repositories={repositories.filter(r => r.is_git_repo)}
            selectedRepos={selectedRepos}
            onRefresh={refreshCurrentDirectory}
          />
        )}
      </main>
    </div>
  );
}

export default App;