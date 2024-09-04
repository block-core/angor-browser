import { Component, OnInit } from '@angular/core';
import { NostrEventWithMetadata, NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-notifications',
  templateUrl: './notifications.component.html',
  styleUrls: ['./notifications.component.css']
})
export class NotificationsComponent implements OnInit {
  public notifications: NostrEventWithMetadata[] = [];

  constructor(
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.notifications = this.notificationService.getNotifications();
    this.notificationService.resetNotificationCount(); // Reset count and update timestamp when entering the component
  }

}
