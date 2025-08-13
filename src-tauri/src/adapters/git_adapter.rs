// Git operations adapter - wraps git2/gix libraries
use crate::models::*;
use git2::{Repository as GitRepository, StatusOptions, BranchType, ErrorCode};
use std::path::Path;
use chrono::{DateTime, Utc};

pub struct GitAdapter;

impl GitAdapter {
    pub fn new() -> Self {
        Self
    }

    pub async fn get_status(&self, repo_path: &Path) -> Result<GitStatus, Box<dyn std::error::Error>> {
        let repo = GitRepository::open(repo_path)?;
        
        let mut opts = StatusOptions::new();
        opts.include_untracked(true);
        
        let statuses = repo.statuses(Some(&mut opts))?;
        
        let mut staged_files = Vec::new();
        let mut unstaged_files = Vec::new();
        let mut untracked_files = Vec::new();
        
        for status in statuses.iter() {
            let file_path = status.path().unwrap_or("").to_string();
            let status_flags = status.status();
            
            if status_flags.is_index_new() || 
               status_flags.is_index_modified() || 
               status_flags.is_index_deleted() ||
               status_flags.is_index_renamed() ||
               status_flags.is_index_typechange() {
                staged_files.push(file_path.clone());
            }
            
            if status_flags.is_wt_modified() ||
               status_flags.is_wt_deleted() ||
               status_flags.is_wt_renamed() ||
               status_flags.is_wt_typechange() {
                unstaged_files.push(file_path.clone());
            }
            
            if status_flags.is_wt_new() {
                untracked_files.push(file_path);
            }
        }
        
        let current_branch = match repo.head() {
            Ok(head) => head.shorthand().map(|s| s.to_string()),
            Err(_) => None,
        };
        
        let tracking_branch = if let (Ok(_head), Some(ref branch_name)) = (repo.head(), &current_branch) {
            if let Ok(branch) = repo.find_branch(branch_name, BranchType::Local) {
                if let Ok(upstream) = branch.upstream() {
                    upstream.name().ok().flatten().map(|s| s.to_string())
                } else {
                    None
                }
            } else {
                None
            }
        } else {
            None
        };
        
        let (ahead, behind) = (0, 0);
        let is_clean = staged_files.is_empty() && unstaged_files.is_empty() && untracked_files.is_empty();
        
        Ok(GitStatus {
            is_clean,
            staged_files,
            unstaged_files,
            untracked_files,
            ahead,
            behind,
            current_branch,
            tracking_branch,
        })
    }

    pub async fn get_remotes(&self, repo_path: &Path) -> Result<Vec<RemoteInfo>, Box<dyn std::error::Error>> {
        let repo = GitRepository::open(repo_path)?;
        let remotes = repo.remotes()?;
        let mut remote_info = Vec::new();
        
        for remote_name in remotes.iter() {
            if let Some(name) = remote_name {
                if let Ok(remote) = repo.find_remote(name) {
                    let info = RemoteInfo {
                        name: name.to_string(),
                        url: remote.url().unwrap_or("").to_string(),
                        fetch_url: remote.url().map(|s| s.to_string()),
                        push_url: remote.pushurl().map(|s| s.to_string()),
                    };
                    remote_info.push(info);
                }
            }
        }
        
        Ok(remote_info)
    }

    pub async fn get_branches(&self, repo_path: &Path) -> Result<Vec<BranchInfo>, Box<dyn std::error::Error>> {
        let repo = GitRepository::open(repo_path)?;
        let mut branches = Vec::new();
        
        let current_branch_name = match repo.head() {
            Ok(head) => head.shorthand().map(|s| s.to_string()),
            Err(_) => None,
        };
        
        // Local branches
        let local_branches = repo.branches(Some(BranchType::Local))?;
        for branch_result in local_branches {
            let (branch, _branch_type) = branch_result?;
            if let Ok(name) = branch.name() {
                if let Some(name_str) = name {
                    let is_current = current_branch_name.as_ref() == Some(&name_str.to_string());
                    
                    let upstream = if let Ok(upstream_branch) = branch.upstream() {
                        upstream_branch.name().ok().flatten().map(|s| s.to_string())
                    } else {
                        None
                    };
                    
                    let last_commit = if let Ok(commit) = branch.get().peel_to_commit() {
                        let time = commit.time();
                        DateTime::from_timestamp(time.seconds(), 0)
                    } else {
                        None
                    };
                    
                    branches.push(BranchInfo {
                        name: name_str.to_string(),
                        is_current,
                        is_remote: false,
                        upstream,
                        last_commit,
                        ahead: 0,
                        behind: 0,
                    });
                }
            }
        }
        
        // Remote branches
        let remote_branches = repo.branches(Some(BranchType::Remote))?;
        for branch_result in remote_branches {
            let (branch, _) = branch_result?;
            if let Ok(name) = branch.name() {
                if let Some(name_str) = name {
                    let last_commit = if let Ok(commit) = branch.get().peel_to_commit() {
                        let time = commit.time();
                        DateTime::from_timestamp(time.seconds(), 0)
                    } else {
                        None
                    };
                    
                    branches.push(BranchInfo {
                        name: name_str.to_string(),
                        is_current: false,
                        is_remote: true,
                        upstream: None,
                        last_commit,
                        ahead: 0,
                        behind: 0,
                    });
                }
            }
        }
        
        Ok(branches)
    }
    
    pub fn is_git_repository(&self, path: &Path) -> bool {
        GitRepository::open(path).is_ok()
    }
    
    pub fn get_current_branch(&self, repo: &GitRepository) -> Result<Option<String>, git2::Error> {
        match repo.head() {
            Ok(head) => {
                if let Some(name) = head.shorthand() {
                    Ok(Some(name.to_string()))
                } else {
                    Ok(None)
                }
            },
            Err(e) if e.code() == ErrorCode::UnbornBranch => Ok(None),
            Err(e) if e.code() == ErrorCode::NotFound => Ok(None),
            Err(e) => Err(e),
        }
    }
}