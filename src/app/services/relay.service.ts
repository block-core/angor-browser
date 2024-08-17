import { Injectable } from '@angular/core';
import { SimplePool } from 'nostr-tools';
import WebSocket from '@blockcore/ws';

@Injectable({
  providedIn: 'root'
})
export class RelayService {
  private pool: SimplePool;
  public relays: { url: string, connected: boolean }[] = [];
  private isConnected: boolean = false;
  private retryInterval: number = 5000; // 5 seconds

  constructor() {
    this.pool = new SimplePool();
    this.relays = this.loadRelaysFromLocalStorage();
  }

  private loadRelaysFromLocalStorage(): { url: string, connected: boolean }[] {
    const defaultRelays = [
      { url: 'wss://relay.angor.io', connected: false },
      { url: 'wss://relay2.angor.io', connected: false }
    ];
    if (typeof localStorage !== 'undefined') {
      const storedRelays = JSON.parse(localStorage.getItem('nostrRelays') || '[]');
      return [...defaultRelays, ...storedRelays];
    }
    return defaultRelays;
  }

  public saveRelaysToLocalStorage(): void {
    if (typeof localStorage !== 'undefined') {
      const customRelays = this.relays.filter(relay => !['wss://relay.angor.io', 'wss://relay2.angor.io'].includes(relay.url));
      localStorage.setItem('nostrRelays', JSON.stringify(customRelays));
    }
  }

  private async connectToRelay(relay: { url: string, connected: boolean }): Promise<void> {
    try {
      const ws = new WebSocket(relay.url);
      ws.onopen = () => {
        relay.connected = true;
        console.log(`Connected to relay: ${relay.url}`);
        this.saveRelaysToLocalStorage();
      };
      ws.onerror = (error) => {
        relay.connected = false;
        console.error(`Failed to connect to relay: ${relay.url}`, error);
        this.retryConnection(relay);
      };
      ws.onclose = () => {
        relay.connected = false;
        console.log(`Disconnected from relay: ${relay.url}`);
        this.retryConnection(relay);
      };
    } catch (error) {
      relay.connected = false;
      console.error(`Error in connecting to relay: ${relay.url}`, error);
      this.retryConnection(relay);
    }
  }

  private retryConnection(relay: { url: string, connected: boolean }): void {
    setTimeout(() => this.connectToRelay(relay), this.retryInterval);
  }

  public async connectToRelays(): Promise<void> {
    if (this.isConnected) return;
    const connections = this.relays.map(relay => this.connectToRelay(relay));
    await Promise.all(connections);
    this.isConnected = true;
  }

  public getPool(): SimplePool {
    return this.pool;
  }

  public getConnectedRelays(): string[] {
    return this.relays.filter(relay => relay.connected).map(relay => relay.url);
  }

  public addRelay(url: string): void {
    if (!this.isRelayPresent(url)) {
      const newRelay = { url, connected: false };
      this.relays.push(newRelay);
      this.connectToRelay(newRelay);
    }
  }

  public isRelayPresent(url: string): boolean {
    return this.relays.some(relay => relay.url === url);
  }

  public async ensureConnectedRelays(): Promise<void> {
    await this.connectToRelays();
    return new Promise((resolve) => {
      const checkConnection = () => {
        if (this.getConnectedRelays().length > 0) {
          resolve();
        } else {
          setTimeout(checkConnection, 1000);
        }
      };
      checkConnection();
    });
  }

  public removeRelay(url: string): void {
    this.relays = this.relays.filter(relay => relay.url !== url);
    this.saveRelaysToLocalStorage();
  }

  public removeAllCustomRelays(): void {
    this.relays = this.relays.filter(relay => ['wss://relay.angor.io', 'wss://relay2.angor.io'].includes(relay.url));
    this.saveRelaysToLocalStorage();
  }
}
