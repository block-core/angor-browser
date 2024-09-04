import { Component, OnInit } from '@angular/core';
import { NostrService } from '../../services/nostr.service';
import { Router } from '@angular/router';
import { PasswordDialogComponent } from '../password-dialog/password-dialog.component';
import { MatDialog } from '@angular/material/dialog';

@Component({
  selector: 'app-messages',
  templateUrl: './messages.component.html',
  styleUrls: ['./messages.component.css']
})
export class MessagesComponent implements OnInit {
  public chatList: {
    pubKey: string;
    lastMessage: string;
    lastMessageTime: number;
    metadata?: any;
  }[] = [];
  private decryptedSenderPrivateKey: string = '';

  constructor(private nostrService: NostrService, private router: Router, private dialog: MatDialog) { }


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

  async ngOnInit(): Promise<void> {

    await this.initializeKeys();
    const pubkey = this.nostrService.getUserPublicKey();
    const useExtension = !localStorage.getItem('nostrSecretKey');
    if (pubkey) {
      this.nostrService.subscribeToChatList(pubkey, useExtension, this.decryptedSenderPrivateKey);
      this.nostrService.getChatListStream().subscribe((chatList) => {
        this.chatList = chatList;
        console.log('Updated Chat List:', this.chatList);
      });
    }
  }

  goToChat(pubKey: string): void {
    this.router.navigate([`/messages/${pubKey}`]);
  }
}
