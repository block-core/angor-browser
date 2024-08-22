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
import { Filter ,  } from 'nostr-tools';
import { nip04 } from 'nostr-tools';
import { getSharedSecret } from '@noble/secp256k1';
import { SecurityService } from './security.service';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class NostrService {
  private secretKey: Uint8Array;
  private publicKey: string;
  private eventSubject = new Subject<NostrEvent>();
  private nostrExtension: any;

  nostrPublicKey = '';
  nostrSignedEvent = '';
  nostrRelays?: string[];

  nostrEvent = {
    created_at: Date.now(),
    kind: 1,
    tags: [],
    content: 'This is my nostr message',
    pubkey: '',
  };

  // Observable that other parts of the app can subscribe to
  public eventUpdates$ = this.eventSubject.asObservable();

  constructor(
    private relayService: RelayService,
    private security: SecurityService
  ) {
    this.secretKey = generateSecretKey();
    this.publicKey = getPublicKey(this.secretKey);
    this.nostrExtension = (globalThis as any).nostr; // Assuming the Nostr extension is available globally
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

  getUserPublicKey(): string | null {
    return localStorage.getItem('nostrPublicKey');
  }

  // Signing events
  async signEventWithPassword(
    content: string,
    encryptedPrivateKey: string,
    password: string,
    kind: number,
    tags: string[][],
    pubkey: string
  ): Promise<NostrEvent> {
     const decryptedPrivateKey = await this.security.decryptData(encryptedPrivateKey, password);
    const secretKey = hexToBytes(decryptedPrivateKey);

    if (!this.isValidHex(bytesToHex(secretKey))) {
      console.error('Invalid secret key provided:', bytesToHex(secretKey));
      throw new Error('Invalid secret key format');
    }

     const event = this.createEvent(content, kind, tags, pubkey);

     const signedEvent = finalizeEvent(event, secretKey);

    if (!this.isValidHex(signedEvent.id)) {
      console.error('Invalid signed event ID:', signedEvent.id);
      throw new Error('Invalid signed event format');
    }

    return signedEvent;
  }


  async signEventWithExtension(content: string, kind: number, tags: string[][], pubkey: string): Promise<NostrEvent> {
    const gt = globalThis as any;

    if (!gt.nostr || typeof gt.nostr.signEvent !== 'function') {
      throw new Error('Nostr extension not available or signEvent method is missing.');
    }

     const event = this.createEvent(content, kind, tags, pubkey);

    try {
      const signedEvent = await gt.nostr.signEvent(event);
      return signedEvent;
    } catch (error) {
      console.error('Error signing event with extension:', error);
      throw error;
    }
  }


  async signEvent(
    eventContent: string,
    kind: number,
    options: {
      encryptedPrivateKey?: string;
      password?: string;
      useExtension?: boolean;
      tags: string[][];
      pubkey: string;
    }
  ): Promise<NostrEvent> {
    const { encryptedPrivateKey, password, useExtension, tags, pubkey } = options;

    if (useExtension) {
      return this.signEventWithExtension(eventContent, kind, tags, pubkey);
    }

    if (encryptedPrivateKey && password) {
      return this.signEventWithPassword(eventContent, encryptedPrivateKey, password, kind, tags, pubkey);
    }

    throw new Error('No valid signing method provided.');
  }

  // Event management
  private createEvent(content: string, kind: number, tags: string[][], pubkey: string): NostrEvent {
    return {
      kind,
      created_at: Math.floor(Date.now() / 1000),
      tags,
      content,
      pubkey,
      id: '',
      sig: '',
    } as unknown as NostrEvent;
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

  serializeEvent(event: any): string {
    return JSON.stringify([0, event.pubkey, event.created_at, event.kind, event.tags, event.content]);
  }

  getEventHash(event: any): string {
    const utf8Encoder = new TextEncoder();
    const eventHash = sha256(utf8Encoder.encode(this.serializeEvent(event)));
    return this.bytesToHex(eventHash);
  }

  verifyEvent(event: NostrEvent): boolean {
    return verifyEvent(event);
  }



  // Messaging (NIP-04)
  async decryptMessageWithExtension(encryptedContent: string, senderPubKey: string): Promise<string> {
    try {
      const gt = globalThis as any;
      const decryptedMessage = await gt.nostr.nip04.decrypt(senderPubKey, encryptedContent);
      return decryptedMessage;
    } catch (error) {
      console.error('Error decrypting message with extension:', error);
      throw new Error('Failed to decrypt message with Nostr extension.');
    }
  }


  async encryptMessageWithExtension(content: string, pubKey: string): Promise<string> {
    const gt = globalThis as any;
    const encryptedMessage = await gt.nostr.nip04.encrypt(pubKey, content);
    return encryptedMessage;
  }

  async encryptMessage(privateKey: string, recipientPublicKey: string, message: string): Promise<string> {
    console.log(message);
    try {
      const encryptedMessage = await nip04.encrypt(privateKey, recipientPublicKey, message);
      return encryptedMessage;
    } catch (error) {
      console.error('Error encrypting message:', error);
      throw error;
    }
  }

  // NIP-04: Decrypting Direct Messages
  async decryptMessage(privateKey: string, senderPublicKey: string, encryptedMessage: string): Promise<string> {
    try {
      const decryptedMessage = await nip04.decrypt(privateKey, senderPublicKey, encryptedMessage);
      return decryptedMessage;
    } catch (error) {
      console.error('Error decrypting message:', error);
      throw error;
    }
  }


  // Profile management
  async updateProfile(
    name: string | null,
    about: string | null,
    picture: string | null,
    tags: string[][] = [],
    pubkey: string | null = null
  ): Promise<NostrEvent> {
    const content = JSON.stringify({ name, about, picture });

     const finalPubkey = pubkey || this.getPublicKeyHex();

     const event = this.createEvent(content, 0, tags, finalPubkey);

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

  // Social interactions
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

  async getEventsByAuthor(
    pubkey: string,
    kinds: number[] = [1]
  ): Promise<NostrEvent[]> {
    await this.ensureRelaysConnected();
    const pool = this.relayService.getPool();
    const connectedRelays = this.relayService.getConnectedRelays();

    if (connectedRelays.length === 0) {
      throw new Error('No connected relays');
    }

    const filters: Filter[] = [{ authors: [pubkey], kinds }];

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
      console.error('All relays failed to publish the event. Retrying...');
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

  // Nostr Extension Interactions
  async getNostrPublicKeyFromExtension() {
    const gt = globalThis as any;
    const pubKey = await gt.nostr.getPublicKey();
    this.nostrPublicKey = pubKey;
    this.nostrEvent.pubkey = this.nostrPublicKey;
  }

  async getNostrPublicRelaysFromExtension() {
    const gt = globalThis as any;
    const relays = await gt.nostr.getRelays();
    this.nostrRelays = relays;
  }

  // Utility methods
  isValidHex(hexString: string): boolean {
    return /^[0-9a-fA-F]+$/.test(hexString) && hexString.length % 2 === 0;
  }

  async decryptPrivateKeyWithPassword(encryptedPrivateKey: string, password: string): Promise<string> {
    try {
      const decryptedPrivateKey = await this.security.decryptData(encryptedPrivateKey, password);
      return decryptedPrivateKey;
    } catch (error) {
      console.error('Error decrypting private key with password:', error);
      throw new Error('Failed to decrypt private key with the provided password.');
    }
  }

  bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  }
}
