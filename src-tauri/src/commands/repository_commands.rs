// Tauri command handlers for repository operations
use crate::models::*;
use crate::services::RepositoryService;
use crate::cache::CacheService;
use std::path::Path;
use std::sync::Arc;
use tokio::sync::Mutex;
use tauri::{AppHandle, Emitter};

// Static service instance for Tauri commands
static REPO_SERVICE: once_cell::sync::Lazy<Arc<Mutex<RepositoryService>>> = 
    once_cell::sync::Lazy::new(|| Arc::new(Mutex::new(RepositoryService::new())));

#[tauri::command]
pub async fn scan_repositories(app: AppHandle, directory_path: String, add_mode: Option<bool>) -> Result<Vec<Repository>, String> {
    println!("Starting scan of: {}", directory_path);
    let path = Path::new(&directory_path);
    let service = REPO_SERVICE.lock().await;
    
    println!("Got service lock, starting scan...");
    
    // Create a progress callback that emits events
    let app_handle_progress = app.clone();
    let result = service.scan_directory_with_progress(path, |current_dir, count, total| {
        println!("Progress: Scanning {} ({}/{})", current_dir, count, total);
        let _ = app_handle_progress.emit("scan-progress", serde_json::json!({
            "current_directory": current_dir,
            "scanned_count": count,
            "total_count": total
        }));
    }).await;
    
    match &result {
        Ok(repos) => {
            println!("Scan completed successfully! Found {} repositories", repos.len());
            let is_add_mode = add_mode.unwrap_or(false);
            
            // Save to cache (merge with existing if ADD mode)
            println!("💾 Saving scan results to cache (ADD mode: {})...", is_add_mode);
            match CacheService::new(app.clone()) {
                Ok(cache_service) => {
                    let mut final_repos = repos.clone();
                    let mut all_scanned_paths = vec![path.to_path_buf()];
                    let checksums = std::collections::HashMap::new(); // TODO: implement Git HEAD SHA collection
                    
                    // If ADD mode, merge with existing cache
                    if is_add_mode {
                        if let Ok(Some(existing_cache)) = cache_service.load_cache().await {
                            println!("🔄 Merging with existing cache ({} repos)...", existing_cache.repositories.len());
                            let existing_repos = cache_service.extract_repositories(&existing_cache);
                            
                            // Merge scanned paths
                            all_scanned_paths.extend(existing_cache.scanned_paths);
                            
                            // Merge repositories, avoiding duplicates by path
                            let mut existing_paths: std::collections::HashSet<String> = existing_repos.iter().map(|r| r.path.clone()).collect();
                            let mut merged_repos = existing_repos;
                            
                            for new_repo in repos {
                                if !existing_paths.contains(&new_repo.path) {
                                    existing_paths.insert(new_repo.path.clone());
                                    merged_repos.push(new_repo.clone());
                                } else {
                                    println!("   Skipping duplicate repository: {}", new_repo.path);
                                }
                            }
                            
                            final_repos = merged_repos;
                            println!("✅ Merged result: {} repositories total", final_repos.len());
                        }
                    }
                    
                    let cache_data = cache_service.create_cache_data(
                        final_repos.clone(),
                        all_scanned_paths,
                        checksums,
                    );
                    
                    match cache_service.save_cache(&cache_data).await {
                        Ok(_) => {
                            if is_add_mode {
                                println!("✅ Cache merged and saved with {} repositories", final_repos.len());
                            } else {
                                println!("✅ Cache replaced and saved with {} repositories", final_repos.len());
                            }
                        },
                        Err(e) => println!("⚠️  Failed to save cache: {}", e),
                    }
                },
                Err(e) => println!("⚠️  Failed to create cache service: {}", e),
            }
        },
        Err(e) => println!("Scan failed with error: {}", e),
    }
    
    result.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_directory_stats(directory_path: String) -> Result<DirectoryStats, String> {
    let path = Path::new(&directory_path);
    let service = REPO_SERVICE.lock().await;
    
    service.get_directory_stats(path)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn test_cache_service(app: AppHandle) -> Result<String, String> {
    println!("🧪 Testing cache service...");
    
    match CacheService::new(app) {
        Ok(cache_service) => {
            println!("✅ Cache service created successfully");
            
            // Test 1: Get cache stats
            match cache_service.get_cache_stats().await {
                Ok(stats) => {
                    println!("✅ Cache stats - Directory: {}, Main file: {} bytes, History files: {}", 
                             stats.cache_directory.display(), stats.cache_file_size_bytes, stats.history_files_count);
                },
                Err(e) => {
                    println!("❌ Failed to get cache stats: {}", e);
                    return Err(format!("Cache stats failed: {}", e));
                }
            }
            
            // Test 2: Try to load existing cache
            match cache_service.load_cache().await {
                Ok(Some(cache_data)) => {
                    println!("✅ Found existing cache with {} repositories, last scan: {}", 
                             cache_data.repositories.len(), cache_data.last_scan);
                    
                    // Test 3: Verify we can extract repositories
                    let repos = cache_service.extract_repositories(&cache_data);
                    println!("✅ Extracted {} repositories from cache", repos.len());
                    
                    // Show some sample repository data
                    for (i, repo) in repos.iter().take(3).enumerate() {
                        println!("   {}. {} ({}MB, Git: {})", 
                                 i + 1, repo.name, repo.size_mb, repo.is_git_repo);
                    }
                    
                    Ok(format!("Cache working! Found {} repos, last scan: {}, total size: {}MB", 
                              cache_data.repositories.len(), 
                              cache_data.last_scan.format("%Y-%m-%d %H:%M:%S"),
                              cache_data.total_size_mb))
                },
                Ok(None) => {
                    println!("ℹ️  No existing cache found");
                    
                    // Test 4: Create a test cache entry
                    let test_cache = cache_service.create_cache_data(
                        vec![], // Empty repositories for test
                        vec![], // Empty paths
                        std::collections::HashMap::new(), // Empty checksums
                    );
                    
                    match cache_service.save_cache(&test_cache).await {
                        Ok(_) => {
                            println!("✅ Test cache saved successfully");
                            Ok("Cache service working! Created new cache file".to_string())
                        },
                        Err(e) => {
                            println!("❌ Failed to save test cache: {}", e);
                            Err(format!("Save test failed: {}", e))
                        }
                    }
                },
                Err(e) => {
                    println!("❌ Failed to load cache: {}", e);
                    Err(format!("Cache load failed: {}", e))
                }
            }
        },
        Err(e) => {
            println!("❌ Failed to create cache service: {}", e);
            Err(format!("Cache service creation failed: {}", e))
        }
    }
}

#[tauri::command]
pub async fn load_cached_repositories(app: AppHandle) -> Result<Option<Vec<Repository>>, String> {
    println!("🔄 Loading cached repositories...");
    
    match CacheService::new(app) {
        Ok(cache_service) => {
            match cache_service.load_cache().await {
                Ok(Some(cache_data)) => {
                    let repos = cache_service.extract_repositories(&cache_data);
                    println!("✅ Loaded {} repositories from cache (last scan: {})", 
                             repos.len(), cache_data.last_scan.format("%Y-%m-%d %H:%M:%S"));
                    Ok(Some(repos))
                },
                Ok(None) => {
                    println!("ℹ️  No cached data found");
                    Ok(None)
                },
                Err(e) => {
                    println!("❌ Failed to load cache: {}", e);
                    Err(format!("Failed to load cache: {}", e))
                }
            }
        },
        Err(e) => {
            println!("❌ Failed to create cache service: {}", e);
            Err(format!("Cache service creation failed: {}", e))
        }
    }
}