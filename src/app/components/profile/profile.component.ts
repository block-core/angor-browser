import { Component, OnInit, OnDestroy } from '@angular/core';
import { NostrService } from '../../services/nostr.service';
import { Router, NavigationEnd } from '@angular/router';
import { Subscription } from 'rxjs';
import { RelayService } from '../../services/relay.service';
import { NostrEvent } from 'nostr-tools';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css'],
})
export class ProfileComponent implements OnInit, OnDestroy {
  publicKey = '';
  metadata: any = null;
  isLoading = true;
  errorMessage: string | null = null;
  events: NostrEvent[] = [];
  followers: any[] = [];
  following: any[] = [];
  private routerSubscription: Subscription = Subscription.EMPTY;
  private eventSubscription: Subscription = Subscription.EMPTY;

  constructor(
    private nostrService: NostrService,
    private relayService: RelayService,
    private router: Router
  ) {}

  ngOnInit() {
    this.routerSubscription = this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd && event.urlAfterRedirects === '/profile') {
        this.loadProfileData(); // Initial load
      }
    });

    this.eventSubscription = this.relayService.getEventStream().subscribe((event) => {
      this.handleRealTimeUpdates(event); // Handle WebSocket events
    });

    this.loadPublicKey();
    if (this.publicKey) {
      this.loadProfileData();
    } else {
      this.router.navigate(['/home']);
    }
  }

  ngOnDestroy() {
    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
    }
    if (this.eventSubscription) {
      this.eventSubscription.unsubscribe();
    }
  }

  private loadPublicKey(): void {
    this.publicKey = localStorage.getItem('nostrPublicKey') || '';
  }

  private async loadProfileData(): Promise<void> {
    this.isLoading = true;
    this.errorMessage = null;

    try {
      const [metadata, followers, following, events] = await Promise.all([
        this.nostrService.fetchMetadata(this.publicKey),
        this.nostrService.getFollowers(this.publicKey),
        this.nostrService.getFollowing(this.publicKey),
        this.nostrService.getEventsByAuthor(this.publicKey),
      ]);

      this.metadata = metadata;
      this.followers = followers;
      this.following = following;
      this.events = events;
    } catch (error) {
      console.error('Failed to load profile data:', error);
      this.errorMessage = 'Failed to load profile data. Please try again later.';
    } finally {
      this.isLoading = false;
    }
  }

  private handleRealTimeUpdates(event: NostrEvent): void {
    if (event.pubkey === this.publicKey) {
      switch (event.kind) {
        case 0:
          // Profile metadata update
          this.updateMetadata(event);
          break;
        case 1:
          // New event (post, comment, etc.)
          this.events.unshift(event); // Add the new event to the beginning of the list
          break;
        case 3:
          // Followers or following update
          this.updateFollowersOrFollowing(event);
          break;
        // Handle other kinds of events as necessary
      }
    }
  }

  private updateMetadata(event: NostrEvent): void {
    try {
      const updatedMetadata = JSON.parse(event.content);
      this.metadata = {
        ...this.metadata,
        ...updatedMetadata,
      };
    } catch (error) {
      console.error('Failed to parse metadata update:', error);
    }
  }

  private updateFollowersOrFollowing(event: NostrEvent): void {
    if (event.tags.some(tag => tag.includes(this.publicKey))) {
      this.loadProfileData(); // Reload followers and following lists if they are updated
    }
  }

  editProfile(): void {
    this.router.navigate(['/profile/editprofile']);
  }
}
