import { Injectable } from '@angular/core';
import {
  generateSecretKey,
  getPublicKey,
  finalizeEvent,
  verifyEvent,
  Event as NostrEvent,
  getEventHash,
} from 'nostr-tools/pure';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { sha256 } from '@noble/hashes/sha256';
import { RelayService } from './relay.service';
import { Filter } from 'nostr-tools';
import { getSharedSecret } from '@noble/secp256k1';
import { SecurityService } from './security.service';
import { Subject } from 'rxjs';
 import * as secp256k1 from '@noble/secp256k1';



 @Injectable({
  providedIn: 'root',
})
export class NostrService {
  private secretKey: Uint8Array;
  private publicKey: string;
  private eventSubject = new Subject<NostrEvent>();

  // Observable that other parts of the app can subscribe to
  public eventUpdates$ = this.eventSubject.asObservable();

  constructor(
    private relayService: RelayService,
    private security: SecurityService
  ) {
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

  // Sign event with password decryption or extension
  async signEventWithPassword(
    content: string,
    encryptedPrivateKey: string,
    password: string,
    kind: number
  ): Promise<NostrEvent> {
    const decryptedPrivateKey = await this.security.decryptData(encryptedPrivateKey, password);
    const secretKey = hexToBytes(decryptedPrivateKey);
    const event = this.createEvent(content, kind);
    return this.signEvent(event, bytesToHex(secretKey));
  }



  async signEventWithExtension(content: string, kind: number): Promise<NostrEvent> {
    const gt = globalThis as any;

    const event = this.createEvent(content, kind);

    try {
      // Let the Nostr extension handle the signing and ID generation
      const signedEvent = await gt.nostr.signEvent(event);

      return signedEvent;
    } catch (error) {
      console.error('Error signing event with extension:', error);
      throw error;
    }
  }

  private createEvent(content: string, kind: number): NostrEvent {
    return {
      kind,
      created_at: Math.floor(Date.now() / 1000),
      tags: [],
      content,
      pubkey: '',
      id: '',
      sig: '',
    } as unknown as NostrEvent;
  }

  serializeEvent(event: any): string {
    return JSON.stringify([0, event.pubkey, event.created_at, event.kind, event.tags, event.content]);
  }

  getEventHash(event: any): string {
    const utf8Encoder = new TextEncoder();
    const eventHash = sha256(utf8Encoder.encode(this.serializeEvent(event)));
    return this.bytesToHex(eventHash);
  }

  bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  }



  isValidHex(hexString: string): boolean {
    return /^[0-9a-fA-F]+$/.test(hexString) && hexString.length % 2 === 0;
  }

