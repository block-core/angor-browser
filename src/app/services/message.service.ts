import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { NostrService } from './nostr.service';
import { User } from '../../models/user.model';
import { NostrEvent } from 'nostr-tools';

@Injectable({
  providedIn: 'root',
})
export class MessageService {
  private chatUsers = new BehaviorSubject<User[]>([]);
  private messages = new BehaviorSubject<NostrEvent[]>([]);
  private unreadMessagesCount = new BehaviorSubject<number>(0);

  constructor(private nostrService: NostrService) {}

  async loadChatUsers(): Promise<void> {
    const messages = await this.nostrService.getKind4MessagesToMe();
    const users: User[] = [];
    messages.forEach(msg => {
      const pubkey = msg.pubkey;
      const user = users.find(u => u.nostrPubKey === pubkey);
      if (!user) {
        users.push({ nostrPubKey: pubkey } as User);
      }
    });
    this.chatUsers.next(users);
  }

  async loadMessages(): Promise<void> {
    const messages = await this.nostrService.getKind4MessagesToMe();
    this.messages.next(messages);
  }

  async getUnreadMessagesCount(): Promise<void> {
   }

  getChatUsers() {
    return this.chatUsers.asObservable();
  }

  getMessages() {
    return this.messages.asObservable();
  }

  getUnreadMessagesCount1() {
    return this.unreadMessagesCount.asObservable();
  }

  async sendMessage(receiverPubKey: string, content: string): Promise<void> {
    const event = this.nostrService.createEvent(content);
    await this.nostrService.publishEventToRelays(event);
    await this.loadMessages(); // Reload messages after sending
  }

  async loadChatHistory(): Promise<void> {
    const users = await this.nostrService.getUsers();
    const chatHistories = await Promise.all(users.map(async user => {
      const messages = await this.nostrService.getKind4MessagesToMe();
      return { user, messages };
    }));
    this.chatUsers.next(users);
    this.messages.next(chatHistories.flatMap(chat => chat.messages));
  }
}
