import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NostrEvent } from 'nostr-tools/pure';
import { NostrService } from '../../services/nostr.service';
import { MatDialog } from '@angular/material/dialog';
import { PasswordDialogComponent } from '../password-dialog/password-dialog.component';

@Component({
  selector: 'app-messages',
  templateUrl: './messages.component.html',
  styleUrls: ['./messages.component.css'],
})
export class MessagesComponent implements OnInit {
  public recipientPublicKey: string = '';
  public message: string = '';
  public receivedMessages: string[] = [];

  private decryptedSenderPrivateKey: string = '';

  constructor(
    private nostrService: NostrService,
    private route: ActivatedRoute,
    private dialog: MatDialog
  ) { }

  async ngOnInit(): Promise<void> {
    try {
      await this.initializeKeys();
      this.route.paramMap.subscribe((params) => {
        this.recipientPublicKey = params.get('pubkey') || '';
        console.log(this.recipientPublicKey);
      });
      if (this.recipientPublicKey) {
        this.subscribeToMessages();
      } else {
        console.error('Recipient public key is not set.');
      }
    } catch (error) {
      console.error('Error during initialization:', error);
    }
  }

  private async initializeKeys(): Promise<void> {
    const encryptedSenderPrivateKey = localStorage.getItem('nostrSecretKey');
    const publicKey = localStorage.getItem('nostrPublicKey');

    if (encryptedSenderPrivateKey) {
      try {
        const dialogRef = this.dialog.open(PasswordDialogComponent, {
          width: '360px',
          data: { message: 'Please enter password' },
        });

        const password = await dialogRef.afterClosed().toPromise();

        if (password) {
          this.decryptedSenderPrivateKey = await this.nostrService.decryptPrivateKeyWithPassword(encryptedSenderPrivateKey, password);
          console.log('Decrypted Sender Private Key:', this.decryptedSenderPrivateKey);
        } else {
          console.warn('Password was not provided.');
        }
      } catch (error) {
        console.error('Error decrypting private key:', error);
      }
    } else if (publicKey) {
      // Handle other cases (e.g., if public key is present but private key is not)
    } else {
      throw new Error('Encrypted sender private key not found in local storage.');
    }
  }

  public async sendMessage(): Promise<void> {
    try {
        const encryptedSenderPrivateKey = localStorage.getItem('nostrSecretKey');
        const publicKey = localStorage.getItem('nostrPublicKey');

        if (encryptedSenderPrivateKey) {
            await this.handleMessageSendingWithPrivateKey(encryptedSenderPrivateKey);
        } else if (publicKey) {
            await this.handleMessageSendingWithExtension();
        } else {
            console.error('No valid sender credentials found.');
        }
    } catch (error) {
        console.error('Error in sendMessage:', error);
    }
}

private async handleMessageSendingWithPrivateKey(encryptedSenderPrivateKey: string): Promise<void> {
    if (!this.isValidMessageSetup()) {
        console.error('Message, sender private key, or recipient public key is not properly set.');
        return;
    }

    try {
        const encryptedMessage = await this.nostrService.encryptMessage(
            this.decryptedSenderPrivateKey,
            this.recipientPublicKey,
            this.message
        );

        const signedEvent = await this.signMessageEvent(
            encryptedMessage,
            [['p', this.recipientPublicKey]],
            this.nostrService.getUserPublicKey()!
        );

        await this.publishSignedEvent(signedEvent);
    } catch (error) {
        console.error('Error sending message with private key:', error);
    }
}

private async handleMessageSendingWithExtension(): Promise<void> {
    try {
        const encryptedMessage = await this.nostrService.encryptMessageWithExtension(
            this.message,
            this.recipientPublicKey
        );

        const signedEvent = await this.signMessageEventWithExtension(
            encryptedMessage,
            [['p', this.recipientPublicKey]],
            this.nostrService.getUserPublicKey()!
        );

        await this.publishSignedEvent(signedEvent);
    } catch (error) {
        console.error('Error sending message with extension:', error);
    }
}

private async publishSignedEvent(signedEvent: NostrEvent): Promise<void> {
    if (await this.nostrService.publishEventToRelays(signedEvent)) {
        console.log('Message sent successfully!');
        this.message = '';
    } else {
        console.error('Failed to send the message.');
    }
}

private async signMessageEvent(
    encryptedMessage: string,
    tags: string[][],
    pubkey: string
): Promise<NostrEvent> {
    const encryptedSenderPrivateKey = localStorage.getItem('nostrSecretKey');
    if (!encryptedSenderPrivateKey) {
        throw new Error('Encrypted sender private key not found in local storage.');
    }

    try {
        const password = await this.promptForPassword();
        return this.nostrService.signEvent(encryptedMessage, 4, {
            encryptedPrivateKey: encryptedSenderPrivateKey,
            password: password,
            useExtension: false,
            tags: tags,
            pubkey: pubkey,
        });
    } catch (error) {
        console.error('Error signing event:', error);
        throw error;
    }
}

private async promptForPassword(): Promise<string> {
    const dialogRef = this.dialog.open(PasswordDialogComponent, {
        width: '360px',
        data: { message: 'Please enter password' },
    });

    const password = await dialogRef.afterClosed().toPromise();

    if (!password) {
        console.warn('Password was not provided.');
        throw new Error('Password was not provided.');
    }

    return password;
}

private async signMessageEventWithExtension(
    encryptedMessage: string,
    tags: string[][],
    pubkey: string
): Promise<NostrEvent> {
    try {
        return this.nostrService.signEvent(encryptedMessage, 4, {
            encryptedPrivateKey: "",
            password: "",
            useExtension: true,
            tags: tags,
            pubkey: pubkey,
        });
    } catch (error) {
        console.error('Error signing event with extension:', error);
        throw error;
    }
}



  private subscribeToMessages(): void {
    this.nostrService.getKind4MessagesToMe().then(events => {
      events.forEach(async (event: NostrEvent) => {
        if (this.isMessageForRecipient(event)) {
          const decryptedMessage = await this.decryptReceivedMessage(event);
          this.receivedMessages.push(decryptedMessage);
        }
      });
    }).catch(error => {
      console.error('Error subscribing to messages:', error);
    });
  }

  private async decryptReceivedMessage(event: NostrEvent): Promise<string> {
    try {
      const [encryptedMessage, ivBase64] = event.content.split('?iv=');
      return await this.nostrService.decryptMessage(
        this.decryptedSenderPrivateKey,
        event.pubkey,
        encryptedMessage,
      );
    } catch (error) {
      console.error('Error decrypting message:', error);
      return 'Failed to decrypt message.';
    }
  }

  private isValidMessageSetup(): boolean {
    return this.message.trim() !== '' && this.decryptedSenderPrivateKey !== '' && this.recipientPublicKey !== '';
  }

  private isMessageForRecipient(event: NostrEvent): boolean {
    return event.kind === 4 && event.pubkey === this.recipientPublicKey;
  }
}
