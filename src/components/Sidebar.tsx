import { 
  BarChart3, 
  GitBranch, 
  RefreshCw, 
  FolderOpen,
  Database
} from "lucide-react";
import { DirectoryStats } from "../types";
import { formatBytes } from "../utils/formatters";

interface SidebarProps {
  activeView: 'overview' | 'repositories' | 'batch';
  onViewChange: (view: 'overview' | 'repositories' | 'batch') => void;
  stats: DirectoryStats | null;
  currentPath: string;
  scannedPaths?: Set<string>;
  onSelectDirectory: (addMode?: boolean) => void;
  onRefresh: () => void;
  loading: boolean;
}

export function Sidebar({ 
  activeView, 
  onViewChange, 
  stats, 
  currentPath: _, 
  scannedPaths = new Set(),
  onSelectDirectory, 
  onRefresh, 
  loading
}: SidebarProps) {
  const navItems = [
    { id: 'overview' as const, label: 'Overview', icon: BarChart3 },
    { id: 'repositories' as const, label: 'Repositories', icon: GitBranch },
    { id: 'batch' as const, label: 'Batch Operations', icon: Database },
  ];

  return (
    <div className="w-64 bg-card border-r border-border flex flex-col">
      <div className="p-4 border-b border-border">
        <h1 className="text-lg font-semibold">Repository Manager</h1>
      </div>
      
      <div className="p-4 border-b border-border">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Scan Directories</span>
            <button
              onClick={onRefresh}
              disabled={loading || !stats}
              className="p-1 hover:bg-accent rounded disabled:opacity-50"
              title="Refresh All"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => onSelectDirectory(false)}
              className="flex-1 flex items-center justify-center gap-1 p-2 text-xs hover:bg-accent rounded border border-border"
              title="Replace all current repositories"
            >
              <FolderOpen className="w-3 h-3" />
              Replace All
            </button>
            <button
              onClick={() => onSelectDirectory(true)}
              disabled={!stats}
              className="flex-1 flex items-center justify-center gap-1 p-2 text-xs hover:bg-accent rounded border border-border disabled:opacity-50"
              title="Add to existing repositories"
            >
              <FolderOpen className="w-3 h-3" />
              Add More
            </button>
          </div>
          
          {scannedPaths.size > 0 && (
            <div className="text-xs text-muted-foreground">
              <div className="font-medium mb-1">Scanned paths ({scannedPaths.size}):</div>
              {Array.from(scannedPaths).map(path => (
                <div key={path} className="truncate pl-2" title={path}>
                  • {path.split('/').pop() || path}
                </div>
              ))}
            </div>
          )}
          
        </div>
      </div>

      <nav className="flex-1 p-4">
        <div className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => onViewChange(item.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded text-sm transition-colors ${
                  activeView === item.id
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-accent hover:text-accent-foreground'
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </button>
            );
          })}
        </div>
      </nav>

      {stats && (
        <div className="p-4 border-t border-border">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Directories</span>
              <span className="font-medium">{stats.total_directories}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Git Repositories</span>
              <span className="font-medium">{stats.git_repositories}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">With Changes</span>
              <span className="font-medium text-orange-600">{stats.repositories_with_changes}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Size</span>
              <span className="font-medium">{formatBytes(stats.total_size_mb * 1024 * 1024)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}