  async signEvent(event: NostrEvent, secretKeyHex: string): Promise<NostrEvent> {
    const secretKey = hexToBytes(secretKeyHex);

    // Check if the secret key is valid
    if (!this.isValidHex(secretKeyHex)) {
      console.error('Invalid secret key provided:', secretKeyHex);
      throw new Error('Invalid secret key format');
    }

    const signedEvent = finalizeEvent(event, secretKey);

    // Validate the event
    if (!this.isValidHex(signedEvent.id)) {
      console.error('Invalid signed event ID:', signedEvent.id);
      throw new Error('Invalid signed event format');
    }

    return signedEvent;
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

  verifyEvent(event: NostrEvent): boolean {
    return verifyEvent(event);
  }

  async sendComment(postId: string, commentContent: string): Promise<NostrEvent> {
    // Create the comment event
    const commentEvent = this.createEvent(commentContent, 1); // Using kind 1 for text posts/comments
    commentEvent.tags.push(['e', postId]); // Reference the original post/event ID

    // Sign and publish the comment event
    const signedEvent = finalizeEvent(commentEvent, this.secretKey);
    return this.publishEventToRelays(signedEvent);
  }

  // Relay management
  private async ensureRelaysConnected(): Promise<void> {
    await this.relayService.ensureConnectedRelays();
  }

  async publishEventToRelays(event: NostrEvent): Promise<NostrEvent> {
    await this.ensureRelaysConnected();
    const pool = this.relayService.getPool();
    const connectedRelays = this.relayService.getConnectedRelays();

    if (connectedRelays.length === 0) {
      throw new Error('No connected relays');
    }

    const publishPromises = connectedRelays.map(async (relayUrl) => {
      try {
        await pool.publish([relayUrl], event);
        console.log(`Event published to relay: ${relayUrl}`);
        this.eventSubject.next(event); // Emit the event to subscribers
        return event;
      } catch (error) {
        console.error(`Failed to publish event to relay: ${relayUrl}`, error);
        throw error;
      }
    });

    try {
      await Promise.any(publishPromises);
      return event;
    } catch (aggregateError) {
      console.error('Failed to publish event: AggregateError', aggregateError);
      this.handlePublishFailure(aggregateError);
      throw aggregateError;
    }
  }

  private handlePublishFailure(error: unknown): void {
    if (error instanceof AggregateError) {
      // Specific handling for AggregateError
      console.error('All relays failed to publish the event. Retrying...');
      // Optional: Implement retry logic here or show a user-friendly message
    } else {
      console.error('An unexpected error occurred:', error);
    }
  }

  subscribeToEvents(callback: (event: NostrEvent) => void): void {
    this.ensureRelaysConnected().then(() => {
      const pool = this.relayService.getPool();
      const connectedRelays = this.relayService.getConnectedRelays();
      pool.subscribeMany(connectedRelays, [{ kinds: [1] }], {
        onevent: (event: NostrEvent) => {
          callback(event);
          this.eventSubject.next(event); // Emit the event to subscribers
        },
      });
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
          onevent: (event: NostrEvent) => {
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

  async sendEncryptedMessageToUser(
    recipientPubKey: string,
    message: string
  ): Promise<NostrEvent> {
    const encryptedMessage = await this.encryptMessage(recipientPubKey, message);
    const event = this.createEvent(encryptedMessage, 4);
    event.tags.push(['p', recipientPubKey]);
    return this.publishEventToRelays(event);
  }

  private async encryptMessage(
    recipientPubKey: string,
    message: string
  ): Promise<string> {
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
      const sub = pool.subscribeMany(connectedRelays, [{ kinds: [40] }], {
        onevent: (event: NostrEvent) => {
          channels.push(event);
          this.eventSubject.next(event); // Emit the event to subscribers
        },
        oneose() {
          sub.close();
          resolve(channels);
        },
      });
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
      const sub = pool.subscribeMany(connectedRelays, [{ kinds: [41] }], {
        onevent: (event: NostrEvent) => {
          groups.push(event);
          this.eventSubject.next(event); // Emit the event to subscribers
        },
        oneose() {
          sub.close();
          resolve(groups);
        },
      });
    });
  }

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
        onevent: (event: NostrEvent) => {
          followers.push({ nostrPubKey: event.pubkey });
          this.eventSubject.next(event); // Emit the event to subscribers
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
        onevent: (event: NostrEvent) => {
          const tags = event.tags.filter((tag) => tag[0] === 'p');
          tags.forEach((tag) => {
            following.push({ nostrPubKey: tag[1] });
            this.eventSubject.next(event); // Emit the event to subscribers
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
        onevent: (event: NostrEvent) => {
          events.push(event);
          this.eventSubject.next(event); // Emit the event to subscribers
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

    const filters: Filter[] = [{ authors: [pubkey], kinds: [1] }];

    return new Promise((resolve) => {
      const events: NostrEvent[] = [];
      const sub = pool.subscribeMany(connectedRelays, filters, {
        onevent: (event: NostrEvent) => {
          events.push(event);
          this.eventSubject.next(event); // Emit the event to subscribers
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
          onevent: (event: NostrEvent) => {
            try {
              const content = JSON.parse(event.content);
              const user: any = {
                nostrPubKey: event.pubkey,
                displayName: content.display_name,
                picture: content.picture,
                lastActivity: event.created_at,
              };
              users.push(user);
              this.eventSubject.next(event); // Emit the event to subscribers
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
