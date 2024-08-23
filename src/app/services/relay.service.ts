import { Injectable } from '@angular/core';
import { Filter, NostrEvent, SimplePool } from 'nostr-tools';
import { Observable, Subject } from 'rxjs';
import WebSocket from '@blockcore/ws';

@Injectable({
  providedIn: 'root',
})
export class RelayService {
  private pool: SimplePool;
  private relays: { url: string, connected: boolean }[] = [];
  private retryInterval = 5000; // Retry interval for reconnecting to relays
  private eventSubject = new Subject<any>(); // Subject to emit WebSocket events

  constructor() {
    this.pool = new SimplePool();
    this.relays = this.loadRelaysFromLocalStorage();
    this.connectToRelays();
  }

  private loadRelaysFromLocalStorage() {
    const defaultRelays = [
      { url: 'wss://relay.angor.io', connected: false },
      { url: 'wss://relay2.angor.io', connected: false },
    ];

    const storedRelays = JSON.parse(localStorage.getItem('nostrRelays') || '[]');
    return [...defaultRelays, ...storedRelays];
  }

  private connectToRelay(relay: { url: string, connected: boolean }) {
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

    ws.onmessage = (message) => {
      try {
        // Convert Buffer to string if necessary
        const dataStr = typeof message.data === 'string' ? message.data : message.data.toString('utf-8');
        const parsedData = JSON.parse(dataStr);
        this.eventSubject.next(parsedData);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
  }

  private retryConnection(relay: { url: string, connected: boolean }) {
    setTimeout(() => this.connectToRelay(relay), this.retryInterval);
  }

  public connectToRelays() {
    this.relays.forEach((relay) => this.connectToRelay(relay));
  }

  public async ensureConnectedRelays(): Promise<void> {
    // Attempt to connect to all relays
    this.connectToRelays();

    // Return a promise that resolves once at least one relay is connected
    return new Promise((resolve) => {
      const checkConnection = () => {
        if (this.getConnectedRelays().length > 0) {
          resolve(); // Resolve when at least one relay is connected
        } else {
          setTimeout(checkConnection, 1000); // Check again after 1 second
        }
      };
      checkConnection(); // Initial check
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
    // Filter out the relay with the given URL
    this.relays = this.relays.filter(relay => relay.url !== url);

    // Save the updated list of relays to local storage
    this.saveRelaysToLocalStorage();

    // Optionally, you could disconnect from the relay here if needed
  }

  public removeAllCustomRelays(): void {
    // Keep only the default relays
    const defaultRelays = ['wss://relay.angor.io', 'wss://relay2.angor.io'];
    this.relays = this.relays.filter(relay => defaultRelays.includes(relay.url));

    // Save the updated list of relays to local storage
    this.saveRelaysToLocalStorage();

    // Optionally, disconnect from any removed custom relays
  }

 
  public getEventStream(): Observable<NostrEvent> {
    return this.eventSubject.asObservable();
  }

  public subscribeToFilter(filter: Filter): void {
    const connectedRelays = this.getConnectedRelays();
    const sub = this.pool.subscribeMany(connectedRelays, [filter], {
      onevent: (event: NostrEvent) => {
        this.eventSubject.next(event);
      },
    });
  }
  public getRelays(): { url: string, connected: boolean }[] {
    return this.relays;
  }

  // Method to add a new relay
  public addRelay(url: string): void {
    // Check if the relay is already present
    if (!this.relays.some(relay => relay.url === url)) {
      const newRelay = { url, connected: false };
      this.relays.push(newRelay);
      this.connectToRelay(newRelay); // Attempt to connect to the new relay
      this.saveRelaysToLocalStorage(); // Save the updated list to local storage
    }
  }
}
