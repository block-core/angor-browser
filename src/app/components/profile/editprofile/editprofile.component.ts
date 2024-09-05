import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { NostrService } from '../../../services/nostr.service';
import { PasswordDialogComponent } from '../../../shared/password-dialog/password-dialog.component';
import { NostrEvent } from 'nostr-tools';

@Component({
  selector: 'app-editprofile',
  templateUrl: './editprofile.component.html',
  styleUrls: ['./editprofile.component.css'],
})
export class EditProfileComponent implements OnInit {
  name: string = '';
  about: string = '';
  picture: string = '';

  constructor(
    private nostrService: NostrService,
    private router: Router,
    private dialog: MatDialog
  ) { }

  ngOnInit() {
    const publicKey = localStorage.getItem('nostrPublicKey');
    if (publicKey) {
      this.nostrService.fetchMetadata(publicKey).then((metadata) => {
        this.name = metadata.name || '';
        this.about = metadata.about || '';
        this.picture = metadata.picture || '';
      });
    }
  }

  onSubmit() {
    const content = JSON.stringify({
      name: this.name,
      about: this.about,
      picture: this.picture,
    });
    const kind = 0;

     const tags: string[][] = [];
    const pubkey = '';

    this.signAndHandleEvent(content, kind, tags, pubkey, (signedEvent) => {
      this.nostrService.publishEventToRelays(signedEvent)
        .then(() => {
          this.router.navigate(['/profile'], { replaceUrl: true });
        })
        .catch((error) => console.error('Failed to publish event:', error));
    });
  }


  private signAndHandleEvent(
    content: string,
    kind: number,
    tags: string[][],
    pubkey: string,
    callback: (signedEvent: NostrEvent) => void
  ): void {
    const publicKey = localStorage.getItem('nostrPublicKey');
    const encryptedPrivateKey = localStorage.getItem('nostrSecretKey');

    if (publicKey && encryptedPrivateKey) {
      const dialogRef = this.dialog.open(PasswordDialogComponent, {
        width: '420px',
        panelClass: 'custom-dialog-container',
        maxHeight: '90vh',
        height: 'auto',
        data: { message: 'Please enter password' },
      });
      document.body.classList.add('dialog-open');
      dialogRef.afterClosed().subscribe((password) => {
        if (password) {
          const options = {
            encryptedPrivateKey: encryptedPrivateKey,
            password: password,
            useExtension: false,
            tags: tags,
            pubkey: pubkey,
          };

          this.nostrService
            .signEvent(content, kind, options)
            .then(callback)
            .catch((error) => this.handleError(error, 'Error signing event.'));
            document.body.classList.remove('dialog-open');
        }
      });
    } else if (publicKey) {
      this.nostrService
        .signEventWithExtension(content, kind, tags, pubkey)
        .then(callback)
        .catch((error) => this.handleError(error, 'Error signing event with extension.'));
    } else {
      console.error('No public key found. Please ensure you are logged in.');
    }
  }

  private handleError(error: any, message: string) {
    console.error(message, error);
  }
}
