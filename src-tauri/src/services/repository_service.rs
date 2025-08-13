// Repository service - orchestrates adapters to scan and analyze repositories
use crate::models::*;
use crate::adapters::*;
use std::path::Path;

pub struct RepositoryService {
    git_adapter: GitAdapter,
    tokei_adapter: TokeiAdapter,
    filesystem_adapter: FilesystemAdapter,
    ignore_adapter: IgnoreAdapter,
}

impl RepositoryService {
    pub fn new() -> Self {
        Self {
            git_adapter: GitAdapter::new(),
            tokei_adapter: TokeiAdapter::new(),
            filesystem_adapter: FilesystemAdapter::new(),
            ignore_adapter: IgnoreAdapter::new(),
        }
    }

    pub async fn scan_directory(&self, base_path: &Path) -> Result<Vec<Repository>, Box<dyn std::error::Error + Send + Sync>> {
        self.scan_directory_with_progress(base_path, |_, _, _| {}).await
    }

    pub async fn scan_directory_with_progress<F>(&self, base_path: &Path, mut progress_callback: F) -> Result<Vec<Repository>, Box<dyn std::error::Error + Send + Sync>>
    where
        F: FnMut(&str, usize, usize),  // Changed to include total count
    {
        let mut repositories = Vec::new();
        
        // Special case: if the base path itself is a Git repository, only analyze that
        println!("Checking if base path is Git repository: {}", base_path.display());
        if self.git_adapter.is_git_repository(base_path) {
            println!("Base path IS a Git repository, analyzing single directory");
            progress_callback(&base_path.display().to_string(), 1, 1);
            println!("About to analyze directory: {}", base_path.display());
            let repo = self.analyze_directory(base_path).await;
            println!("Directory analysis completed");
            repositories.push(repo);
            return Ok(repositories);
        }
        println!("Base path is NOT a Git repository, scanning subdirectories");
        
        // First pass: count total directories to scan
        println!("Counting directories to scan...");
        let walker = self.ignore_adapter.create_walker(base_path, Some(3));
        let mut dirs_to_scan = Vec::new();
        
        for result in walker {
            if let Ok(entry) = result {
                let path = entry.path();
                
                // Only process directories
                if !self.filesystem_adapter.is_directory(path) {
                    continue;
                }
                
                // Skip if this is a subdirectory of a Git repo we're processing
                if path != base_path && self.is_inside_git_repo(path, base_path) {
                    continue;
                }
                
                // Apply directory filtering
                if self.ignore_adapter.should_skip_directory(path) {
                    continue;
                }
                
                dirs_to_scan.push(path.to_path_buf());
            }
        }
        
        let total_count = dirs_to_scan.len();
        println!("Found {} directories to scan", total_count);
        
        // Second pass: actually scan directories with progress
        let mut scanned_count = 0;
        
        for dir_path in dirs_to_scan {
            scanned_count += 1;
            progress_callback(&dir_path.display().to_string(), scanned_count, total_count);
            
            let repo = self.analyze_directory(&dir_path).await;
            
            // Only include directories that look like projects (after analyzing)
            if !repo.is_git_repo && repo.code_lines < 10 && !self.filesystem_adapter.has_project_indicators(&dir_path) {
                continue;
            }
            
            repositories.push(repo);
        }

        // Sort by name for consistent ordering
        repositories.sort_by(|a, b| a.name.cmp(&b.name));
        
        Ok(repositories)
    }

    pub async fn get_directory_stats(&self, base_path: &Path) -> Result<DirectoryStats, Box<dyn std::error::Error + Send + Sync>> {
        let repos = self.scan_directory(base_path).await.map_err(|e| -> Box<dyn std::error::Error + Send + Sync> { e })?;
        
        let total_directories = repos.len() as u32;
        let git_repositories = repos.iter().filter(|r| r.is_git_repo).count() as u32;
        let non_git_directories = total_directories - git_repositories;
        let repositories_with_changes = repos.iter()
            .filter(|r| r.has_uncommitted_changes)
            .count() as u32;
        let repositories_with_remotes = repos.iter()
            .filter(|r| !r.remotes.is_empty())
            .count() as u32;
        
        let total_size_mb = repos.iter().map(|r| r.size_mb).sum();
        
        // Get largest repos (top 10)
        let mut largest_repos = repos.clone();
        largest_repos.sort_by(|a, b| b.size_mb.partial_cmp(&a.size_mb).unwrap_or(std::cmp::Ordering::Equal));
        largest_repos.truncate(10);
        
        // Get most active repos (by last activity)
        let mut most_active_repos = repos.clone();
        most_active_repos.sort_by(|a, b| {
            b.last_activity.unwrap_or_default()
                .cmp(&a.last_activity.unwrap_or_default())
        });
        most_active_repos.truncate(10);
        
        // Repos needing attention (have uncommitted changes or no remotes)
        let repos_needing_attention = repos.into_iter()
            .filter(|r| r.is_git_repo && (r.has_uncommitted_changes || r.remotes.is_empty()))
            .take(20)
            .collect();

        Ok(DirectoryStats {
            total_directories,
            git_repositories,
            non_git_directories,
            repositories_with_changes,
            repositories_with_remotes,
            total_size_mb,
            largest_repos,
            most_active_repos,
            repos_needing_attention,
        })
    }

