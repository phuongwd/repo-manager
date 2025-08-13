// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// Keep legacy modules for Git operations that haven't been moved yet
mod git_manager;

use git_manager::GitManager;
use repo_manager::*;
use std::path::PathBuf;

// Use new organized command handlers
// scan_repositories is now in commands/repository_commands.rs

#[tauri::command]
async fn get_repo_status(repo_path: String) -> Result<GitStatus, String> {
    let git_manager = GitManager::new();
    let path = PathBuf::from(repo_path);
    
    match git_manager.get_status(&path).await {
        Ok(status) => Ok(status),
        Err(e) => Err(format!("Failed to get repository status: {}", e))
    }
}

#[tauri::command]
async fn get_repo_remotes(repo_path: String) -> Result<Vec<RemoteInfo>, String> {
    let git_manager = GitManager::new();
    let path = PathBuf::from(repo_path);
    
    match git_manager.get_remotes(&path).await {
        Ok(remotes) => Ok(remotes),
        Err(e) => Err(format!("Failed to get repository remotes: {}", e))
    }
}

#[tauri::command]
async fn get_repo_branches(repo_path: String) -> Result<Vec<BranchInfo>, String> {
    let git_manager = GitManager::new();
    let path = PathBuf::from(repo_path);
    
    match git_manager.get_branches(&path).await {
        Ok(branches) => Ok(branches),
        Err(e) => Err(format!("Failed to get repository branches: {}", e))
    }
}

#[tauri::command]
async fn execute_git_command(repo_path: String, command: Vec<String>) -> Result<String, String> {
    let git_manager = GitManager::new();
    let path = PathBuf::from(repo_path);
    
    match git_manager.execute_command(&path, &command).await {
        Ok(output) => Ok(output),
        Err(e) => Err(format!("Failed to execute git command: {}", e))
    }
}

#[tauri::command]
async fn batch_git_operation(repos: Vec<String>, operation: BatchOperation) -> Result<BatchResult, String> {
    let git_manager = GitManager::new();
    let repo_paths: Vec<PathBuf> = repos.into_iter().map(PathBuf::from).collect();
    
    match git_manager.batch_operation(&repo_paths, &operation).await {
        Ok(result) => Ok(result),
        Err(e) => Err(format!("Failed to execute batch operation: {}", e))
    }
}

#[tauri::command]
async fn get_repo_activity(repo_path: String, days: Option<u32>) -> Result<RepoActivity, String> {
    let git_manager = GitManager::new();
    let path = PathBuf::from(repo_path);
    let days = days.unwrap_or(30);
    
    match git_manager.get_activity(&path, days).await {
        Ok(activity) => Ok(activity),
        Err(e) => Err(format!("Failed to get repository activity: {}", e))
    }
}

// get_directory_stats is now in commands/repository_commands.rs

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            // New organized commands
            scan_repositories,
            get_directory_stats,
            test_cache_service,
            load_cached_repositories,
            // Legacy Git commands (to be refactored)
            get_repo_status,
            get_repo_remotes,
            get_repo_branches,
            execute_git_command,
            batch_git_operation,
            get_repo_activity
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}