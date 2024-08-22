import { Component, OnInit } from '@angular/core';
import { NostrService } from '../../../services/nostr.service';
import { RelayService } from '../../../services/relay.service';
import { Router } from '@angular/router';
import { SecurityService } from '../../../services/security.service';
import { NostrEvent } from 'nostr-tools/pure';

@Component({
  selector: 'app-new-account',
  templateUrl: './new.component.html',
  styleUrls: ['./new.component.css'],
})
export class NewComponent implements OnInit {
  publicKey: string = '';
  privateKeyHex: string = '';
  password: string = '';
  name: string = '';
  about: string = '';
  nostrDecrypted: string | null = null;
  isAuthenticated: boolean = false;
  errorMessage: string = '';
  encryptedSecretKey: string = '';

  constructor(
    public nostrService: NostrService,
    public relayService: RelayService,
    private router: Router,
    private security: SecurityService
  ) {}

  ngOnInit() {}

  async generateNewAccount() {
    try {
      const keys = this.nostrService.generateNewAccount();
      this.publicKey = keys.publicKey;
      this.privateKeyHex = keys.secretKeyHex;

      if (!this.password) {
        throw new Error('Password is required.');
      }
      const encrypted = await this.security.encryptData(this.privateKeyHex, this.password);
      const decrypted = await this.security.decryptData(encrypted, this.password);

      if (this.privateKeyHex !== decrypted) {
        throw new Error('Encryption/Decryption failed.');
      }

      this.encryptedSecretKey = await this.security.encryptData(this.privateKeyHex, this.password);

      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem('nostrPublicKey', keys.publicKey);
        localStorage.setItem('nostrSecretKey', this.encryptedSecretKey);
      }

      await this.updateMetadata();

      this.isAuthenticated = true;
      this.errorMessage = '';
      this.router.navigate(['/profile']);
    } catch (error) {
      this.errorMessage = (error instanceof Error) ? error.message : 'An unexpected error occurred. Please try again.';
      console.error('Error generating new account:', error);
    }
  }

  async updateMetadata() {
    try {
      const metadata: NostrEvent = {
        kind: 0,
        pubkey: this.publicKey,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
         content: JSON.stringify({
          name: this.name,
          about: this.about,
        }),
        id: '',
        sig: '',
      };

      const options = {
        encryptedPrivateKey: this.encryptedSecretKey,
        password: this.password,
        useExtension: false,
        tags: metadata.tags,
        pubkey: this.publicKey,
      };

       const signedMetadata = await this.nostrService.signEvent(metadata.content, 0, options);

       await this.nostrService.publishEventToRelays(signedMetadata);
    } catch (error) {
      console.error('Error updating metadata:', error);
      throw new Error('Failed to update metadata.');
    }
  }

}
