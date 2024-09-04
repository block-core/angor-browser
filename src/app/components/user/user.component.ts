import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
 import { NostrEvent } from 'nostr-tools';
import { NostrService } from '../../services/nostr.service';

@Component({
  selector: 'app-user',
  templateUrl: './user.component.html',
  styleUrls: ['./user.component.css'],
})
export class UserComponent implements OnInit {
  public userMetadata: any = null;
  public userEvents: NostrEvent[] = [];
  public pubkey: string = '';
  public errorMessage: string = '';
  public isLoading: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private nostrService: NostrService
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      this.pubkey = params.get('id') || '';
      if (this.pubkey) {
        this.loadUserData(this.pubkey);
      } else {
        this.errorMessage = 'Invalid public key.';
      }
    });
  }

  private async loadUserData(pubkey: string): Promise<void> {
    this.isLoading = true;
    try {
      // Fetch metadata of the user
      const metadata = await this.nostrService.fetchMetadata(pubkey);
      this.userMetadata = metadata;

      // Fetch events of the user
      const events = await this.nostrService.getEventsByAuthor(pubkey);
      this.userEvents = events;

      this.isLoading = false;
    } catch (error) {
      this.errorMessage = 'Error fetching user data. Please try again later.';
      console.error('Error fetching user data:', error);
      this.isLoading = false;
    }
  }
}
