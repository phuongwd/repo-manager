// Gitignore and file filtering adapter
use ignore::WalkBuilder;
use std::path::Path;

pub struct IgnoreAdapter;

impl IgnoreAdapter {
    pub fn new() -> Self {
        Self
    }

    /// Create a gitignore-aware walker
    pub fn create_walker(&self, base_path: &Path, max_depth: Option<usize>) -> ignore::Walk {
        WalkBuilder::new(base_path)
            .max_depth(max_depth)
            .hidden(false) // We'll handle hidden files ourselves
            .git_ignore(true) // Respect .gitignore files
            .git_global(true) // Respect global .gitignore
            .git_exclude(true) // Respect .git/info/exclude
            .build()
    }

    /// Check if directory should be skipped based on name patterns
    pub fn should_skip_directory(&self, dir_path: &Path) -> bool {
        let dir_name = dir_path.file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("");

        // Skip hidden directories
        if dir_name.starts_with('.') {
            return true;
        }

        // Skip npm scoped packages (directories starting with @)
        if dir_name.starts_with('@') {
            return true;
        }

        // Skip common build/dependency directories that are never projects
        let skip_dirs = [
            // Package managers & dependencies
            "node_modules", "vendor", "target", "dist", "build", "out",
            // Source subdirectories (not root projects)
            "src", "lib", "libs", "components", "utils", "helpers",
            // Test directories
            "tests", "test", "__tests__", "spec", "specs",
            // Cache/temp
            "cache", ".cache", "tmp", "temp", "logs",
            // OS specific
            "System Volume Information", "$RECYCLE.BIN", "Thumbs.db", 
            ".Trash", ".DS_Store",
        ];

        // Case-insensitive matching
        let dir_name_lower = dir_name.to_lowercase();
        skip_dirs.iter().any(|&skip| dir_name_lower == skip.to_lowercase())
    }
}