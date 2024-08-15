import { Injectable } from '@angular/core';
import {
  generateSecretKey,
  getPublicKey,
  finalizeEvent,
  verifyEvent,
  Event as NostrEvent,
} from 'nostr-tools/pure'; // Ensure correct path
import { bytesToHex } from '@noble/hashes/utils';
import { RelayService } from './relay.service';
import { NotificationService } from './notification.service';
import { User } from '../../models/user.model';
import { Notification } from '../../models/notification.model';
import { Filter } from 'nostr-tools';

@Injectable({
  providedIn: 'root',
})
export class NostrService {
  private secretKey: Uint8Array;
  private publicKey: string;
  public relayService: RelayService;

  constructor(
    relayService: RelayService,
    private notificationService: NotificationService
  ) {
    this.secretKey = generateSecretKey();
    this.publicKey = getPublicKey(this.secretKey);
    this.relayService = relayService;
  }

  generateNewAccount(): { publicKey: string; secretKeyHex: string } {
    this.secretKey = generateSecretKey();
    this.publicKey = getPublicKey(this.secretKey);
    return {
      publicKey: this.publicKey,
      secretKeyHex: bytesToHex(this.secretKey),
    };
  }

  getKeys(): { secretKey: Uint8Array; publicKey: string } {
    return {
      secretKey: this.secretKey,
      publicKey: this.publicKey,
    };
  }

  getSecretKeyHex(): string {
    return bytesToHex(this.secretKey);
  }

  getPublicKeyHex(): string {
    return this.publicKey;
  }

  createEvent(content: string): any {
    const eventTemplate = {
      kind: 1,
      created_at: Math.floor(Date.now() / 1000),
      tags: [],
      content,
    };
    return finalizeEvent(eventTemplate, this.secretKey);
  }

  verifyEvent(event: any): boolean {
    return verifyEvent(event);
  }

  async ensureRelaysConnected(): Promise<void> {
    await this.relayService.ensureConnectedRelays();
  }

  async fetchMetadata(pubkey: string): Promise<any> {
    await this.ensureRelaysConnected(); // Ensure relays are connected before fetching metadata
    const pool = this.relayService.getPool();
    const connectedRelays = this.relayService.getConnectedRelays();

    if (connectedRelays.length === 0) {
      return Promise.reject(new Error('No connected relays'));
    }

    return new Promise((resolve, reject) => {
      const sub = pool.subscribeMany(
        connectedRelays,
        [
          {
            authors: [pubkey],
            kinds: [0],
          },
        ],
        {
          onevent(event: NostrEvent) {
            if (event.pubkey === pubkey && event.kind === 0) {
              try {
                const content = JSON.parse(event.content);
                resolve(content);
              } catch (error) {
                console.error('Error parsing event content:', error);
                resolve(null);
              }
              sub.close();
            }
          },
          oneose() {
            sub.close();
            resolve(null);
          },
        }
      );
    });
  }

  async publishEventToRelays(event: any): Promise<any> {
    await this.ensureRelaysConnected();
    const pool = this.relayService.getPool();
    const connectedRelays = this.relayService.getConnectedRelays();
    try {
      await Promise.any(pool.publish(connectedRelays, event));
      console.log('Event published:', event);
      return event;
    } catch (error) {
      console.error('Failed to publish event:', error);
      throw error;
    }
  }

  subscribeToEvents(callback: (event: NostrEvent) => void): void {
    this.ensureRelaysConnected().then(() => {
      const pool = this.relayService.getPool();
      const connectedRelays = this.relayService.getConnectedRelays();
      pool.subscribeMany(
        connectedRelays,
        [
          {
            kinds: [1],
          },
        ],
        {
          onevent: (event: NostrEvent) => {
            callback(event);
          },
        }
      );
    });
  }

  async getUsers(): Promise<User[]> {
    await this.ensureRelaysConnected(); // Ensure relays are connected before fetching users
    const pool = this.relayService.getPool();
    const connectedRelays = this.relayService.getConnectedRelays();

    if (connectedRelays.length === 0) {
      return Promise.reject(new Error('No connected relays'));
    }

    return new Promise((resolve, reject) => {
      const users: User[] = [];
      const sub = pool.subscribeMany(
        connectedRelays,
        [
          {
            kinds: [0],
          },
        ],
        {
          onevent(event: NostrEvent) {
            try {
              const content = JSON.parse(event.content);
              const user: User = {
                nostrPubKey: event.pubkey,
                displayName: content.display_name,
                picture: content.picture,
                lastActivity: event.created_at,
              };
              users.push(user);
            } catch (error) {
              console.error('Error parsing event content:', error);
            }
          },
          oneose() {
            sub.close();
            users.sort((a, b) => b.lastActivity - a.lastActivity);
            resolve(users);
          },
        }
      );
    });
  }

  async getMetadata(pubkey: string): Promise<any> {
    await this.ensureRelaysConnected(); // Ensure relays are connected before fetching metadata
    const pool = this.relayService.getPool();
    const connectedRelays = this.relayService.getConnectedRelays();

    if (connectedRelays.length === 0) {
      return Promise.reject(new Error('No connected relays'));
    }

    return new Promise((resolve, reject) => {
      const sub = pool.subscribeMany(
        connectedRelays,
        [
          {
            authors: [pubkey],
            kinds: [0],
          },
        ],
        {
          onevent(event: NostrEvent) {
            if (event.pubkey === pubkey && event.kind === 0) {
              try {
                const metadata = JSON.parse(event.content);
                resolve(metadata);
              } catch (error) {
                console.error('Error parsing metadata content:', error);
                reject(null);
              } finally {
                sub.close();
              }
            }
          },
          oneose() {
            sub.close();
            resolve(null);
          },
        }
      );
    });
  }

