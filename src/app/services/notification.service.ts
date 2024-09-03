import { Injectable } from '@angular/core';
 import { NostrService } from './nostr.service';
import { BehaviorSubject, Observable } from 'rxjs';
import { NostrEvent } from 'nostr-tools';


export interface NostrEventWithMetadata extends NostrEvent {
  metadata?: {
    name?: string;
    picture?: string;
  };
}


@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private notificationCount = new BehaviorSubject<number>(0);
  private notifications: NostrEventWithMetadata[] = [];
  private lastNotificationTimestamp: number | null = null;

  constructor(private nostrService: NostrService) {
    this.loadNotificationData();
    this.subscribeToNotifications();
  }

  private loadNotificationData(): void {
    const storedCount = localStorage.getItem('notificationCount');
    this.notificationCount.next(storedCount ? parseInt(storedCount, 10) : 0);

    const storedTimestamp = localStorage.getItem('lastNotificationTimestamp');
    this.lastNotificationTimestamp = storedTimestamp ? parseInt(storedTimestamp, 10) : null;
  }

  private saveNotificationData(count: number, timestamp: number): void {
    localStorage.setItem('notificationCount', count.toString());
    localStorage.setItem('lastNotificationTimestamp', timestamp.toString());
  }

  private subscribeToNotifications(): void {
    const pubkey = this.nostrService.getUserPublicKey();
    if (pubkey) {
      this.nostrService.subscribeToNotifications(pubkey);
      this.nostrService.getNotificationStream().subscribe((notification) => {
        const notificationWithMetadata: NostrEventWithMetadata = { ...notification };

        // Display all notifications
        this.notifications.unshift(notificationWithMetadata);

        // Fetch metadata for each notification in parallel
        this.fetchMetadataForNotification(notificationWithMetadata);

        // Only count notifications received after the last reset
        if (!this.lastNotificationTimestamp || notification.created_at > this.lastNotificationTimestamp) {
          this.incrementNotificationCount(notification.created_at);
        }
      });
    }
  }

  private fetchMetadataForNotification(notification: NostrEventWithMetadata): void {
    this.nostrService.fetchMetadata(notification.pubkey).then((metadata) => {
      notification.metadata = metadata;
    }).catch((error) => {
      console.error(`Error fetching metadata for pubkey ${notification.pubkey}:`, error);
    });
  }

  private incrementNotificationCount(timestamp: number): void {
    const newCount = this.notificationCount.value + 1;
    this.notificationCount.next(newCount);
    this.saveNotificationData(newCount, timestamp);
  }

  public resetNotificationCount(): void {
    this.notificationCount.next(0);
    const currentTimestamp = Date.now() / 1000; // Use seconds
    this.lastNotificationTimestamp = currentTimestamp;
    this.saveNotificationData(0, currentTimestamp);
  }

  public getNotificationCount(): Observable<number> {
    return this.notificationCount.asObservable();
  }

  public getNotifications(): NostrEventWithMetadata[] {
    return this.notifications;
  }
}
