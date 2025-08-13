// Filesystem operations adapter
use std::path::Path;
use std::fs;
use walkdir::WalkDir;
use chrono::{DateTime, Utc};
use humansize::{format_size, DECIMAL};

pub struct FilesystemAdapter;

impl FilesystemAdapter {
    pub fn new() -> Self {
        Self
    }

    /// Calculate directory size efficiently using humansize formatting
    pub fn calculate_directory_size(&self, dir_path: &Path) -> Result<f64, Box<dyn std::error::Error>> {
        let mut total_size = 0u64;

        for entry in WalkDir::new(dir_path)
            .max_depth(2) // Limit depth to avoid performance issues
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_type().is_file())
        {
            if let Ok(metadata) = entry.metadata() {
                total_size += metadata.len();
            }
        }

        Ok(total_size as f64 / 1_048_576.0) // Convert to MB
    }

    /// Format size using humansize library
    pub fn format_size(&self, size_bytes: u64) -> String {
        format_size(size_bytes, DECIMAL)
    }

    /// Get last activity time for a directory
    pub fn get_last_activity(&self, dir_path: &Path) -> Result<Option<DateTime<Utc>>, Box<dyn std::error::Error>> {
        if let Ok(metadata) = fs::metadata(dir_path) {
            if let Ok(modified) = metadata.modified() {
                let datetime = DateTime::<Utc>::from(modified);
                return Ok(Some(datetime));
            }
        }
        Ok(None)
    }

    /// Check if path exists and is a directory
    pub fn is_directory(&self, path: &Path) -> bool {
        path.is_dir()
    }

    /// Check if a file exists in the directory
    pub fn file_exists(&self, dir_path: &Path, filename: &str) -> bool {
        dir_path.join(filename).exists()
    }

    /// Check for multiple project indicator files
    pub fn has_project_indicators(&self, dir_path: &Path) -> bool {
        let project_files = [
            "package.json", "Cargo.toml", "pyproject.toml", "pom.xml", 
            "go.mod", "Makefile", "Dockerfile", "README.md"
        ];
        
        project_files.iter().any(|&file| self.file_exists(dir_path, file))
    }
}