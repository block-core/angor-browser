import { Component, OnInit } from '@angular/core';
import { NostrService } from '../../services/nostr.service';
import { NostrEvent } from 'nostr-tools';

@Component({
  selector: 'app-notifications',
  templateUrl: './notifications.component.html',
  styleUrls: ['./notifications.component.css']
})
export class NotificationsComponent implements OnInit {
  public notifications: NostrEvent[] = [];

  constructor(
     private nostrService: NostrService
  ) {}

  ngOnInit(): void {
    const pubkey = this.nostrService.getUserPublicKey();
    if (pubkey) {
      this.nostrService.subscribeToNotifications(pubkey);
      this.nostrService.getNotificationStream().subscribe((notification) => {
        this.notifications.unshift(notification); // Display the notification
      });
    }
  }


}