    async fn analyze_directory(&self, dir_path: &Path) -> Repository {
        println!("ANALYZE: Starting analysis of {}", dir_path.display());
        
        let name = dir_path.file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown")
            .to_string();

        let path = dir_path.to_string_lossy().to_string();
        
        println!("ANALYZE: Calculating directory size...");
        let size_mb = self.filesystem_adapter.calculate_directory_size(dir_path).unwrap_or(0.0);
        println!("ANALYZE: Size calculated: {} MB", size_mb);

        // Skip tokei for large directories or non-git directories with many subdirs
        let (primary_language, total_lines, code_lines) = if size_mb > 10.0 && !self.git_adapter.is_git_repository(dir_path) {
            println!("ANALYZE: Skipping tokei for large non-git directory");
            (Some("Mixed".to_string()), 0, 0)
        } else {
            println!("ANALYZE: Starting tokei language analysis...");
            let result = self.tokei_adapter.analyze_languages(dir_path);
            println!("ANALYZE: Tokei completed. Primary language: {:?}, Lines: {}", result.0, result.1);
            result
        };

        // Check if it's a git repository using git adapter
        println!("ANALYZE: Checking if Git repository...");
        if self.git_adapter.is_git_repository(dir_path) {
            println!("ANALYZE: IS Git repository, getting Git info...");
            // Get Git status and information
            let git_status = self.git_adapter.get_status(dir_path).await.ok();
            let remotes = self.git_adapter.get_remotes(dir_path).await
                .unwrap_or_else(|_| vec![])
                .into_iter()
                .map(|r| format!("{}: {}", r.name, r.url))
                .collect();

            let has_uncommitted_changes = git_status.as_ref()
                .map(|s| !s.is_clean)
                .unwrap_or(false);

            let current_branch = git_status.as_ref()
                .and_then(|s| s.current_branch.clone());

            let last_activity = self.filesystem_adapter.get_last_activity(dir_path).unwrap_or(None);

            // Determine status from git status
            let status = if has_uncommitted_changes {
                if git_status.as_ref().map(|s| !s.unstaged_files.is_empty() || !s.staged_files.is_empty()).unwrap_or(false) {
                    RepoStatus::Dirty
                } else {
                    RepoStatus::Untracked
                }
            } else {
                RepoStatus::Clean
            };

            Repository {
                name,
                path,
                is_git_repo: true,
                has_uncommitted_changes,
                current_branch,
                remotes,
                last_commit_date: None, // TODO: implement in git_adapter
                last_activity,
                status,
                size_mb,
                commit_count: None, // TODO: implement in git_adapter  
                primary_language,
                total_lines,
                code_lines,
            }
        } else {
            // Not a git repository
            let last_activity = self.filesystem_adapter.get_last_activity(dir_path).unwrap_or(None);

            Repository {
                name,
                path,
                is_git_repo: false,
                has_uncommitted_changes: false,
                current_branch: None,
                remotes: vec![],
                last_commit_date: None,
                last_activity,
                status: RepoStatus::NoGit,
                size_mb,
                commit_count: None,
                primary_language,
                total_lines,
                code_lines,
            }
        }
    }

    fn is_inside_git_repo(&self, path: &Path, base_path: &Path) -> bool {
        let mut current = path.parent();
        
        while let Some(parent) = current {
            // Stop if we've reached the base path
            if parent == base_path {
                break;
            }
            
            // Check if this parent is a Git repository
            if self.git_adapter.is_git_repository(parent) {
                return true;
            }
            
            current = parent.parent();
        }
        
        false
    }

}