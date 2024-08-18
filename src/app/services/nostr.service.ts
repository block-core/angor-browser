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
import { User } from '../../models/user.model';
import { Filter } from 'nostr-tools';
import { secp256k1 } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha256';
 import { hexToBytes } from '@noble/hashes/utils';
@Injectable({
  providedIn: 'root',
})
export class NostrService {
  private secretKey: Uint8Array;
  private publicKey: string;

  constructor(
    private relayService: RelayService,
  ) {
    this.secretKey = generateSecretKey();
    this.publicKey = getPublicKey(this.secretKey);
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

  createEvent(content: string): NostrEvent {
    const eventTemplate = {
      kind: 1,
      created_at: Math.floor(Date.now() / 1000),
      tags: [],
      content,
    };
    return finalizeEvent(eventTemplate, this.secretKey);
  }

  verifyEvent(event: NostrEvent): boolean {
    return verifyEvent(event);
  }

  async getEventId(event: NostrEvent): Promise<string> {
    // The event ID is typically the SHA-256 hash of the serialized event data
    const eventSerialized = JSON.stringify([
      0, // The NIP-01 spec for the event ID generation includes the value "0" as the first item in the array
      event.pubkey,
      event.created_at,
      event.kind,
      event.tags,
      event.content,
    ]);
    return bytesToHex(await sha256(eventSerialized));
  }

  async signEvent(event: NostrEvent, secretKeyHex: string): Promise<NostrEvent> {
     const secretKey = hexToBytes(secretKeyHex);

     const signedEvent = finalizeEvent(event, secretKey);

     return signedEvent;
  }

  bigintToHexString(bigint: bigint): string {
    // Convert bigint to hex string and pad to 64 characters
    return bigint.toString(16).padStart(64, '0');
  }






  private async ensureRelaysConnected(): Promise<void> {
    await this.relayService.ensureConnectedRelays();
  }

  async fetchMetadata(pubkey: string): Promise<any> {
    await this.ensureRelaysConnected();
    const pool = this.relayService.getPool();
    const connectedRelays = this.relayService.getConnectedRelays();

    if (connectedRelays.length === 0) {
      throw new Error('No connected relays');
    }

    return new Promise((resolve, reject) => {
      const sub = pool.subscribeMany(
        connectedRelays,
        [{ authors: [pubkey], kinds: [0] }],
        {
          onevent(event: NostrEvent) {
            if (event.pubkey === pubkey && event.kind === 0) {
              try {
                const content = JSON.parse(event.content);
                resolve(content);
              } catch (error) {
                console.error('Error parsing event content:', error);
                resolve(null);
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

  async publishEventToRelays(event: NostrEvent): Promise<NostrEvent> {
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
        [{ kinds: [1] }],
        {
          onevent(event: NostrEvent) {
            callback(event);
          },
        }
      );
    });
  }

  async getUsers(): Promise<User[]> {
    await this.ensureRelaysConnected();
    const pool = this.relayService.getPool();
    const connectedRelays = this.relayService.getConnectedRelays();

    if (connectedRelays.length === 0) {
      throw new Error('No connected relays');
    }

    return new Promise((resolve) => {
      const users: User[] = [];
      const sub = pool.subscribeMany(
        connectedRelays,
        [{ kinds: [0] }],
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
    await this.ensureRelaysConnected();
    const pool = this.relayService.getPool();
    const connectedRelays = this.relayService.getConnectedRelays();

    if (connectedRelays.length === 0) {
      throw new Error('No connected relays');
    }

    return new Promise((resolve, reject) => {
      const sub = pool.subscribeMany(
        connectedRelays,
        [{ authors: [pubkey], kinds: [0] }],
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
        onevent(event: NostrEvent) {
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

  addRelay(url: string): void {
    if (!this.relayService.isRelayPresent(url)) {
      this.relayService.addRelay(url);
    }
  }


  async getEventsByAuthor(pubkey: string): Promise<NostrEvent[]> {
    await this.ensureRelaysConnected();
    const pool = this.relayService.getPool();
    const connectedRelays = this.relayService.getConnectedRelays();

    if (connectedRelays.length === 0) {
      throw new Error('No connected relays');
    }

    const filters: Filter[] = [{ authors: [pubkey] }];

    return new Promise((resolve, reject) => {
      const events: NostrEvent[] = [];
      const sub = pool.subscribeMany(connectedRelays, filters, {
        onevent(event: NostrEvent) {
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
      throw new Error('No connected relays');
    }

    const filters: Filter[] = [{ kinds: [3], '#p': [pubkey] }];
    const followers: User[] = [];

    return new Promise((resolve, reject) => {
      const sub = pool.subscribeMany(connectedRelays, filters, {
        onevent(event: NostrEvent) {
          try {
            followers.push({ nostrPubKey: event.pubkey } as User);
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
      throw new Error('No connected relays');
    }

    const filter1: Filter = {
      kinds: [4],
      '#p': [this.publicKey],
      limit: 50,
    };

    return new Promise((resolve, reject) => {
      const events: NostrEvent[] = [];
      const sub = pool.subscribeMany(connectedRelays, [filter1], {
        onevent(event: NostrEvent) {
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
      throw new Error('No connected relays');
    }

    const filters: Filter[] = [{ kinds: [3], authors: [pubkey] }];
    const following: User[] = [];

    return new Promise((resolve, reject) => {
      const sub = pool.subscribeMany(connectedRelays, filters, {
        onevent(event: NostrEvent) {
          try {
            const tags = event.tags.filter((tag) => tag[0] === 'p');
            tags.forEach((tag) => {
              following.push({ nostrPubKey: tag[1] } as User);
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
