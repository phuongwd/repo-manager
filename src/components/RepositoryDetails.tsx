import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Repository, GitStatus, RemoteInfo, BranchInfo, RepoActivity } from "../types";
import { formatBytes, formatRelativeTime } from "../utils/formatters";
import { 
  X, 
  GitBranch, 
  Globe, 
  User, 
  FileText, 
  Activity,
  RefreshCw
} from "lucide-react";

interface RepositoryDetailsProps {
  repository: Repository;
  onClose: () => void;
}

export function RepositoryDetails({ repository, onClose }: RepositoryDetailsProps) {
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);
  const [remotes, setRemotes] = useState<RemoteInfo[]>([]);
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [activity, setActivity] = useState<RepoActivity | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'status' | 'remotes' | 'branches' | 'activity'>('status');

  useEffect(() => {
    if (repository.is_git_repo) {
      loadRepositoryDetails();
    }
  }, [repository.path]);

  const loadRepositoryDetails = async () => {
    setLoading(true);
    try {
      const [statusData, remotesData, branchesData, activityData] = await Promise.all([
        invoke<GitStatus>("get_repo_status", { repoPath: repository.path }).catch(() => null),
        invoke<RemoteInfo[]>("get_repo_remotes", { repoPath: repository.path }).catch(() => []),
        invoke<BranchInfo[]>("get_repo_branches", { repoPath: repository.path }).catch(() => []),
        invoke<RepoActivity>("get_repo_activity", { repoPath: repository.path, days: 30 }).catch(() => null)
      ]);

      setGitStatus(statusData);
      setRemotes(remotesData);
      setBranches(branchesData);
      setActivity(activityData);
    } catch (error) {
      console.error("Failed to load repository details:", error);
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'status' as const, label: 'Status', icon: FileText },
    { id: 'remotes' as const, label: 'Remotes', icon: Globe },
    { id: 'branches' as const, label: 'Branches', icon: GitBranch },
    { id: 'activity' as const, label: 'Activity', icon: Activity },
  ];

  return (
    <div className="h-full flex flex-col bg-card border-l border-border">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold truncate">{repository.name}</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-accent rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        
        <p className="text-sm text-muted-foreground truncate" title={repository.path}>
          {repository.path}
        </p>

        {repository.is_git_repo && (
          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-2">
              <GitBranch className="w-4 h-4" />
              <span className="text-sm">{repository.current_branch || 'No branch'}</span>
            </div>
            
            <button
              onClick={loadRepositoryDetails}
              disabled={loading}
              className="p-1 hover:bg-accent rounded disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        )}
      </div>

      {/* Basic Info */}
      <div className="p-4 border-b border-border space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Type</span>
          <span className="font-medium">
            {repository.is_git_repo ? 'Git Repository' : 'Directory'}
          </span>
        </div>
        
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Size</span>
          <span className="font-medium">{formatBytes(repository.size_mb * 1024 * 1024)}</span>
        </div>
        
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Last Activity</span>
          <span className="font-medium">{formatRelativeTime(repository.last_activity)}</span>
        </div>
        
        {repository.commit_count !== null && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Commits</span>
            <span className="font-medium">{repository.commit_count}</span>
          </div>
        )}
      </div>

      {repository.is_git_repo ? (
        <>
          {/* Tabs */}
          <div className="flex border-b border-border">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-3 py-2 text-sm border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-primary text-primary'
                      : 'border-transparent hover:text-foreground text-muted-foreground'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-auto">
            {loading && (
              <div className="p-4 text-center">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
              </div>
            )}

            {!loading && activeTab === 'status' && gitStatus && (
              <div className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Working Directory</span>
                  <span className={`px-2 py-1 rounded text-xs ${gitStatus.is_clean ? 'text-green-600 bg-green-100' : 'text-orange-600 bg-orange-100'}`}>
                    {gitStatus.is_clean ? 'Clean' : 'Has Changes'}
                  </span>
                </div>

                {gitStatus.staged_files.length > 0 && (
                  <div>
                    <h4 className="font-medium text-green-600 mb-2">Staged Files ({gitStatus.staged_files.length})</h4>
                    <div className="space-y-1 max-h-32 overflow-auto">
                      {gitStatus.staged_files.map((file, index) => (
                        <div key={index} className="text-sm text-muted-foreground font-mono bg-muted p-1 rounded">
                          {file}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {gitStatus.unstaged_files.length > 0 && (
                  <div>
                    <h4 className="font-medium text-orange-600 mb-2">Modified Files ({gitStatus.unstaged_files.length})</h4>
                    <div className="space-y-1 max-h-32 overflow-auto">
                      {gitStatus.unstaged_files.map((file, index) => (
                        <div key={index} className="text-sm text-muted-foreground font-mono bg-muted p-1 rounded">
                          {file}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {gitStatus.untracked_files.length > 0 && (
                  <div>
                    <h4 className="font-medium text-blue-600 mb-2">Untracked Files ({gitStatus.untracked_files.length})</h4>
                    <div className="space-y-1 max-h-32 overflow-auto">
                      {gitStatus.untracked_files.map((file, index) => (
                        <div key={index} className="text-sm text-muted-foreground font-mono bg-muted p-1 rounded">
                          {file}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {!loading && activeTab === 'remotes' && (
              <div className="p-4 space-y-3">
                {remotes.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No remotes configured</p>
                ) : (
                  remotes.map((remote, index) => (
                    <div key={index} className="border border-border rounded-lg p-3">
                      <div className="font-medium">{remote.name}</div>
                      <div className="text-sm text-muted-foreground font-mono break-all">
                        {remote.url}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {!loading && activeTab === 'branches' && (
              <div className="p-4 space-y-2">
                {branches.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No branches found</p>
                ) : (
                  branches.map((branch, index) => (
                    <div key={index} className={`flex items-center justify-between p-2 rounded ${branch.is_current ? 'bg-primary/10' : 'hover:bg-accent'}`}>
                      <div className="flex items-center gap-2">
                        <GitBranch className="w-4 h-4" />
                        <span className={`${branch.is_current ? 'font-medium' : ''}`}>
                          {branch.name}
                        </span>
                        {branch.is_current && (
                          <span className="px-2 py-1 bg-primary text-primary-foreground text-xs rounded">
                            Current
                          </span>
                        )}
                        {branch.is_remote && (
                          <span className="px-2 py-1 bg-muted text-xs rounded">
                            Remote
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatRelativeTime(branch.last_commit)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {!loading && activeTab === 'activity' && activity && (
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold">{activity.total_commits}</div>
                    <div className="text-sm text-muted-foreground">Total Commits</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">{activity.commits_last_month}</div>
                    <div className="text-sm text-muted-foreground">Last Month</div>
                  </div>
                </div>

                <div className="border-t border-border pt-4">
                  <h4 className="font-medium mb-2">Recent Contributors</h4>
                  {activity.authors_last_month.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No recent activity</p>
                  ) : (
                    <div className="space-y-1">
                      {activity.authors_last_month.map((author, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <User className="w-4 h-4" />
                          <span className="text-sm">{author}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="border-t border-border pt-4">
                  <h4 className="font-medium mb-2">Last Commit</h4>
                  <div className="text-sm text-muted-foreground">
                    {formatRelativeTime(activity.last_commit_date)}
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>This is not a Git repository</p>
          </div>
        </div>
      )}
    </div>
  );
}