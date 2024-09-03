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
