//! Download Queue System
//!
//! Manages multiple downloads with configurable concurrency limit.

use std::collections::VecDeque;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use tokio::sync::{mpsc, RwLock, Semaphore};

use crate::models::{DownloadConfig, DownloadError, ProgressEvent};

/// Unique identifier for queue items
pub type QueueItemId = u64;

/// Status of a queue item
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "lowercase")]
pub enum QueueItemStatus {
    /// Waiting in queue
    Pending,
    /// Currently downloading
    Downloading,
    /// Merging video/audio
    Merging,
    /// Completed successfully
    Completed,
    /// Failed with error
    Failed,
    /// Cancelled by user
    Cancelled,
}

/// A single item in the download queue
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QueueItem {
    /// Unique identifier
    pub id: QueueItemId,
    /// Download configuration
    pub config: DownloadConfig,
    /// Current status
    pub status: QueueItemStatus,
    /// Progress (0-100)
    pub progress: f64,
    /// Download speed string
    pub speed: String,
    /// ETA in seconds
    pub eta_seconds: Option<u64>,
    /// Error message if failed
    pub error: Option<String>,
    /// Output file path if completed
    pub file_path: Option<String>,
    /// Media title (fetched from URL)
    pub title: Option<String>,
    /// Thumbnail URL
    pub thumbnail: Option<String>,
}

impl QueueItem {
    pub fn new(id: QueueItemId, config: DownloadConfig) -> Self {
        Self {
            id,
            config,
            status: QueueItemStatus::Pending,
            progress: 0.0,
            speed: String::new(),
            eta_seconds: None,
            error: None,
            file_path: None,
            title: None,
            thumbnail: None,
        }
    }
}

/// Events emitted by the queue
#[derive(Debug, Clone, serde::Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum QueueEvent {
    /// Item added to queue
    ItemAdded { item: QueueItem },
    /// Item status changed
    ItemUpdated { item: QueueItem },
    /// Item removed from queue
    ItemRemoved { id: QueueItemId },
    /// Queue cleared
    QueueCleared,
}

/// Download queue manager
pub struct DownloadQueue {
    /// All queue items (pending + active + completed)
    items: RwLock<Vec<QueueItem>>,
    /// Pending item IDs in order
    pending: RwLock<VecDeque<QueueItemId>>,
    /// Currently active downloads
    active: RwLock<Vec<QueueItemId>>,
    /// Maximum concurrent downloads
    #[allow(dead_code)]
    max_concurrent: usize,
    /// Semaphore for concurrency control
    semaphore: Arc<Semaphore>,
    /// ID counter
    next_id: AtomicU64,
    /// Event sender
    event_tx: mpsc::UnboundedSender<QueueEvent>,
}

impl DownloadQueue {
    /// Creates a new download queue with the specified concurrency limit
    pub fn new(max_concurrent: usize, event_tx: mpsc::UnboundedSender<QueueEvent>) -> Self {
        Self {
            items: RwLock::new(Vec::new()),
            pending: RwLock::new(VecDeque::new()),
            active: RwLock::new(Vec::new()),
            max_concurrent,
            semaphore: Arc::new(Semaphore::new(max_concurrent)),
            next_id: AtomicU64::new(1),
            event_tx,
        }
    }

    /// Adds a new item to the queue
    pub async fn add(&self, config: DownloadConfig) -> QueueItem {
        let id = self.next_id.fetch_add(1, Ordering::SeqCst);
        let item = QueueItem::new(id, config);

        {
            let mut items = self.items.write().await;
            items.push(item.clone());
        }

        {
            let mut pending = self.pending.write().await;
            pending.push_back(id);
        }

        let _ = self.event_tx.send(QueueEvent::ItemAdded { item: item.clone() });

        item
    }

    /// Gets all queue items
    pub async fn get_all(&self) -> Vec<QueueItem> {
        self.items.read().await.clone()
    }

    /// Gets a specific item by ID
    pub async fn get(&self, id: QueueItemId) -> Option<QueueItem> {
        let items = self.items.read().await;
        items.iter().find(|i| i.id == id).cloned()
    }

