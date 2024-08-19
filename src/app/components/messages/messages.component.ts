import { Component, OnInit } from '@angular/core';
import { MessageService } from '../../services/message.service';
 import { NostrEvent } from 'nostr-tools';

@Component({
  selector: 'app-messages',
  templateUrl: './messages.component.html',
  styleUrls: ['./messages.component.css'],
})
export class MessagesComponent implements OnInit {
   messages: NostrEvent[] = [];
   newMessageContent: string = '';

  constructor(private messageService: MessageService) {}

  ngOnInit(): void {




  }




}
