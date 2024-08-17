import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { privateKeyFromSeedWords, accountFromSeedWords } from 'nostr-tools/nip06';
import { SecurityService } from '../../../services/security.service';

@Component({
  selector: 'app-menemonic',
  templateUrl: './menemonic.component.html',
  styleUrls: ['./menemonic.component.css'],
})
export class MenemonicComponent {
  mnemonic: string = '';
  passphrase: string = '';
  privateKey: string = '';
  publicKey: string = '';
  errorMessage: string = '';
  successMessage: string = '';

  constructor(private router: Router, private security: SecurityService) {}

  async onSubmit() {
    try {
      this.errorMessage = '';
      const accountIndex = 0; // You can change the index if needed
      this.privateKey = privateKeyFromSeedWords(this.mnemonic, this.passphrase, accountIndex);

      const { publicKey } = accountFromSeedWords(this.mnemonic, this.passphrase, accountIndex);
      this.publicKey = publicKey;

      const encrypted = await this.security.encryptData(this.privateKey, this.passphrase);
      const decrypted = await this.security.decryptData(encrypted, this.passphrase);

      if (this.privateKey !== decrypted) {
        throw new Error('Encryption/Decryption failed.');
      }

      localStorage.setItem('nostrPublicKey', this.publicKey);
      localStorage.setItem('nostrSecretKey', encrypted);

      this.successMessage = 'Keys successfully generated and saved!';
      this.errorMessage = '';
      this.router.navigate(['/profile']);
    } catch (error) {
      this.errorMessage = (error instanceof Error) ? error.message : 'An unexpected error occurred. Please try again.';
      this.successMessage = '';
      console.error('Error processing mnemonic:', error);
    }
  }

  reset() {
    this.mnemonic = '';
    this.passphrase = '';
    this.privateKey = '';
    this.publicKey = '';
    this.errorMessage = '';
    this.successMessage = '';
  }
}
