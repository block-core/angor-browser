import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NostrService } from '../../services/nostr.service';
import { MessageService } from '../../services/message.service';
import { NostrEvent } from 'nostr-tools';

@Component({
  selector: 'app-messages',
  templateUrl: './messages.component.html',
  styleUrls: ['./messages.component.css'],
})
export class MessagesComponent implements OnInit {
  messages: NostrEvent[] = [];
  newMessageContent: string = '';
  nostrPubKey: string = '';
  founderMetadata: any = null;
  errorMessage: string = '';

  constructor(
    private route: ActivatedRoute,
    private nostrService: NostrService,
    private messageService: MessageService
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      this.nostrPubKey = params.get('pubkey') || '';
      if (this.nostrPubKey) {
        this.loadFounderMetadata(this.nostrPubKey);
       } else {
        this.errorMessage = 'No public key provided. Unable to load messages.';
      }
    });
  }

  private async loadFounderMetadata(pubkey: string): Promise<void> {
    try {
      this.founderMetadata = await this.nostrService.fetchMetadata(pubkey);
      if (!this.founderMetadata) {
        this.errorMessage = 'No metadata found for the provided public key.';
      }
    } catch (error) {
      console.error('Error fetching founder metadata:', error);
      this.errorMessage = 'Error fetching founder metadata.';
    }
  }


  sendMessage(): void {
    if (!this.newMessageContent.trim()) {
      return; // Do nothing if the message content is empty
    }

    const signingOptions = this.getSigningOptions();

 
  }

  private getSigningOptions() {
    const encryptedPrivateKey = localStorage.getItem('nostrSecretKey');
    const password = prompt('Enter your password:');

    return {
      encryptedPrivateKey: encryptedPrivateKey,
      password: password,
      useExtension: false // Adjust this based on your logic to use extension or not
    };
  }
}
