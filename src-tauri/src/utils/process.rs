//! Process utilities
//!
//! Helper functions for spawning processes with proper Windows flags.

use std::process::Stdio;

/// Creates a Command with CREATE_NO_WINDOW flag on Windows
/// to prevent console windows from appearing.
#[cfg(windows)]
pub fn create_hidden_command(program: &str) -> std::process::Command {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;
    
    let mut cmd = std::process::Command::new(program);
    cmd.creation_flags(CREATE_NO_WINDOW);
    cmd
}

#[cfg(not(windows))]
pub fn create_hidden_command(program: &str) -> std::process::Command {
    std::process::Command::new(program)
}

/// Creates a tokio Command with CREATE_NO_WINDOW flag on Windows
#[cfg(windows)]
pub fn create_hidden_async_command(program: &str) -> tokio::process::Command {
    #[allow(unused_imports)]
    use std::os::windows::process::CommandExt as _;
    const CREATE_NO_WINDOW: u32 = 0x08000000;
    
    let mut cmd = tokio::process::Command::new(program);
    cmd.creation_flags(CREATE_NO_WINDOW);
    cmd
}

#[cfg(not(windows))]
pub fn create_hidden_async_command(program: &str) -> tokio::process::Command {
    tokio::process::Command::new(program)
}

/// Extension trait for adding common process options
pub trait CommandExt {
    /// Configures the command for piped output
    fn with_piped_output(&mut self) -> &mut Self;
}

impl CommandExt for std::process::Command {
    fn with_piped_output(&mut self) -> &mut Self {
        self.stdout(Stdio::piped()).stderr(Stdio::piped())
    }
}

impl CommandExt for tokio::process::Command {
    fn with_piped_output(&mut self) -> &mut Self {
        self.stdout(Stdio::piped()).stderr(Stdio::piped())
    }
}
