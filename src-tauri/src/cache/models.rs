// Cache data models and serialization structures
use crate::models::Repository;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;

/// Version of the cache format for backwards compatibility
pub const CACHE_VERSION: &str = "1.0.0";

/// Main cache data structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheData {
    /// Cache format version
    pub version: String,
    
    /// When this cache was last updated
    pub last_scan: DateTime<Utc>,
    
    /// List of directory paths that were scanned
    pub scanned_paths: Vec<PathBuf>,
    
    /// Cached repository data (path -> repository)
    pub repositories: HashMap<String, CachedRepository>,
    
    /// Git HEAD checksums for change detection (path -> git_head_sha)
    pub checksums: HashMap<String, String>,
    
    /// Total statistics
    pub total_repos: usize,
    pub total_git_repos: usize,
    pub total_size_mb: f64,
}

/// Cached repository information with metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CachedRepository {
    /// The actual repository data
    pub repository: Repository,
    
    /// When this repo was last analyzed
    pub cached_at: DateTime<Utc>,
    
    /// Git HEAD SHA at time of caching (if Git repo)
    pub git_head_sha: Option<String>,
    
    /// Directory last modified time for non-Git repos
    pub last_modified: Option<DateTime<Utc>>,
    
    /// Whether this cache entry is considered stale
    pub is_stale: bool,
}

/// User preferences and settings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserPreferences {
    /// Recently scanned directory paths
    pub recent_paths: Vec<PathBuf>,
    
    /// Last successful scan timestamp
    pub last_scan_time: Option<DateTime<Utc>>,
    
    /// User UI preferences
    pub ui_preferences: UIPreferences,
    
    /// Cache settings
    pub cache_settings: CacheSettings,
}

/// UI-related user preferences
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UIPreferences {
    /// Last active view
    pub last_view: String,
    
    /// Window size and position
    pub window_state: Option<WindowState>,
    
    /// Filter preferences
    pub default_filters: FilterPreferences,
}

/// Window state for persistence
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowState {
    pub width: f64,
    pub height: f64,
    pub x: Option<f64>,
    pub y: Option<f64>,
}

/// Filter preferences
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FilterPreferences {
    pub show_git_only: bool,
    pub show_with_changes: bool,
    pub show_without_remotes: bool,
    pub default_sort_by: String,
    pub default_sort_order: String,
}

/// Cache-related settings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheSettings {
    /// Maximum age before cache entry is considered stale (hours)
    pub max_cache_age_hours: u32,
    
    /// Maximum number of historical cache files to keep
    pub max_history_files: u32,
    
    /// Whether to enable automatic cache cleanup
    pub auto_cleanup_enabled: bool,
    
    /// Maximum cache directory size in MB
    pub max_cache_size_mb: u32,
}

impl Default for UserPreferences {
    fn default() -> Self {
        Self {
            recent_paths: Vec::new(),
            last_scan_time: None,
            ui_preferences: UIPreferences::default(),
            cache_settings: CacheSettings::default(),
        }
    }
}

impl Default for UIPreferences {
    fn default() -> Self {
        Self {
            last_view: "overview".to_string(),
            window_state: None,
            default_filters: FilterPreferences::default(),
        }
    }
}

impl Default for FilterPreferences {
    fn default() -> Self {
        Self {
            show_git_only: false,
            show_with_changes: false,
            show_without_remotes: false,
            default_sort_by: "name".to_string(),
            default_sort_order: "asc".to_string(),
        }
    }
}

impl Default for CacheSettings {
    fn default() -> Self {
        Self {
            max_cache_age_hours: 24,  // 24 hours
            max_history_files: 10,    // Keep 10 historical snapshots
            auto_cleanup_enabled: true,
            max_cache_size_mb: 100,   // 100MB max cache size
        }
    }
}

impl Default for CacheData {
    fn default() -> Self {
        Self {
            version: CACHE_VERSION.to_string(),
            last_scan: Utc::now(),
            scanned_paths: Vec::new(),
            repositories: HashMap::new(),
            checksums: HashMap::new(),
            total_repos: 0,
            total_git_repos: 0,
            total_size_mb: 0.0,
        }
    }
}

impl CachedRepository {
    /// Create a new cached repository entry
    pub fn new(repository: Repository, git_head_sha: Option<String>) -> Self {
        Self {
            repository,
            cached_at: Utc::now(),
            git_head_sha,
            last_modified: None,
            is_stale: false,
        }
    }
    
    /// Check if this cache entry should be considered stale
    pub fn is_stale(&self, max_age_hours: u32) -> bool {
        let age = Utc::now().signed_duration_since(self.cached_at);
        age.num_hours() > max_age_hours as i64
    }
}