import { Component, OnInit, AfterViewChecked, ElementRef, ViewChild, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NostrEvent } from 'nostr-tools/pure';
import { NostrService } from '../../services/nostr.service';
import { MatDialog } from '@angular/material/dialog';
import { PasswordDialogComponent } from '../password-dialog/password-dialog.component';

interface CustomMessageEvent {
  isSentByUser: boolean;
  decryptedMessage: string;
  createdAt: number;
}

@Component({
  selector: 'app-messages',
  templateUrl: './messages.component.html',
  styleUrls: ['./messages.component.css'],
})
export class MessagesComponent implements OnInit, AfterViewChecked {
  @ViewChild('chatMessagesContainer') private chatMessagesContainer!: ElementRef;

  public message: string = '';
  private isUserScrolling: boolean = false;

  public messages: CustomMessageEvent[] = [];
  public recipientPublicKey: string = '';
  private decryptedSenderPrivateKey: string = '';
  public isEmojiPickerVisible = false;
  public recipientMetadata: any;

  public customEmojis: string[] = [
    '😀', '😁', '😂', '🥰', '😎', '🤩', '😢', '😡', '👍', '👎', '🙏', '👏', '❤️', '💔', '🎉', '🔥', '🌟', '🍀', '🎁', '⚽'
  ];

  constructor(
    private nostrService: NostrService,
    private route: ActivatedRoute,
    private dialog: MatDialog,
    private cdRef: ChangeDetectorRef
  ) { }

  async ngOnInit(): Promise<void> {
    try {
      await this.initializeKeys();
      this.route.paramMap.subscribe((params) => {
        this.recipientPublicKey = params.get('pubkey') || '';
        this.fetchRecipientMetadata();
        console.log(this.recipientPublicKey);
        if (this.recipientPublicKey) {
          this.subscribeToMessages();
        } else {
          console.error('Recipient public key is not set.');
        }
      });

      this.chatMessagesContainer.nativeElement.addEventListener('scroll', () => {
        const { scrollTop, scrollHeight, clientHeight } = this.chatMessagesContainer.nativeElement;
        const isAtBottom = scrollHeight === scrollTop + clientHeight;
        this.isUserScrolling = !isAtBottom;
      });

    } catch (error) {
      console.error('Error during initialization:', error);
    }
  }
  private async fetchRecipientMetadata(): Promise<void> {
    try {
      this.recipientMetadata = await this.nostrService.fetchMetadata(this.recipientPublicKey);
      console.log('Recipient Metadata:', this.recipientMetadata);
    } catch (error) {
      console.error('Error fetching recipient metadata:', error);
    }
  }
  ngAfterViewChecked() {
    if (!this.isUserScrolling) {
      this.cdRef.detectChanges();
      this.scrollToBottom();
    }
  }

  private scrollToBottom(): void {
    try {
      setTimeout(() => {
        const container = this.chatMessagesContainer.nativeElement;
        container.scrollTop = container.scrollHeight;
        this.cdRef.detectChanges();
      }, 100);
    } catch (err) {
      console.error('Error scrolling to bottom:', err);
    }
  }

  private async subscribeToMessages(): Promise<void> {
    try {
      const useExtension = !localStorage.getItem('nostrSecretKey');
      const publicKey = localStorage.getItem('nostrPublicKey')!;

      this.nostrService.subscribeToKind4Messages(publicKey, this.recipientPublicKey, useExtension, this.decryptedSenderPrivateKey);

      this.nostrService.getMessageStream().subscribe(({ decryptedMessage, isSentByUser, createdAt }) => {
        this.messages.push({ decryptedMessage, isSentByUser, createdAt });
        this.messages.sort((a, b) => a.createdAt - b.createdAt);
        if (!this.isUserScrolling) {
          this.scrollToBottom();
        }
      });

    } catch (error) {
      console.error('Error subscribing to messages:', error);
    }
  }

  public toggleEmojiPicker(): void {
    this.isEmojiPickerVisible = !this.isEmojiPickerVisible;
  }

  public addEmoji(emoji: string): void {
    this.message += emoji;
    this.isEmojiPickerVisible = false;
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
      this.scrollToBottom();

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

  public isSentByUser(msg: CustomMessageEvent): boolean {
    return msg.isSentByUser;
  }

  private isValidMessageSetup(): boolean {
    return this.message.trim() !== '' && this.decryptedSenderPrivateKey !== '' && this.recipientPublicKey !== '';
  }

  isRTL(text: string): boolean {
    const rtlChars = /[\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC]/;
    return rtlChars.test(text);
  }

}
