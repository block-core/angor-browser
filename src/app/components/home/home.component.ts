import { Component, OnInit } from '@angular/core';
import { NostrService } from '../../services/nostr.service';
import { NostrEvent } from 'nostr-tools';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

interface EventWithMetadata {
  event: NostrEvent;
  metadata: any;
  safeContent: SafeHtml;
}

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
})
export class HomeComponent implements OnInit {
  public eventsWithMetadata: EventWithMetadata[] = [];
  private processedEventIds: Set<string> = new Set(); // Track processed event IDs

  constructor(private nostrService: NostrService, private sanitizer: DomSanitizer) {}

  ngOnInit(): void {
    const pubkey = this.nostrService.getUserPublicKey();
    if (pubkey) {
      this.nostrService.subscribeToMyEvents(pubkey);
      this.nostrService.getEventStream().subscribe(async (event) => {
        if (!this.processedEventIds.has(event.id)) {
          this.processedEventIds.add(event.id);
          const metadata = await this.nostrService.fetchMetadata(event.pubkey);
          const safeContent = this.sanitizer.bypassSecurityTrustHtml(this.parseContent(event.content));
          this.eventsWithMetadata.unshift({ event, metadata, safeContent }); // Add new events with metadata at the top
        }
      });
    }
  }

  parseContent(content: string): string {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return content.replace(urlRegex, (url) => {
      if (url.match(/\.(jpeg|jpg|gif|png)$/) != null) {
        return `<img src="${url}" alt="Image" width="100%" style="max-width: 100%; border-radius: 5px;">`;
      } else if (url.match(/\.(mp4|webm)$/) != null) {
        return `<video controls width="100%" style="max-width: 100%; border-radius: 5px;"><source src="${url}" type="video/mp4">Your browser does not support the video tag.</video>`;
      } else if (url.match(/(youtu\.be\/|youtube\.com\/watch\?v=)/)) {
        let videoId = url.split('v=')[1] || url.split('youtu.be/')[1];
        const ampersandPosition = videoId.indexOf('&');
        if (ampersandPosition !== -1) {
          videoId = videoId.substring(0, ampersandPosition);
        }
        return `<iframe width="100%" height="315" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen></iframe>`;
      } else {
        return `<a href="${url}" target="_blank" style="color: #007bff;">${url}</a>`;
      }
    }).replace(/\n/g, '<br>');
  }
}
