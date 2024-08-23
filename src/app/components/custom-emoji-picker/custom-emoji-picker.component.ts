import { Component, EventEmitter, Output } from '@angular/core';

@Component({
  selector: 'app-custom-emoji-picker',
  templateUrl: './custom-emoji-picker.component.html',
  styleUrls: ['./custom-emoji-picker.component.css']
})
export class CustomEmojiPickerComponent {
  @Output() emojiSelected = new EventEmitter<string>();

  emojis: string[] = [
    '😀', '😃', '😄', '😁', '😆',
    '😅', '😂', '🤣', '😊', '😇',
    '🙂', '🙃', '😉', '😌', '😍',
    '🥰', '😘', '😗', '😙', '😚'
    // Add more emojis here
  ];

  selectEmoji(emoji: string): void {
    this.emojiSelected.emit(emoji);
  }
}
