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
  private dialogRef: any;

  constructor(
    private nostrService: NostrService,
    private route: ActivatedRoute,
    private dialog: MatDialog
  ) {}

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
      this.dialogRef = this.dialog.open(PasswordDialogComponent, {
        width: '350px',
        data: { message: 'Please enter your password to decrypt the private key' },
      });

      const password = await this.dialogRef.afterClosed().toPromise();

      if (password) {
        this.decryptedSenderPrivateKey = await this.nostrService.decryptPrivateKeyWithPassword(encryptedSenderPrivateKey, password);
        console.log('Decrypted Sender Private Key:', this.decryptedSenderPrivateKey);
      } else {
        throw new Error('Password was not provided.');
      }
    }
    else if (publicKey){
    //TODO
    }
     else {
      throw new Error('Encrypted sender private key not found in local storage.');
    }
  }

  public async sendMessage(): Promise<void> {
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

      const tags = [['p', this.recipientPublicKey]];
      const pubkey = this.nostrService.getUserPublicKey()!;

      const signedEvent = await this.signMessageEvent(encryptedMessage, tags, pubkey);
      console.log('Event:', signedEvent);

       if (await this.nostrService.publishEventToRelays(signedEvent)) {
        console.log('Message sent successfully!');
        this.message = '';
      } else {
        console.error('Failed to send the message.');
      }
    } catch (error) {
      console.error('Error sending message:', error);
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

    this.dialogRef = this.dialog.open(PasswordDialogComponent, {
      width: '350px',
      data: { message: 'Please enter your password to sign the event' },
    });

    const password = await this.dialogRef.afterClosed().toPromise();

    if (password) {
      return this.nostrService.signEvent(encryptedMessage, 4, {
        encryptedPrivateKey: encryptedSenderPrivateKey,
        password: password,
        useExtension: false,
        tags: tags,
        pubkey: pubkey,
      });
    } else {
      throw new Error('Password was not provided.');
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
