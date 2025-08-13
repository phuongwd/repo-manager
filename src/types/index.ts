export interface Repository {
  name: string;
  path: string;
  is_git_repo: boolean;
  has_uncommitted_changes: boolean;
  current_branch: string | null;
  remotes: string[];
  last_commit_date: string | null;
  last_activity: string | null;
  status: RepoStatus;
  size_mb: number;
  commit_count: number | null;
  primary_language: string | null;
  total_lines: number;
  code_lines: number;
}

export type RepoStatus = 
  | "Clean" 
  | "Dirty" 
  | "Untracked" 
  | "NoGit" 
  | { Error: string };

export interface GitStatus {
  is_clean: boolean;
  staged_files: string[];
  unstaged_files: string[];
  untracked_files: string[];
  ahead: number;
  behind: number;
  current_branch: string | null;
  tracking_branch: string | null;
}

export interface RemoteInfo {
  name: string;
  url: string;
  fetch_url: string | null;
  push_url: string | null;
}

export interface BranchInfo {
  name: string;
  is_current: boolean;
  is_remote: boolean;
  upstream: string | null;
  last_commit: string | null;
  ahead: number;
  behind: number;
}

export interface RepoActivity {
  total_commits: number;
  commits_last_week: number;
  commits_last_month: number;
  last_commit_date: string | null;
  authors_last_month: string[];
  files_changed_last_month: number;
  lines_added_last_month: number;
  lines_deleted_last_month: number;
}

export interface BatchOperation {
  operation_type: BatchOperationType;
  parameters: Record<string, any>;
}

export type BatchOperationType = 
  | "Pull" 
  | "Push" 
  | "Status" 
  | "Fetch" 
  | "Commit" 
  | "Custom";

export interface BatchResult {
  total_repos: number;
  successful: number;
  failed: number;
  results: BatchOperationResult[];
}

export interface BatchOperationResult {
  repo_path: string;
  success: boolean;
  output: string;
  error: string | null;
}

export interface DirectoryStats {
  total_directories: number;
  git_repositories: number;
  non_git_directories: number;
  repositories_with_changes: number;
  repositories_with_remotes: number;
  total_size_mb: number;
  largest_repos: Repository[];
  most_active_repos: Repository[];
  repos_needing_attention: Repository[];
}

export interface FilterOptions {
  showGitOnly: boolean;
  showWithChanges: boolean;
  showWithoutRemotes: boolean;
  searchTerm: string;
  sortBy: 'name' | 'size' | 'activity' | 'status';
  sortOrder: 'asc' | 'desc';
}

export interface ScanProgress {
  current_directory: string;
  processed: number;
  total: number | null;
  percentage: number | null;
}