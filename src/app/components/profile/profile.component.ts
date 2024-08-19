import { Component, OnInit } from '@angular/core';
import { NostrService } from '../../services/nostr.service';
import { Router } from '@angular/router';
import { NostrEvent } from 'nostr-tools';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css'],
})
export class ProfileComponent implements OnInit {
  publicKey = '';
  metadata: any = null;
  isLoading = true;
  errorMessage: string | null = null;
  events: NostrEvent[] = [];
  followers: any[] = [];
  following: any[] = [];
   constructor(private nostrService: NostrService, private router: Router) {}

  ngOnInit() {
    this.loadPublicKey();
    if (!this.publicKey) {
      this.router.navigate(['/home']);
    } else {
      this.loadProfileData();
    }
  }

  private loadPublicKey() {
    this.publicKey = localStorage.getItem('nostrPublicKey') || '';
  }

  private async loadProfileData() {
    try {
      this.metadata = await this.nostrService.fetchMetadata(this.publicKey);
      this.followers = await this.nostrService.getFollowers(this.publicKey);
      this.following = await this.nostrService.getFollowing(this.publicKey);
      this.events = await this.nostrService.getEventsByAuthor(this.publicKey);
      this.isLoading = false;
    } catch (error) {
      this.errorMessage = 'Failed to load profile data.';
      this.isLoading = false;
    }
  }

  editProfile() {
    this.router.navigate(['/edit-profile']);
  }
}
