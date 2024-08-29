import { Injectable } from '@angular/core';
import { Filter, NostrEvent, SimplePool } from 'nostr-tools';
import { Observable, Subject } from 'rxjs';
import WebSocket from '@blockcore/ws';

@Injectable({
  providedIn: 'root',
})
export class RelayService {
  private pool: SimplePool;
  private relays: { url: string, connected: boolean, retries: number, retryTimeout: any }[] = [];
  private maxRetries = 5; // Maximum number of reconnection attempts
  private initialRetryInterval = 5000; // Initial retry interval in milliseconds
  private retryMultiplier = 2; // Multiplier for exponential backoff
  private eventSubject = new Subject<any>(); // Subject to emit WebSocket events

  constructor() {
    this.pool = new SimplePool();
    this.relays = this.loadRelaysFromLocalStorage();
    this.connectToRelays();
  }

  private loadRelaysFromLocalStorage() {
    const defaultRelays = [
      { url: 'wss://relay.angor.io', connected: false, retries: 0, retryTimeout: null },
      { url: 'wss://relay2.angor.io', connected: false, retries: 0, retryTimeout: null },
    ];

    const storedRelays = JSON.parse(localStorage.getItem('nostrRelays') || '[]').map((relay: any) => ({
      ...relay,
      connected: false,
      retries: 0,
      retryTimeout: null,
    }));
    return [...defaultRelays, ...storedRelays];
  }

  private connectToRelay(relay: { url: string, connected: boolean, retries: number, retryTimeout: any }) {
    const ws = new WebSocket(relay.url);

    ws.onopen = () => {
      relay.connected = true;
      relay.retries = 0;
      clearTimeout(relay.retryTimeout);
      console.log(`Connected to relay: ${relay.url}`);
      this.saveRelaysToLocalStorage();
    };

    ws.onerror = (error) => {
      console.error(`Failed to connect to relay: ${relay.url}`, error);
      this.handleRelayError(relay);
    };

    ws.onclose = () => {
      relay.connected = false;
      console.log(`Disconnected from relay: ${relay.url}`);
      this.handleRelayError(relay);
    };

    ws.onmessage = (message) => {
      try {
        const dataStr = typeof message.data === 'string' ? message.data : message.data.toString('utf-8');
        const parsedData = JSON.parse(dataStr);
        this.eventSubject.next(parsedData);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
  }

  private handleRelayError(relay: { url: string, connected: boolean, retries: number, retryTimeout: any }) {
    if (relay.retries < this.maxRetries) {
      const retryInterval = this.initialRetryInterval * Math.pow(this.retryMultiplier, relay.retries);
      relay.retries++;
      relay.retryTimeout = setTimeout(() => this.connectToRelay(relay), retryInterval);
      console.log(`Retrying connection to relay: ${relay.url} (Attempt ${relay.retries})`);
    } else {
      console.error(`Max retries reached for relay: ${relay.url}. Giving up.`);
    }
  }

  public connectToRelays() {
    this.relays.forEach((relay) => this.connectToRelay(relay));
  }

  public async ensureConnectedRelays(): Promise<void> {
    this.connectToRelays();

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

  public getPool(): SimplePool {
    return this.pool;
  }

  public getConnectedRelays(): string[] {
    return this.relays.filter((relay) => relay.connected).map((relay) => relay.url);
  }

  public saveRelaysToLocalStorage(): void {
    const customRelays = this.relays.filter(
      (relay) => !['wss://relay.angor.io', 'wss://relay2.angor.io'].includes(relay.url)
    );
    localStorage.setItem('nostrRelays', JSON.stringify(customRelays));
  }

  public removeRelay(url: string): void {
    this.relays = this.relays.filter(relay => relay.url !== url);
    this.saveRelaysToLocalStorage();
  }

  public removeAllCustomRelays(): void {
    const defaultRelays = ['wss://relay.angor.io', 'wss://relay2.angor.io'];
    this.relays = this.relays.filter(relay => defaultRelays.includes(relay.url));
    this.saveRelaysToLocalStorage();
  }

  public getEventStream(): Observable<NostrEvent> {
    return this.eventSubject.asObservable();
  }

  public subscribeToFilter(filter: Filter): void {
    const connectedRelays = this.getConnectedRelays();
    this.pool.subscribeMany(connectedRelays, [filter], {
      onevent: (event: NostrEvent) => {
        this.eventSubject.next(event);
      },
    });
  }

  public getRelays(): { url: string, connected: boolean }[] {
    return this.relays;
  }

  public addRelay(url: string): void {
    if (!this.relays.some(relay => relay.url === url)) {
      const newRelay = { url, connected: false, retries: 0, retryTimeout: null };
      this.relays.push(newRelay);
      this.connectToRelay(newRelay);
      this.saveRelaysToLocalStorage();
    }
  }
}