  subscribeToUserActivities(callback: (user: User) => void): void {
    this.ensureRelaysConnected().then(() => {
      const pool = this.relayService.getPool();
      const connectedRelays = this.relayService.getConnectedRelays();
      pool.subscribeMany(connectedRelays, [{ kinds: [1] }], {
        onevent: (event: NostrEvent) => {
          try {
            const content = JSON.parse(event.content);
            const user: User = {
              nostrPubKey: event.pubkey,
              displayName: content.display_name,
              picture: content.picture,
              lastActivity: event.created_at,
            };
            callback(user);
          } catch (error) {
            console.error('Error parsing event content:', error);
          }
        },
      });
    });
  }

  addRelay(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.relayService.addRelay(url);
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  async getNotifications(): Promise<Notification[]> {
    await this.ensureRelaysConnected();
    const pool = this.relayService.getPool();
    const connectedRelays = this.relayService.getConnectedRelays();

    if (connectedRelays.length === 0) {
      return Promise.reject(new Error('No connected relays'));
    }
    console.log(this.publicKey);

    const filters: Filter[] = [{ kinds: [3], '#p': [this.publicKey] }];

    const notifications: NostrEvent[] = [];

    return new Promise((resolve, reject) => {
      const sub = pool.subscribeMany(connectedRelays, filters, {
        onevent: (event: NostrEvent) => {
          notifications.push(event);
        },
        oneose: () => {
          sub.close();
          const notificationList: Notification[] = notifications.map(
            (event: NostrEvent) => ({
              id: event.id,
              kind: event.kind,
              pubkey: event.pubkey,
              created_at: event.created_at,
              content: event.content,
              read: false,
              tags: event.tags,
            })
          );

          notificationList.forEach((notification) => {
            this.notificationService.addNotification(notification);
          });

          resolve(notificationList);
        },
      });
    });
  }
  async getEventsByAuthor(pubkey: string): Promise<NostrEvent[]> {
    await this.ensureRelaysConnected();
    const pool = this.relayService.getPool();
    const connectedRelays = this.relayService.getConnectedRelays();

    if (connectedRelays.length === 0) {
      return Promise.reject(new Error('No connected relays'));
    }

    const filters: Filter[] = [{ authors: [pubkey] }];

    const events: NostrEvent[] = [];

    return new Promise((resolve, reject) => {
      const sub = pool.subscribeMany(connectedRelays, filters, {
        onevent: (event: NostrEvent) => {
          events.push(event);
        },
        oneose() {
          sub.close();
          resolve(events);
        },
      });
    });
  }

  async getFollowers(pubkey: string): Promise<User[]> {
    await this.ensureRelaysConnected();
    const pool = this.relayService.getPool();
    const connectedRelays = this.relayService.getConnectedRelays();

    if (connectedRelays.length === 0) {
      return Promise.reject(new Error('No connected relays'));
    }

    const filters: Filter[] = [{ kinds: [3], '#p': [pubkey] }];
    const followers: User[] = [];

    return new Promise((resolve, reject) => {
      const sub = pool.subscribeMany(connectedRelays, filters, {
        onevent: (event: NostrEvent) => {
          try {
            const pubkey = event.pubkey;
            followers.push({ nostrPubKey: pubkey } as User);
          } catch (error) {
            console.error('Error parsing follower event:', error);
          }
        },
        oneose() {
          sub.close();
          resolve(followers);
        },
      });
    });
  }
  async getKind4MessagesToMe(): Promise<NostrEvent[]> {
    await this.ensureRelaysConnected();
    const pool = this.relayService.getPool();
    const connectedRelays = this.relayService.getConnectedRelays();

    if (connectedRelays.length === 0) {
      return Promise.reject(new Error('No connected relays'));
    }

    const filter1: Filter = {
      kinds: [4],
      '#p': [this.publicKey],
      limit: 50,
    };

    const events: NostrEvent[] = [];

    return new Promise((resolve, reject) => {
      const sub = pool.subscribeMany(connectedRelays, [filter1], {
        onevent: (event: NostrEvent) => {
          events.push(event);
        },
        oneose() {
          sub.close();
          resolve(events);
        },
      });
    });
  }
  async getFollowing(pubkey: string): Promise<User[]> {
    await this.ensureRelaysConnected();
    const pool = this.relayService.getPool();
    const connectedRelays = this.relayService.getConnectedRelays();

    if (connectedRelays.length === 0) {
      return Promise.reject(new Error('No connected relays'));
    }

    const filters: Filter[] = [{ kinds: [3], authors: [pubkey] }];
    const following: User[] = [];

    return new Promise((resolve, reject) => {
      const sub = pool.subscribeMany(connectedRelays, filters, {
        onevent: (event: NostrEvent) => {
          try {
            const tags = event.tags.filter((tag) => tag[0] === 'p');
            tags.forEach((tag) => {
              const pubkey = tag[1];
              following.push({ nostrPubKey: pubkey } as User);
            });
          } catch (error) {
            console.error('Error parsing following event:', error);
          }
        },
        oneose() {
          sub.close();
          resolve(following);
        },
      });
    });
  }
}
