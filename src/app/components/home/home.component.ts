import { Component, OnInit } from '@angular/core';
import { NostrService } from '../../services/nostr.service';
import { NostrEvent } from 'nostr-tools';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
})
export class HomeComponent implements OnInit {
  public events: NostrEvent[] = [];
  private processedEventIds: Set<string> = new Set(); // Track processed event IDs

  constructor(private nostrService: NostrService) {}

  ngOnInit(): void {
    const pubkey = this.nostrService.getUserPublicKey();
    if (pubkey) {
      this.nostrService.subscribeToMyEventsAndFollowing(pubkey);
      this.nostrService.getEventStream().subscribe((event) => {
        if (!this.processedEventIds.has(event.id)) {
          this.processedEventIds.add(event.id);
          this.events.unshift(event); // Add new events at the top
        }
      });
    }
  }
}
