// Cache service implementation - handles save/load operations and directory management
use super::models::*;
use crate::models::Repository;
use chrono::Utc;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

/// Cache service for managing repository data persistence
pub struct CacheService {
    app_handle: AppHandle,
    cache_dir: PathBuf,
}

impl CacheService {
    /// Create a new cache service
    pub fn new(app_handle: AppHandle) -> Result<Self, Box<dyn std::error::Error + Send + Sync>> {
        let cache_dir = Self::get_cache_directory(&app_handle)?;
        
        // Ensure cache directory exists
        if !cache_dir.exists() {
            fs::create_dir_all(&cache_dir)?;
            println!("Created cache directory: {}", cache_dir.display());
        }
        
        // Create subdirectories
        let history_dir = cache_dir.join("history");
        if !history_dir.exists() {
            fs::create_dir_all(&history_dir)?;
            println!("Created history directory: {}", history_dir.display());
        }
        
        Ok(Self {
            app_handle,
            cache_dir,
        })
    }
    
    /// Get the application cache directory
    fn get_cache_directory(app_handle: &AppHandle) -> Result<PathBuf, Box<dyn std::error::Error + Send + Sync>> {
        // Use Tauri's app data directory
        let app_data_dir = app_handle
            .path()
            .app_data_dir()
            .map_err(|e| format!("Failed to get app data directory: {}", e))?;
        
        Ok(app_data_dir.join("cache"))
    }
    
    /// Get the main cache file path
    fn get_cache_file_path(&self) -> PathBuf {
        self.cache_dir.join("repositories.json")
    }
    
    /// Get the preferences file path (handled by tauri-plugin-store)
    fn get_preferences_file_path(&self) -> PathBuf {
        self.cache_dir.join("preferences.json")
    }
    
    /// Load cached repository data
    pub async fn load_cache(&self) -> Result<Option<CacheData>, Box<dyn std::error::Error + Send + Sync>> {
        let cache_file = self.get_cache_file_path();
        
        if !cache_file.exists() {
            println!("No cache file found at: {}", cache_file.display());
            return Ok(None);
        }
        
        println!("Loading cache from: {}", cache_file.display());
        
        let content = fs::read_to_string(&cache_file)?;
        let cache_data: CacheData = serde_json::from_str(&content)?;
        
        // Verify cache version compatibility
        if cache_data.version != CACHE_VERSION {
            println!("Cache version mismatch. Expected: {}, Found: {}", 
                     CACHE_VERSION, cache_data.version);
            return Ok(None);
        }
        
        println!("Loaded cache with {} repositories", cache_data.repositories.len());
        Ok(Some(cache_data))
    }
    
    /// Save repository data to cache
    pub async fn save_cache(&self, cache_data: &CacheData) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let cache_file = self.get_cache_file_path();
        
        println!("Saving cache to: {}", cache_file.display());
        
        // Create a backup of existing cache if it exists
        if cache_file.exists() {
            let backup_path = self.create_historical_backup().await?;
            println!("Created backup at: {}", backup_path.display());
        }
        
        // Write new cache data
        let content = serde_json::to_string_pretty(cache_data)?;
        fs::write(&cache_file, content)?;
        
        println!("Saved cache with {} repositories", cache_data.repositories.len());
        
        // Cleanup old historical files
        self.cleanup_historical_files().await?;
        
