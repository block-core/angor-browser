import { Component, OnInit } from '@angular/core';
import { NostrService } from '../../services/nostr.service';

@Component({
  selector: 'app-notifications',
  templateUrl: './notifications.component.html',
  styleUrls: ['./notifications.component.css']
})
export class NotificationsComponent implements OnInit {

  constructor(
     private nostrService: NostrService
  ) {}

  async ngOnInit() {
    
  }


}
