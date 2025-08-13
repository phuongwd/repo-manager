import { useState } from "react";
import { Repository, FilterOptions } from "../types";
import { formatBytes, formatRelativeTime, formatRepoStatus } from "../utils/formatters";
import { 
  GitBranch, 
  Folder, 
  Clock, 
  HardDrive, 
  Search,
  Filter,
  CheckSquare,
  Square,
  X
} from "lucide-react";

interface RepositoryGridProps {
  repositories: Repository[];
  loading: boolean;
  selectedRepos: Set<string>;
  filters: FilterOptions;
  onRepoSelect: (repo: Repository) => void;
  onRepoToggle: (repoPath: string) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
  onFiltersChange: (filters: FilterOptions) => void;
}

export function RepositoryGrid({ 
  repositories, 
  loading, 
  selectedRepos,
  filters,
  onRepoSelect, 
  onRepoToggle,
  onSelectAll,
  onSelectNone,
  onFiltersChange
}: RepositoryGridProps) {
  const [showFilters, setShowFilters] = useState(false);

  // Apply filters
  const filteredRepos = repositories.filter(repo => {
    if (filters.showGitOnly && !repo.is_git_repo) return false;
    if (filters.showWithChanges && !repo.has_uncommitted_changes) return false;
    if (filters.showWithoutRemotes && repo.remotes.length > 0) return false;
    if (filters.searchTerm && !repo.name.toLowerCase().includes(filters.searchTerm.toLowerCase())) return false;
    return true;
  });

  // Apply sorting
  const sortedRepos = [...filteredRepos].sort((a, b) => {
    const order = filters.sortOrder === 'asc' ? 1 : -1;
    
    switch (filters.sortBy) {
      case 'name':
        return order * a.name.localeCompare(b.name);
      case 'size':
        return order * (a.size_mb - b.size_mb);
      case 'activity':
        const aTime = a.last_activity ? new Date(a.last_activity).getTime() : 0;
        const bTime = b.last_activity ? new Date(b.last_activity).getTime() : 0;
        return order * (bTime - aTime);
      case 'status':
        return order * a.status.toString().localeCompare(b.status.toString());
      default:
        return 0;
    }
  });

  const gitRepos = repositories.filter(r => r.is_git_repo);
  const allGitSelected = gitRepos.length > 0 && gitRepos.every(r => selectedRepos.has(r.path));
  const someGitSelected = gitRepos.some(r => selectedRepos.has(r.path));

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Scanning repositories...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Header with filters and actions */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">
            Repositories ({filteredRepos.length}{filteredRepos.length !== repositories.length && ` of ${repositories.length}`})
          </h2>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-3 py-1 rounded border transition-colors ${
                showFilters ? 'bg-primary text-primary-foreground' : 'border-border hover:bg-accent'
              }`}
            >
              <Filter className="w-4 h-4" />
              Filters
            </button>
            
            <div className="flex items-center gap-1">
              <button
                onClick={allGitSelected ? onSelectNone : onSelectAll}
                className="flex items-center gap-2 px-3 py-1 rounded border border-border hover:bg-accent"
              >
                {allGitSelected ? (
                  <CheckSquare className="w-4 h-4" />
                ) : someGitSelected ? (
                  <div className="w-4 h-4 border-2 border-primary bg-primary/20 rounded" />
                ) : (
                  <Square className="w-4 h-4" />
                )}
                {allGitSelected ? 'Deselect All' : 'Select All Git'}
              </button>
              
              {selectedRepos.size > 0 && (
                <span className="px-2 py-1 bg-primary text-primary-foreground text-sm rounded">
                  {selectedRepos.size} selected
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <input
            type="text"
            placeholder="Search repositories..."
            value={filters.searchTerm}
            onChange={(e) => onFiltersChange({ ...filters, searchTerm: e.target.value })}
            className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring focus:border-transparent"
          />
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="p-4 bg-muted rounded-lg space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Filter Options</h3>
              <button
                onClick={() => setShowFilters(false)}
                className="p-1 hover:bg-background rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={filters.showGitOnly}
                    onChange={(e) => onFiltersChange({ ...filters, showGitOnly: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm">Git repositories only</span>
                </label>
                
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={filters.showWithChanges}
                    onChange={(e) => onFiltersChange({ ...filters, showWithChanges: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm">Has uncommitted changes</span>
                </label>
                
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={filters.showWithoutRemotes}
                    onChange={(e) => onFiltersChange({ ...filters, showWithoutRemotes: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm">No remote repositories</span>
                </label>
              </div>
              
              <div className="space-y-2">
                <label className="block text-sm font-medium">Sort by</label>
                <select
                  value={filters.sortBy}
                  onChange={(e) => onFiltersChange({ ...filters, sortBy: e.target.value as any })}
                  className="w-full px-3 py-1 border border-border rounded bg-background"
                >
                  <option value="name">Name</option>
                  <option value="size">Size</option>
                  <option value="activity">Last Activity</option>
                  <option value="status">Status</option>
                </select>
              </div>
              
              <div className="space-y-2">
                <label className="block text-sm font-medium">Order</label>
                <select
                  value={filters.sortOrder}
                  onChange={(e) => onFiltersChange({ ...filters, sortOrder: e.target.value as any })}
                  className="w-full px-3 py-1 border border-border rounded bg-background"
                >
                  <option value="asc">Ascending</option>
                  <option value="desc">Descending</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Repository Grid */}
      <div className="flex-1 p-4 overflow-auto">
        {sortedRepos.length === 0 ? (
          <div className="text-center py-12">
            <Folder className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg font-medium mb-2">No repositories found</p>
            <p className="text-muted-foreground">
              {repositories.length === 0 
                ? "Select a directory to scan for repositories"
                : "Try adjusting your filters to see more results"
              }
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {sortedRepos.map((repo) => {
              const status = formatRepoStatus(repo.status);
              const isSelected = selectedRepos.has(repo.path);
              
              return (
                <div
                  key={repo.path}
                  className={`bg-card border rounded-lg p-4 cursor-pointer transition-all hover:shadow-md ${
                    isSelected ? 'border-primary shadow-sm' : 'border-border'
                  }`}
                  onClick={() => onRepoSelect(repo)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium truncate" title={repo.name}>
                        {repo.name}
                      </h3>
                      <p className="text-sm text-muted-foreground truncate" title={repo.path}>
                        {repo.path}
                      </p>
                    </div>
                    
                    {repo.is_git_repo && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRepoToggle(repo.path);
                        }}
                        className="ml-2 p-1 hover:bg-accent rounded"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-primary" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${status.className}`}>
                        {status.text}
                      </span>
                      {repo.is_git_repo && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <GitBranch className="w-3 h-3" />
                          {repo.current_branch || 'No branch'}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <HardDrive className="w-3 h-3" />
                        {formatBytes(repo.size_mb * 1024 * 1024)}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatRelativeTime(repo.last_activity)}
                      </div>
                    </div>

                    {repo.remotes.length > 0 && (
                      <div className="text-xs text-muted-foreground">
                        {repo.remotes.length} remote{repo.remotes.length !== 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}