    /// Updates an item's status
    pub async fn update_status(&self, id: QueueItemId, status: QueueItemStatus) {
        let mut items = self.items.write().await;
        if let Some(item) = items.iter_mut().find(|i| i.id == id) {
            item.status = status;
            let _ = self.event_tx.send(QueueEvent::ItemUpdated { item: item.clone() });
        }
    }

    /// Updates an item's progress
    pub async fn update_progress(&self, id: QueueItemId, event: &ProgressEvent) {
        let mut items = self.items.write().await;
        if let Some(item) = items.iter_mut().find(|i| i.id == id) {
            item.progress = event.percentage;
            item.speed = event.speed.clone();
            item.eta_seconds = event.eta_seconds;
            if event.status == "merging" {
                item.status = QueueItemStatus::Merging;
            }
            let _ = self.event_tx.send(QueueEvent::ItemUpdated { item: item.clone() });
        }
    }

    /// Marks an item as completed
    pub async fn complete(&self, id: QueueItemId, file_path: String) {
        {
            let mut active = self.active.write().await;
            active.retain(|&i| i != id);
        }

        let mut items = self.items.write().await;
        if let Some(item) = items.iter_mut().find(|i| i.id == id) {
            item.status = QueueItemStatus::Completed;
            item.progress = 100.0;
            item.file_path = Some(file_path);
            item.speed = String::new();
            item.eta_seconds = None;
            let _ = self.event_tx.send(QueueEvent::ItemUpdated { item: item.clone() });
        }
    }

    /// Marks an item as failed
    pub async fn fail(&self, id: QueueItemId, error: DownloadError) {
        {
            let mut active = self.active.write().await;
            active.retain(|&i| i != id);
        }

        let mut items = self.items.write().await;
        if let Some(item) = items.iter_mut().find(|i| i.id == id) {
            item.status = QueueItemStatus::Failed;
            item.error = Some(error.to_string());
            item.speed = String::new();
            item.eta_seconds = None;
            let _ = self.event_tx.send(QueueEvent::ItemUpdated { item: item.clone() });
        }
    }

    /// Cancels a specific item
    pub async fn cancel(&self, id: QueueItemId) -> Result<(), DownloadError> {
        // Remove from pending if it's there
        {
            let mut pending = self.pending.write().await;
            pending.retain(|&i| i != id);
        }

        // Update status
        let mut items = self.items.write().await;
        if let Some(item) = items.iter_mut().find(|i| i.id == id) {
            if item.status == QueueItemStatus::Pending {
                item.status = QueueItemStatus::Cancelled;
                let _ = self.event_tx.send(QueueEvent::ItemUpdated { item: item.clone() });
                return Ok(());
            }
            // If downloading, the process will be killed separately
            item.status = QueueItemStatus::Cancelled;
            let _ = self.event_tx.send(QueueEvent::ItemUpdated { item: item.clone() });
        }

        Ok(())
    }

    /// Removes a completed/failed/cancelled item from the queue
    pub async fn remove(&self, id: QueueItemId) -> Result<(), DownloadError> {
        let mut items = self.items.write().await;
        if let Some(pos) = items.iter().position(|i| i.id == id) {
            let item = &items[pos];
            // Can only remove terminal items
            if matches!(
                item.status,
                QueueItemStatus::Completed | QueueItemStatus::Failed | QueueItemStatus::Cancelled
            ) {
                items.remove(pos);
                let _ = self.event_tx.send(QueueEvent::ItemRemoved { id });
                return Ok(());
            }
        }
        Err(DownloadError::GenericError("Cannot remove active item".to_string()))
    }

    /// Clears all completed/failed/cancelled items
    pub async fn clear_completed(&self) {
        let mut items = self.items.write().await;
        items.retain(|i| {
            !matches!(
                i.status,
                QueueItemStatus::Completed | QueueItemStatus::Failed | QueueItemStatus::Cancelled
            )
        });
        let _ = self.event_tx.send(QueueEvent::QueueCleared);
    }

