import { Component, OnInit } from '@angular/core';
import { NostrService } from '../../../services/nostr.service';
 import { NostrEvent } from 'nostr-tools/pure';
import * as secp256k1 from '@noble/secp256k1';
import { sha256 } from '@noble/hashes/sha256';
import { User } from '../../../../models/user.model';
import { RelayService } from '../../../services/relay.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-extension',
  templateUrl: './extension.component.html',
  styleUrls: ['./extension.component.css'],
})
export class ExtensionComponent implements OnInit {
  publicKey: string = '';
  secretKeyHex: string = '';
  eventContent: string = '';
  newRelayUrl: string = '';
  connectionStatus: string = '';
  connectButtonText: string = 'Connect to Relays';
  events: NostrEvent[] = [];
  relays: any[] = [];
  followers: User[] = [];
  following: User[] = [];
  nostrExtensionPublicKey: string = '';
  nostrPublicKey: string = '';
  nostrSignedEvent: any;
  nostrCipher: string | null = null;
  nostrDecrypted: string | null = null;
  isAuthenticated: boolean = false;
  accountType: string = '';
  publishedEventContent: string = '';
  metadata: any = null;

  constructor(public nostrService: NostrService,public relayService: RelayService , private router:Router) {}

  ngOnInit() {
   }

  loginWithNostrExtension() {
    this.connectNostrExtension();
  }

  async connectNostrExtension() {
    try {
      const gt = globalThis as any;
      const publicKey = await gt.nostr.getPublicKey();
      const metadata = await this.nostrService.fetchMetadata(publicKey);

      this.nostrExtensionPublicKey = publicKey;
      this.nostrPublicKey = publicKey;
      this.metadata = metadata;

       if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem('nostrPublicKey', publicKey);
        localStorage.removeItem('nostrSecretKey');
      }

      this.isAuthenticated = true;
      this.publicKey = publicKey;

       this.router.navigate(['/profile']);

     } catch (error) {
      console.error('Failed to connect to Nostr extension:', error);
    }
  }


}
