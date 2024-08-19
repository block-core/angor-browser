import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { NostrService } from './nostr.service';
 import { NostrEvent } from 'nostr-tools';

@Injectable({
  providedIn: 'root',
})
export class MessageService {

  constructor(private nostrService: NostrService) {}



 
}