    /// Gets the next pending item and marks it as active
    pub async fn pop_next(&self) -> Option<QueueItem> {
        let id = {
            let mut pending = self.pending.write().await;
            pending.pop_front()?
        };

        {
            let mut active = self.active.write().await;
            active.push(id);
        }

        let mut items = self.items.write().await;
        if let Some(item) = items.iter_mut().find(|i| i.id == id) {
            item.status = QueueItemStatus::Downloading;
            let _ = self.event_tx.send(QueueEvent::ItemUpdated { item: item.clone() });
            return Some(item.clone());
        }

        None
    }

    /// Gets the semaphore for concurrency control
    pub fn semaphore(&self) -> Arc<Semaphore> {
        self.semaphore.clone()
    }

    /// Gets the number of active downloads
    pub async fn active_count(&self) -> usize {
        self.active.read().await.len()
    }

    /// Gets the number of pending downloads
    pub async fn pending_count(&self) -> usize {
        self.pending.read().await.len()
    }

    /// Checks if there are pending items
    pub async fn has_pending(&self) -> bool {
        !self.pending.read().await.is_empty()
    }

    /// Sets media info for an item
    pub async fn set_media_info(&self, id: QueueItemId, title: String, thumbnail: Option<String>) {
        let mut items = self.items.write().await;
        if let Some(item) = items.iter_mut().find(|i| i.id == id) {
            item.title = Some(title);
            item.thumbnail = thumbnail;
            let _ = self.event_tx.send(QueueEvent::ItemUpdated { item: item.clone() });
        }
    }

    /// Moves an item up in the pending queue
    pub async fn move_up(&self, id: QueueItemId) {
        let mut pending = self.pending.write().await;
        if let Some(pos) = pending.iter().position(|&i| i == id) {
            if pos > 0 {
                pending.swap(pos, pos - 1);
            }
        }
    }

    /// Moves an item down in the pending queue
    pub async fn move_down(&self, id: QueueItemId) {
        let mut pending = self.pending.write().await;
        if let Some(pos) = pending.iter().position(|&i| i == id) {
            if pos < pending.len() - 1 {
                pending.swap(pos, pos + 1);
            }
        }
    }

    /// Reorders items in the pending queue
    pub async fn reorder(&self, ids: Vec<QueueItemId>) {
        let mut pending = self.pending.write().await;
        // Keep only IDs that are actually in pending
        let valid_ids: Vec<QueueItemId> = ids
            .into_iter()
            .filter(|id| pending.contains(id))
            .collect();
        
        // Get remaining IDs not in the new order
        let remaining: Vec<QueueItemId> = pending
            .iter()
            .filter(|id| !valid_ids.contains(id))
            .copied()
            .collect();
        
        // Rebuild pending queue
        pending.clear();
        for id in valid_ids {
            pending.push_back(id);
        }
        for id in remaining {
            pending.push_back(id);
        }
    }

    /// Pauses all pending downloads (moves them to a paused state)
    pub async fn pause_all(&self) {
        // For now, we just clear the pending queue
        // Items stay in the list but won't be processed
        let mut pending = self.pending.write().await;
        let ids: Vec<QueueItemId> = pending.drain(..).collect();
        
        let mut items = self.items.write().await;
        for id in ids {
            if let Some(item) = items.iter_mut().find(|i| i.id == id) {
                // Keep as pending but won't be picked up
                let _ = self.event_tx.send(QueueEvent::ItemUpdated { item: item.clone() });
            }
        }
    }

    /// Resumes all paused downloads
    pub async fn resume_all(&self) {
        let items = self.items.read().await;
        let mut pending = self.pending.write().await;
        
        for item in items.iter() {
            if item.status == QueueItemStatus::Pending && !pending.contains(&item.id) {
                pending.push_back(item.id);
            }
        }
    }
}

/// Thread-safe wrapper for the download queue
pub type SharedDownloadQueue = Arc<DownloadQueue>;

/// Creates a new shared download queue
pub fn create_download_queue(
    max_concurrent: usize,
    event_tx: mpsc::UnboundedSender<QueueEvent>,
) -> SharedDownloadQueue {
    Arc::new(DownloadQueue::new(max_concurrent, event_tx))
}
