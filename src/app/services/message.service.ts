import { Injectable } from '@angular/core';
import { NostrService } from './nostr.service';
import { NostrEvent } from 'nostr-tools';
import { getSharedSecret, ProjectivePoint } from '@noble/secp256k1';
import { hexToBytes } from '@noble/hashes/utils';

@Injectable({
  providedIn: 'root',
})
export class MessageService {
  constructor(private nostrService: NostrService) {}

  async sendMessage(
    content: string,
    recipientPubKey: string,
    signingOptions: {
      encryptedPrivateKey?: string;
      password?: string;
      useExtension?: boolean;
    }
  ): Promise<NostrEvent> {
    const event = await this.nostrService.sendMessageToUser(
      recipientPubKey,
      content,
      signingOptions
    );
    return event;
  }

  async sendEncryptedMessage(
    content: string,
    recipientPubKey: string,
    signingOptions: {
      encryptedPrivateKey?: string;
      password?: string;
      useExtension?: boolean;
    }
  ): Promise<NostrEvent> {
    const event = await this.nostrService.sendEncryptedMessageToUser(
      recipientPubKey,
      content,
      signingOptions
    );
    return event;
  }

  async decryptMessage(
    recipientPrivateKey: string,
    senderPubKey: string,
    encryptedContent: string
  ): Promise<string> {
    if (!this.isValidPublicKey(senderPubKey)) {
      throw new Error('Invalid sender public key');
    }

    const [encryptedMessage, ivBase64] = encryptedContent.split('?iv=');

    const sharedSecret = getSharedSecret(
      hexToBytes(recipientPrivateKey),
      ProjectivePoint.fromHex(senderPubKey).toRawBytes(true) // Convert Point to Uint8Array
    );

    const iv = Uint8Array.from(atob(ivBase64), (c) => c.charCodeAt(0));
    const ciphertext = Uint8Array.from(atob(encryptedMessage), (c) => c.charCodeAt(0));

    const aesKey = await window.crypto.subtle.importKey(
      'raw',
      sharedSecret.slice(0, 32),
      'AES-CBC',
      false,
      ['decrypt']
    );

    const decryptedContent = await window.crypto.subtle.decrypt(
      { name: 'AES-CBC', iv },
      aesKey,
      ciphertext
    );

    return new TextDecoder().decode(decryptedContent);
  }

  async getMessages(
    pubkey: string,
    signingOptions: {
      encryptedPrivateKey?: string;
      password?: string;
      useExtension?: boolean;
    }
  ): Promise<NostrEvent[]> {
    const events = await this.nostrService.getEventsByAuthor(pubkey, [4]);

    for (let event of events) {
      try {
        if (signingOptions.useExtension) {
          event.content = await this.nostrService.decryptMessageWithExtension(event.content, event.pubkey);
        } else if (signingOptions.encryptedPrivateKey && signingOptions.password) {
          const decryptedPrivateKey = await this.nostrService.decryptPrivateKeyWithPassword(
            signingOptions.encryptedPrivateKey,
            signingOptions.password
          );
          event.content = await this.decryptMessage(decryptedPrivateKey, event.pubkey, event.content);
        } else {
          throw new Error('Missing private key or password for decryption.');
        }
      } catch (error) {
        console.error('Failed to decrypt message:', error);
        event.content = '[Unable to decrypt message]';
      }
    }

    return events;
  }

  private isValidPublicKey(pubkey: string): boolean {
    try {
      ProjectivePoint.fromHex(pubkey);
      return true;
    } catch (error) {
      console.error('Invalid public key:', error);
      return false;
    }
  }
}
