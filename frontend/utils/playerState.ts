// Simple event emitter for player fullscreen state
type Listener = (isActive: boolean) => void;

class PlayerStateManager {
  private listeners: Listener[] = [];
  private _isActive = false;

  get isActive() {
    return this._isActive;
  }

  setActive(active: boolean) {
    this._isActive = active;
    this.listeners.forEach(fn => fn(active));
  }

  subscribe(fn: Listener) {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter(l => l !== fn);
    };
  }
}

export const playerState = new PlayerStateManager();