        Ok(())
    }
    
    /// Create a new cache data structure from repositories
    pub fn create_cache_data(
        &self,
        repositories: Vec<Repository>,
        scanned_paths: Vec<PathBuf>,
        checksums: HashMap<String, String>,
    ) -> CacheData {
        let total_repos = repositories.len();
        let total_git_repos = repositories.iter().filter(|r| r.is_git_repo).count();
        let total_size_mb = repositories.iter().map(|r| r.size_mb).sum();
        
        let cached_repos = repositories
            .into_iter()
            .map(|repo| {
                let path = repo.path.clone();
                let git_head_sha = checksums.get(&path).cloned();
                let cached_repo = CachedRepository::new(repo, git_head_sha);
                (path, cached_repo)
            })
            .collect();
        
        CacheData {
            version: CACHE_VERSION.to_string(),
            last_scan: Utc::now(),
            scanned_paths,
            repositories: cached_repos,
            checksums,
            total_repos,
            total_git_repos,
            total_size_mb,
        }
    }
    
    /// Extract repositories from cache data
    pub fn extract_repositories(&self, cache_data: &CacheData) -> Vec<Repository> {
        cache_data
            .repositories
            .values()
            .map(|cached_repo| cached_repo.repository.clone())
            .collect()
    }
    
    /// Check which repositories need updating based on checksums
    pub fn find_stale_repositories(
        &self,
        cache_data: &CacheData,
        current_checksums: &HashMap<String, String>,
    ) -> Vec<String> {
        let mut stale_paths = Vec::new();
        
        // Check for changed repositories
        for (path, cached_repo) in &cache_data.repositories {
            if let Some(current_checksum) = current_checksums.get(path) {
                if let Some(cached_checksum) = &cached_repo.git_head_sha {
                    if cached_checksum != current_checksum {
                        stale_paths.push(path.clone());
                    }
                } else {
                    // No cached checksum, consider stale
                    stale_paths.push(path.clone());
                }
            } else {
                // Repository no longer exists
                stale_paths.push(path.clone());
            }
        }
        
        // Check for new repositories
        for path in current_checksums.keys() {
            if !cache_data.repositories.contains_key(path) {
                stale_paths.push(path.clone());
            }
        }
        
        stale_paths
    }
    
    /// Create a historical backup of the current cache
    async fn create_historical_backup(&self) -> Result<PathBuf, Box<dyn std::error::Error + Send + Sync>> {
        let cache_file = self.get_cache_file_path();
        let history_dir = self.cache_dir.join("history");
        
        let timestamp = Utc::now().format("%Y%m%d_%H%M%S");
        let backup_file = history_dir.join(format!("repositories_{}.json", timestamp));
        
        fs::copy(&cache_file, &backup_file)?;
        Ok(backup_file)
    }
    
    /// Clean up old historical backup files
    async fn cleanup_historical_files(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let history_dir = self.cache_dir.join("history");
        
        if !history_dir.exists() {
            return Ok(());
        }
        
        let mut files: Vec<_> = fs::read_dir(&history_dir)?
            .filter_map(|entry| entry.ok())
            .filter(|entry| {
                entry.path().extension()
                    .and_then(|ext| ext.to_str())
                    .map(|ext| ext == "json")
                    .unwrap_or(false)
            })
            .collect();
        
        // Sort by modification time (newest first)
        files.sort_by_key(|entry| {
            entry.metadata()
                .and_then(|meta| meta.modified())
                .unwrap_or(std::time::SystemTime::UNIX_EPOCH)
        });
        files.reverse();
        
        // Remove files beyond the limit
        let max_files = 10; // Keep 10 historical files
        if files.len() > max_files {
            for file in files.iter().skip(max_files) {
                if let Err(e) = fs::remove_file(file.path()) {
                    println!("Failed to remove old cache file {}: {}", 
                             file.path().display(), e);
                }
            }
        }
        
        Ok(())
    }
    
    /// Get cache statistics
    pub async fn get_cache_stats(&self) -> Result<CacheStats, Box<dyn std::error::Error + Send + Sync>> {
        let cache_file = self.get_cache_file_path();
        let history_dir = self.cache_dir.join("history");
        
        let cache_size = if cache_file.exists() {
            fs::metadata(&cache_file)?.len()
        } else {
            0
        };
        
        let history_count = if history_dir.exists() {
            fs::read_dir(&history_dir)?
                .filter_map(|entry| entry.ok())
                .count()
        } else {
            0
        };
        
        let total_cache_size = self.calculate_directory_size(&self.cache_dir)?;
        
        Ok(CacheStats {
            cache_file_size_bytes: cache_size,
            history_files_count: history_count,
            total_cache_size_bytes: total_cache_size,
            cache_directory: self.cache_dir.clone(),
        })
    }
    
    /// Calculate total size of cache directory
    fn calculate_directory_size(&self, dir: &Path) -> Result<u64, Box<dyn std::error::Error + Send + Sync>> {
        let mut total_size = 0;
        
        if dir.is_dir() {
            for entry in fs::read_dir(dir)? {
                let entry = entry?;
                let path = entry.path();
                
                if path.is_file() {
                    total_size += fs::metadata(&path)?.len();
                } else if path.is_dir() {
                    total_size += self.calculate_directory_size(&path)?;
                }
            }
        }
        
        Ok(total_size)
    }
}

/// Cache statistics for UI display
#[derive(Debug, Clone)]
pub struct CacheStats {
    pub cache_file_size_bytes: u64,
    pub history_files_count: usize,
    pub total_cache_size_bytes: u64,
    pub cache_directory: PathBuf,
}