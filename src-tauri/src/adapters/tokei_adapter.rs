// Tokei integration adapter - language detection and code analysis
use tokei::{Languages, Config, LanguageType};
use std::path::Path;

pub struct TokeiAdapter;

impl TokeiAdapter {
    pub fn new() -> Self {
        Self
    }

    /// Analyze languages in a directory with size limits
    pub fn analyze_languages(&self, dir_path: &Path) -> (Option<String>, usize, usize) {
        // First, do a quick check for project files
        let has_package_json = dir_path.join("package.json").exists();
        let has_cargo_toml = dir_path.join("Cargo.toml").exists();
        let has_pyproject = dir_path.join("pyproject.toml").exists();
        let has_go_mod = dir_path.join("go.mod").exists();
        let has_gemfile = dir_path.join("Gemfile").exists();
        let has_pom_xml = dir_path.join("pom.xml").exists();
        
        // Quick language detection based on project files
        if has_package_json {
            return (Some("JavaScript".to_string()), 0, 0);
        } else if has_cargo_toml {
            return (Some("Rust".to_string()), 0, 0);
        } else if has_pyproject {
            return (Some("Python".to_string()), 0, 0);
        } else if has_go_mod {
            return (Some("Go".to_string()), 0, 0);
        } else if has_gemfile {
            return (Some("Ruby".to_string()), 0, 0);
        } else if has_pom_xml {
            return (Some("Java".to_string()), 0, 0);
        }
        
        // Skip tokei analysis for directories > 5MB
        if let Ok(size) = self.estimate_directory_size(dir_path) {
            if size > 5_000_000 {
                println!("TOKEI: Skipping analysis for large directory ({}MB)", size / 1_000_000);
                return (Some("Mixed".to_string()), 0, 0);
            }
        }
        
        // Also skip if directory has many subdirectories (likely a container)
        if let Ok(entries) = std::fs::read_dir(dir_path) {
            let subdir_count = entries.filter_map(|e| e.ok())
                .filter(|e| e.path().is_dir())
                .take(10)
                .count();
            if subdir_count >= 8 {
                println!("TOKEI: Skipping analysis - too many subdirectories");
                return (Some("Mixed".to_string()), 0, 0);
            }
        }
        
        // For smaller directories, do a limited tokei scan
        let mut languages = Languages::new();
        let config = Config::default();
        
        // Use exclusion list for common large directories
        let exclude_patterns: Vec<&str> = vec![
            "**/node_modules/**",
            "**/.git/**",
            "**/target/**",
            "**/dist/**",
            "**/build/**",
            "**/.next/**",
            "**/vendor/**",
            "**/venv/**",
            "**/.venv/**",
            "**/env/**",
            "**/__pycache__/**",
            "**/coverage/**",
            "**/.cache/**",
            "**/tmp/**",
            "**/*.min.js",
            "**/*.min.css"
        ];
        
        println!("TOKEI: Quick scan of {} with exclusions", dir_path.display());
        
        // Analyze with exclusions
        languages.get_statistics(&[dir_path], &exclude_patterns, &config);
        
        // Find the language with the most code lines
        let primary_language = languages
            .iter()
            .max_by_key(|(_, lang)| lang.code)
            .map(|(lang_type, _)| self.format_language_name(lang_type));
        
        // Calculate totals with reasonable limits
        let total_lines: usize = languages.iter().map(|(_, lang)| lang.lines().min(100_000)).sum();
        let code_lines: usize = languages.iter().map(|(_, lang)| lang.code.min(100_000)).sum();
        
        (primary_language, total_lines, code_lines)
    }
    
    /// Quick size estimation to avoid analyzing huge directories
    fn estimate_directory_size(&self, dir_path: &Path) -> std::io::Result<u64> {
        let mut total_size = 0u64;
        let mut entries_checked = 0;
        
        for entry in std::fs::read_dir(dir_path)? {
            if entries_checked > 100 {
                // Extrapolate from sample
                break;
            }
            
            if let Ok(entry) = entry {
                if let Ok(metadata) = entry.metadata() {
                    total_size += metadata.len();
                    entries_checked += 1;
                }
            }
        }
        
        Ok(total_size)
    }

    /// Check if directory looks like a project (has code files)
    pub fn looks_like_project(&self, dir_path: &Path, min_lines: usize) -> bool {
        let mut languages = Languages::new();
        let config = Config::default();
        
        // Skip common large directories for project detection
        let exclude_patterns: Vec<&str> = vec![
            "**/node_modules/**",
            "**/.git/**",
            "**/target/**",
            "**/dist/**",
            "**/build/**"
        ];
        languages.get_statistics(&[dir_path], &exclude_patterns, &config);
        
        // If tokei detected any code files, it's likely a project
        let total_lines: usize = languages.iter().map(|(_, lang)| lang.code).sum();
        total_lines >= min_lines
    }

    /// Get detailed language breakdown
    pub fn get_language_breakdown(&self, dir_path: &Path) -> Vec<(String, usize, usize, usize)> {
        let mut languages = Languages::new();
        let config = Config::default();
        
        // Exclude common large directories from breakdown
        let exclude_patterns: Vec<&str> = vec![
            "**/node_modules/**",
            "**/.git/**",
            "**/target/**",
            "**/dist/**",
            "**/build/**"
        ];
        languages.get_statistics(&[dir_path], &exclude_patterns, &config);
        
        languages
            .iter()
            .map(|(lang_type, lang)| {
                (
                    self.format_language_name(lang_type),
                    lang.lines(),
                    lang.code,
                    lang.comments,
                )
            })
            .collect()
    }

    /// Convert LanguageType to human-readable string
    fn format_language_name(&self, lang_type: &LanguageType) -> String {
        match lang_type {
            LanguageType::Rust => "Rust".to_string(),
            LanguageType::JavaScript => "JavaScript".to_string(),
            LanguageType::TypeScript => "TypeScript".to_string(),
            LanguageType::Python => "Python".to_string(),
            LanguageType::Go => "Go".to_string(),
            LanguageType::Java => "Java".to_string(),
            LanguageType::C => "C".to_string(),
            LanguageType::Cpp => "C++".to_string(),
            LanguageType::CSharp => "C#".to_string(),
            LanguageType::Html => "HTML".to_string(),
            LanguageType::Css => "CSS".to_string(),
            LanguageType::Sh => "Shell".to_string(),
            LanguageType::Bash => "Bash".to_string(),
            LanguageType::Json => "JSON".to_string(),
            LanguageType::Yaml => "YAML".to_string(),
            LanguageType::Toml => "TOML".to_string(),
            LanguageType::Markdown => "Markdown".to_string(),
            _ => format!("{:?}", lang_type),
        }
    }
}