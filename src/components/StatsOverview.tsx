import { DirectoryStats } from "../types";
import { formatBytes, formatRelativeTime, formatRepoStatus } from "../utils/formatters";
import { 
  GitBranch, 
  FolderGit, 
  AlertCircle, 
  HardDrive,
  ArrowRight,
  TrendingUp
} from "lucide-react";

interface StatsOverviewProps {
  stats: DirectoryStats;
  onNavigateToRepos: () => void;
}

export function StatsOverview({ stats, onNavigateToRepos }: StatsOverviewProps) {
  const cards = [
    {
      title: "Total Directories",
      value: stats.total_directories,
      icon: FolderGit,
      className: "text-blue-600 bg-blue-100",
    },
    {
      title: "Git Repositories",
      value: stats.git_repositories,
      icon: GitBranch,
      className: "text-green-600 bg-green-100",
    },
    {
      title: "Need Attention",
      value: stats.repositories_with_changes,
      icon: AlertCircle,
      className: "text-orange-600 bg-orange-100",
    },
    {
      title: "Total Size",
      value: formatBytes(stats.total_size_mb * 1024 * 1024),
      icon: HardDrive,
      className: "text-purple-600 bg-purple-100",
    },
  ];

  return (
    <div className="flex-1 p-6 overflow-auto">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Repository Overview</h1>
          <button
            onClick={onNavigateToRepos}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            View All Repositories
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.title} className="bg-card border border-border rounded-lg p-6">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${card.className}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{card.title}</p>
                    <p className="text-2xl font-bold">{card.value}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Repositories Needing Attention */}
        {stats.repos_needing_attention.length > 0 && (
          <div className="bg-card border border-border rounded-lg">
            <div className="p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-orange-600" />
                <h2 className="text-lg font-semibold">Repositories Needing Attention</h2>
              </div>
            </div>
            <div className="p-4 space-y-3">
              {stats.repos_needing_attention.slice(0, 10).map((repo) => {
                const status = formatRepoStatus(repo.status);
                return (
                  <div key={repo.path} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div className="flex-1">
                      <div className="font-medium">{repo.name}</div>
                      <div className="text-sm text-muted-foreground truncate" title={repo.path}>
                        {repo.path}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${status.className}`}>
                        {status.text}
                      </span>
                      <div className="text-sm text-muted-foreground">
                        {repo.remotes.length === 0 ? 'No remotes' : `${repo.remotes.length} remote(s)`}
                      </div>
                    </div>
                  </div>
                );
              })}
              {stats.repos_needing_attention.length > 10 && (
                <div className="text-center pt-2">
                  <button
                    onClick={onNavigateToRepos}
                    className="text-primary hover:text-primary/80 text-sm font-medium"
                  >
                    View all {stats.repos_needing_attention.length} repositories needing attention
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Two Column Layout for Lists */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Largest Repositories */}
          {stats.largest_repos.length > 0 && (
            <div className="bg-card border border-border rounded-lg">
              <div className="p-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <HardDrive className="w-5 h-5 text-purple-600" />
                  <h2 className="text-lg font-semibold">Largest Repositories</h2>
                </div>
              </div>
              <div className="p-4 space-y-3">
                {stats.largest_repos.slice(0, 8).map((repo) => (
                  <div key={repo.path} className="flex items-center justify-between py-1">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{repo.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {repo.current_branch || 'No branch'}
                      </div>
                    </div>
                    <div className="text-sm font-medium text-purple-600">
                      {formatBytes(repo.size_mb * 1024 * 1024)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Most Active Repositories */}
          {stats.most_active_repos.length > 0 && (
            <div className="bg-card border border-border rounded-lg">
              <div className="p-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                  <h2 className="text-lg font-semibold">Most Active Repositories</h2>
                </div>
              </div>
              <div className="p-4 space-y-3">
                {stats.most_active_repos.slice(0, 8).map((repo) => (
                  <div key={repo.path} className="flex items-center justify-between py-1">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{repo.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {repo.current_branch || 'No branch'}
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatRelativeTime(repo.last_activity)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}