// Adapters - wrappers around external libraries
pub mod git_adapter;
pub mod tokei_adapter;
pub mod filesystem_adapter;
pub mod ignore_adapter;

pub use git_adapter::*;
pub use tokei_adapter::*;
pub use filesystem_adapter::*;
pub use ignore_adapter::*;