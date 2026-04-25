'use client';

type EventCallback = (payload: any) => void;

class EventBus {
  private listeners: Record<string, Set<EventCallback>> = {};
  private channel: BroadcastChannel | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.channel = new BroadcastChannel('aura_events');
      this.channel.onmessage = (event) => {
        const { type, payload } = event.data;
        this.emitLocal(type, payload);
      };
    }
  }

  subscribe(event: string, callback: EventCallback) {
    if (!this.listeners[event]) {
      this.listeners[event] = new Set();
    }
    this.listeners[event].add(callback);

    return () => {
      this.listeners[event].delete(callback);
    };
  }

  private emitLocal(event: string, payload: any) {
    if (this.listeners[event]) {
      this.listeners[event].forEach((cb) => cb(payload));
    }
  }

  emit(event: string, payload: any, crossTab = true) {
    this.emitLocal(event, payload);
    if (crossTab && this.channel) {
      this.channel.postMessage({ type: event, payload });
    }
  }
}

export const eventBus = new EventBus();
