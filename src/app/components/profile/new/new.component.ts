import { Component, OnInit } from '@angular/core';
import { NostrService } from '../../../services/nostr.service';
 import { NostrEvent } from 'nostr-tools/pure';
import * as secp256k1 from '@noble/secp256k1';
import { sha256 } from '@noble/hashes/sha256';
import { User } from '../../../../models/user.model';
import { RelayService } from '../../../services/relay.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-new-account',
  templateUrl: './new.component.html',
  styleUrls: ['./new.component.css'],
})
export class NewComponent implements OnInit {
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

  constructor(public nostrService: NostrService,public relayService: RelayService, private router:Router) {}

  ngOnInit() {
   }



  generateNewAccount() {
    const keys = this.nostrService.generateNewAccount();
    this.publicKey = keys.publicKey;
    this.secretKeyHex = keys.secretKeyHex;

    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('nostrPublicKey', keys.publicKey);
      localStorage.setItem('nostrSecretKey', keys.secretKeyHex);
    }

    this.isAuthenticated = true;
    this.accountType = 'new';

    this.router.navigate(['/profile']);

  }

}
