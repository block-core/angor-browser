import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { getPublicKey, nip19 } from 'nostr-tools';
import { SecurityService } from '../../../services/security.service';

@Component({
  selector: 'app-privatekey',
  templateUrl: './privatekey.component.html',
  styleUrls: ['./privatekey.component.css'],
})
export class PrivatekeyComponent {
  privateKey: string = '';
  privateKeyHex: string = '';
  publicKey: string = '';
  publicKeyHex: string = '';
  password: string = '';
  errorMessage: string = '';
  successMessage: string = '';

  constructor(private router: Router, private security: SecurityService) {}

  async onSubmit() {
    try {
      this.updatePrivateKeyHex();
      this.updatePublicKey();

      if (!this.privateKeyHex || !this.publicKeyHex) {
        throw new Error('Private or public key is missing.');
      }

      const encrypted = await this.security.encryptData(this.privateKeyHex, this.password);
      const decrypted = await this.security.decryptData(encrypted, this.password);

      if (this.privateKeyHex !== decrypted) {
        throw new Error('Encryption/Decryption failed.');
      }

      localStorage.setItem('nostrPublicKey', this.publicKeyHex);
      localStorage.setItem('nostrSecretKey', encrypted);

      this.successMessage = 'Keys successfully saved!';
      this.errorMessage = '';
      this.router.navigate(['/profile']);
    } catch (error) {
      this.errorMessage = (error instanceof Error) ? error.message : 'An unexpected error occurred. Please try again.';
      this.successMessage = '';
      console.error('Error processing private key:', error);
    }
  }

  updatePrivateKeyHex() {
    try {
      this.errorMessage = '';
      this.privateKeyHex = '';

      if (!this.privateKey) {
        throw new Error('Private key is required.');
      }

      if (this.privateKey.startsWith('npub')) {
        throw new Error('The key value must be a "nsec" value. You entered "npub", which is your public key.');
      }

      if (this.privateKey.startsWith('nsec')) {
        const decoded = nip19.decode(this.privateKey);
        this.privateKeyHex = decoded.data as string;
        console.log(this.privateKeyHex);

      } else if (/^[0-9a-fA-F]{64}$/.test(this.privateKey)) {
        this.privateKeyHex = this.privateKey;
      } else {
        throw new Error('Invalid private key format. Please enter a valid hex or nsec key.');
      }
    } catch (err: any) {
      this.errorMessage = err.message;
      console.error('Error updating private key hex:', err);
    }
  }

  updatePublicKey() {
    try {
      this.errorMessage = '';
      this.publicKey = '';
      this.publicKeyHex = '';

      if (!this.privateKeyHex) {
        throw new Error('Private key is not available to generate public key.');
      }

      // Convert hex string to Uint8Array
      const privateKeyUint8Array = new Uint8Array(
        this.privateKeyHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
      );

      this.publicKeyHex = getPublicKey(privateKeyUint8Array);
      this.publicKey = nip19.npubEncode(this.publicKeyHex);
    } catch (err: any) {
      this.errorMessage = err.message;
      console.error('Error generating public key:', err);
    }
  }

  reset() {
    this.privateKey = '';
    this.privateKeyHex = '';
    this.publicKey = '';
    this.publicKeyHex = '';
    this.password = '';
    this.errorMessage = '';
    this.successMessage = '';
  }
}
