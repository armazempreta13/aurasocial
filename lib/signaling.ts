// --- GLOBAL SIGNALING STORE ---
// In a dev environment, Next.js might reload this file. 
// We use a global variable to ensure the store persists across hot reloads.

type SignalingEvent = {
  type: string;
  payload: any;
  fromId: string;
};

class SignalingStore {
  private clients = new Map<string, (event: SignalingEvent) => void>();

  register(userId: string, onEvent: (event: SignalingEvent) => void) {
    this.clients.set(userId, onEvent);
    return () => this.clients.delete(userId);
  }

  send(toId: string, fromId: string, type: string, payload: any) {
    const onEvent = this.clients.get(toId);
    if (onEvent) {
      onEvent({ type, payload, fromId });
      return true;
    }
    return false;
  }
}

const globalStore = (globalThis as any)._signalingStore || new SignalingStore();
(globalThis as any)._signalingStore = globalStore;

export const signalingStore = globalStore;
