//! Download management module
//!
//! This module handles yt-dlp process execution, progress parsing,
//! and download job management.

pub mod args;
pub mod manager;
pub mod parser;
pub mod process;
pub mod queue;

#[cfg(test)]
mod tests;

pub use args::*;
pub use manager::*;
pub use parser::*;
pub use process::*;
pub use queue::*;
