'use client';

type OfflineAction = {
  id: string;
  type: 'like' | 'comment' | 'post';
  payload: any;
  timestamp: number;
};

class ActionQueue {
  private queue: OfflineAction[] = [];
  private key = 'aura_offline_queue';

  constructor() {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(this.key);
      if (saved) this.queue = JSON.parse(saved);
      
      window.addEventListener('online', () => this.processQueue());
    }
  }

  add(type: OfflineAction['type'], payload: any) {
    const action: OfflineAction = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      payload,
      timestamp: Date.now()
    };
    this.queue.push(action);
    this.save();
    
    if (navigator.onLine) {
      this.processQueue();
    }
  }

  private save() {
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.key, JSON.stringify(this.queue));
    }
  }

  private async processQueue() {
    if (this.queue.length === 0) return;

    console.log(`[Aura Resilience] Processing ${this.queue.length} offline actions...`);
    
    // We process items one by one to ensure integrity
    const items = [...this.queue];
    this.queue = [];
    this.save();

    for (const item of items) {
      try {
        // Here we would call the respective API
        // For now, we signal to the components via BroadcastChannel
        const syncChannel = new BroadcastChannel('aura_feed_sync');
        syncChannel.postMessage({ type: 'process_offline', payload: item });
        syncChannel.close();
      } catch (e) {
        console.error('Failed to process offline action', e);
        this.queue.push(item);
        this.save();
      }
    }
  }
}

export const offlineManager = new ActionQueue();
