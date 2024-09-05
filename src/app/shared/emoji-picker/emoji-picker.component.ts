import { Component, Output, EventEmitter, OnInit } from '@angular/core';
import { EmojiService } from '../../services/emoji.service';

@Component({
  selector: 'app-emoji-picker',
  templateUrl: './emoji-picker.component.html',
  styleUrls: ['./emoji-picker.component.css'],
})
export class EmojiPickerComponent implements OnInit {
  @Output() emojiSelected = new EventEmitter<string>();
  public emojiSearch: string = '';
  public emojiCategories: { [key: string]: { name: string, emoji: string }[] } = {};
  public loading: boolean = true;

  constructor(private emojiService: EmojiService) {}

  ngOnInit(): void {
    this.emojiService.getEmojis().subscribe(
      (data) => {
        this.emojiCategories = this.formatEmojis(data);
        this.loading = false;
      },
      (error) => {
        console.error('Error loading emoji data', error);
        this.loading = false;
      }
    );
  }

  formatEmojis(data: any): { [key: string]: { name: string, emoji: string }[] } {
    const formattedCategories: { [key: string]: { name: string, emoji: string }[] } = {};

    Object.keys(data).forEach((categoryName) => {
      formattedCategories[categoryName] = data[categoryName].map((emojiObj: any) => ({
        name: emojiObj.name,
        emoji: emojiObj.emoji,
      }));
    });

    return formattedCategories;
  }

  get filteredEmojiCategories(): { [key: string]: { name: string, emoji: string }[] } {
    if (!this.emojiSearch) return this.emojiCategories;

    const search = this.emojiSearch.toLowerCase();
    const filteredCategories: { [key: string]: { name: string, emoji: string }[] } = {};

    Object.keys(this.emojiCategories).forEach((category) => {
      const filteredEmojis = this.emojiCategories[category].filter((emojiObj) =>
        emojiObj.name.toLowerCase().includes(search)
      );
      if (filteredEmojis.length > 0) {
        filteredCategories[category] = filteredEmojis;
      }
    });

    return filteredCategories;
  }

  selectEmoji(emoji: string): void {
    this.emojiSelected.emit(emoji);
    console.log(emoji)
    this.emojiSearch = '';
  }
}
