//! Command handlers for Tauri IPC
//!
//! This module exports all Tauri commands for frontend invocation.

pub mod debug;
pub mod download;
pub mod executables;
pub mod folder;
pub mod media_info;
pub mod preferences;
pub mod queue;
pub mod update;

pub use debug::*;
pub use download::*;
pub use executables::*;
pub use folder::*;
pub use media_info::*;
pub use preferences::*;
pub use queue::*;
pub use update::*;
