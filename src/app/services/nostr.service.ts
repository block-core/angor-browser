import { Injectable } from '@angular/core';
import {
  generateSecretKey,
  getPublicKey,
  finalizeEvent,
  verifyEvent,
  Event as NostrEvent,
} from 'nostr-tools/pure';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { sha256 } from '@noble/hashes/sha256';
import { RelayService } from './relay.service';
import { Filter } from 'nostr-tools';
import { getSharedSecret } from '@noble/secp256k1';

@Injectable({
  providedIn: 'root',
})
export class NostrService {
  private secretKey: Uint8Array;
  private publicKey: string;

  constructor(private relayService: RelayService) {
    this.secretKey = generateSecretKey();
    this.publicKey = getPublicKey(this.secretKey);
  }

  // Account management
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

  // Event management
  createEvent(content: string, kind: number = 1): NostrEvent {
    const eventTemplate = {
      kind,
      created_at: Math.floor(Date.now() / 1000),
      tags: [],
      content,
    };
    return finalizeEvent(eventTemplate, this.secretKey);
  }

  async getEventId(event: NostrEvent): Promise<string> {
    const eventSerialized = JSON.stringify([
      0,
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

  verifyEvent(event: NostrEvent): boolean {
    return verifyEvent(event);
  }

  // Relay management
  private async ensureRelaysConnected(): Promise<void> {
    await this.relayService.ensureConnectedRelays();
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

  // Profile management
  async updateProfile(name: string, about: string, picture: string): Promise<NostrEvent> {
    const content = JSON.stringify({ name, about, picture });
    const event = this.createEvent(content, 0);
    return this.publishEventToRelays(event);
  }

  async getUserProfile(pubkey: string): Promise<any> {
    const metadata = await this.fetchMetadata(pubkey);
    const user: any = {
      nostrPubKey: pubkey,
      displayName: metadata.name,
      picture: metadata.picture,
      about: metadata.about,
      website: metadata.website,
      lud16: metadata.lud16,
      nip05: metadata.nip05,
    };
    return user;
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

  // Messaging (NIP-04)
  async sendMessageToUser(recipientPubKey: string, message: string): Promise<NostrEvent> {
    const event = this.createEvent(message, 4);
    event.tags.push(['p', recipientPubKey]);
    return this.publishEventToRelays(event);
  }

  async sendEncryptedMessageToUser(recipientPubKey: string, message: string): Promise<NostrEvent> {
    const encryptedMessage = await this.encryptMessage(recipientPubKey, message);
    const event = this.createEvent(encryptedMessage, 4);
    event.tags.push(['p', recipientPubKey]);
    return this.publishEventToRelays(event);
  }

  private async encryptMessage(recipientPubKey: string, message: string): Promise<string> {
    const sharedSecret = getSharedSecret(this.secretKey, hexToBytes(recipientPubKey));
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    const aesKey = await window.crypto.subtle.importKey(
      'raw',
      sharedSecret.slice(0, 16),
      'AES-GCM',
      false,
      ['encrypt']
    );

    const encryptedContent = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      aesKey,
      new TextEncoder().encode(message)
    );

    const encryptedMessage = new Uint8Array([...iv, ...new Uint8Array(encryptedContent)]);
    return btoa(String.fromCharCode(...encryptedMessage));
  }

  // Reactions (NIP-45)
  async reactToEvent(eventId: string, reaction: string): Promise<NostrEvent> {
    const event = this.createEvent(reaction, 30);
    event.tags.push(['e', eventId]);
    return this.publishEventToRelays(event);
  }

  async rateEvent(eventId: string, rating: number): Promise<NostrEvent> {
    const event = this.createEvent(`Rating: ${rating}`, 31);
    event.tags.push(['e', eventId]);
    return this.publishEventToRelays(event);
  }

  // Channels & Groups (NIP-28)
  async getChannels(): Promise<NostrEvent[]> {
    await this.ensureRelaysConnected();
    const pool = this.relayService.getPool();
    const connectedRelays = this.relayService.getConnectedRelays();

    if (connectedRelays.length === 0) {
      throw new Error('No connected relays');
    }

    return new Promise((resolve) => {
      const channels: NostrEvent[] = [];
      const sub = pool.subscribeMany(
        connectedRelays,
        [{ kinds: [40] }],
        {
          onevent(event: NostrEvent) {
            channels.push(event);
          },
          oneose() {
            sub.close();
            resolve(channels);
          },
        }
      );
    });
  }

  async createChannel(name: string, description: string): Promise<NostrEvent> {
    const content = JSON.stringify({ name, description });
    const event = this.createEvent(content, 40);
    return this.publishEventToRelays(event);
  }

  async sendMessageToChannel(channelId: string, message: string): Promise<NostrEvent> {
    const event = this.createEvent(message, 42);
    event.tags.push(['e', channelId]);
    return this.publishEventToRelays(event);
  }

  async getGroups(): Promise<NostrEvent[]> {
    await this.ensureRelaysConnected();
    const pool = this.relayService.getPool();
    const connectedRelays = this.relayService.getConnectedRelays();

    if (connectedRelays.length === 0) {
      throw new Error('No connected relays');
    }

    return new Promise((resolve) => {
      const groups: NostrEvent[] = [];
      const sub = pool.subscribeMany(
        connectedRelays,
        [{ kinds: [41] }],
        {
          onevent(event: NostrEvent) {
            groups.push(event);
          },
          oneose() {
            sub.close();
            resolve(groups);
 },
      });           },
      );
    } ;
   

  async createGroup(name: string, description: string): Promise<NostrEvent> {
    const content = JSON.stringify({ name, description });
    const event = this.createEvent(content, 41); // Group creation event
    return this.publishEventToRelays(event);
  }

  async sendMessageToGroup(groupId: string, message: string): Promise<NostrEvent> {
    const event = this.createEvent(message, 42); // Group message event
    event.tags.push(['e', groupId]);
    return this.publishEventToRelays(event);
  }

  // Social interactions (Followers & Following)
  async getFollowers(pubkey: string): Promise<any[]> {
    await this.ensureRelaysConnected();
    const pool = this.relayService.getPool();
    const connectedRelays = this.relayService.getConnectedRelays();

    if (connectedRelays.length === 0) {
      throw new Error('No connected relays');
    }

    const filters: Filter[] = [{ kinds: [3], '#p': [pubkey] }];
    const followers: any[] = [];

    return new Promise((resolve) => {
      const sub = pool.subscribeMany(connectedRelays, filters, {
        onevent(event: NostrEvent) {
          followers.push({ nostrPubKey: event.pubkey });
        },
        oneose() {
          sub.close();
          resolve(followers);
        },
      });
    });
  }

  async getFollowing(pubkey: string): Promise<any[]> {
    await this.ensureRelaysConnected();
    const pool = this.relayService.getPool();
    const connectedRelays = this.relayService.getConnectedRelays();

    if (connectedRelays.length === 0) {
      throw new Error('No connected relays');
    }

    const filters: Filter[] = [{ kinds: [3], authors: [pubkey] }];
    const following: any[] = [];

    return new Promise((resolve) => {
      const sub = pool.subscribeMany(connectedRelays, filters, {
        onevent(event: NostrEvent) {
          const tags = event.tags.filter((tag) => tag[0] === 'p');
          tags.forEach((tag) => {
            following.push({ nostrPubKey: tag[1] });
          });
        },
        oneose() {
          sub.close();
          resolve(following);
        },
      });
    });
  }

  // Message retrieval (NIP-04)
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

    return new Promise((resolve) => {
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

  // Event retrieval by author
  async getEventsByAuthor(pubkey: string): Promise<NostrEvent[]> {
    await this.ensureRelaysConnected();
    const pool = this.relayService.getPool();
    const connectedRelays = this.relayService.getConnectedRelays();

    if (connectedRelays.length === 0) {
      throw new Error('No connected relays');
    }

    const filters: Filter[] = [{ authors: [pubkey] }];

    return new Promise((resolve) => {
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

  // Retrieve all users
  async getUsers(): Promise<any[]> {
    await this.ensureRelaysConnected();
    const pool = this.relayService.getPool();
    const connectedRelays = this.relayService.getConnectedRelays();

    if (connectedRelays.length === 0) {
      throw new Error('No connected relays');
    }

    return new Promise((resolve) => {
      const users: any[] = [];
      const sub = pool.subscribeMany(
        connectedRelays,
        [{ kinds: [0] }],
        {
          onevent(event: NostrEvent) {
            try {
              const content = JSON.parse(event.content);
              const user: any = {
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
}
