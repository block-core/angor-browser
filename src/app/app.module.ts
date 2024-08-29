import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { AppRoutingModule } from './app-routing.module';

import { AppComponent } from './app.component';
import { ProfileComponent } from './components/profile/profile.component';
import { HomeComponent } from './components/home/home.component';
import { NostrService } from './services/nostr.service';
import {
  HttpClientModule,
  provideHttpClient,
  withFetch,
} from '@angular/common/http';
import { OverlayscrollbarsModule } from 'overlayscrollbars-ngx';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { ThemeComponent } from './components/theme/theme.component';
import { ThemeSwitcherComponent } from './components/theme/theme-switcher/theme-switcher.component';
import { ThemeColorComponent } from './components/theme/theme-color/theme-color.component';
import { SettingsComponent } from './components/settings/settings.component';
import { HelpComponent } from './components/help/help.component';
import { NotificationsComponent } from './components/notifications/notifications.component';
import { BookmarksComponent } from './components/bookmarks/bookmarks.component';
import { MessagesComponent } from './components/messages/messages.component';
import { ExploreComponent } from './components/explore/explore.component';
import { ProjectDetailsComponent } from './components/project-details/project-details.component';
import { MatDialogModule } from '@angular/material/dialog';
import { ExtensionComponent } from './components/profile/extension/extension.component';
import { NewComponent } from './components/profile/new/new.component';
import { MenemonicComponent } from './components/profile/menemonic/menemonic.component';
import { PrivatekeyComponent } from './components/profile/privatekey/privatekey.component';
import { PasswordDialogComponent } from './components/password-dialog/password-dialog.component';
 import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { EditProfileComponent } from './components/profile/editprofile/editprofile.component';
import { ChatListComponent } from './components/chat-list/chat-list.component';
   @NgModule({
  declarations: [
    AppComponent,
    ProfileComponent,
    HomeComponent,
    ThemeSwitcherComponent,
    ThemeColorComponent,
    ThemeComponent,
    SettingsComponent,
    HelpComponent,
    NotificationsComponent,
    BookmarksComponent,
    MessagesComponent,
    ExploreComponent,
    ProjectDetailsComponent,
    ExtensionComponent,
    NewComponent,
    MenemonicComponent,
    PrivatekeyComponent,
    PasswordDialogComponent,
    EditProfileComponent,
    ChatListComponent
  ],
  imports: [
    BrowserModule,
    FormsModule,
    AppRoutingModule,
    HttpClientModule,
    OverlayscrollbarsModule,
     MatDialogModule,
     FormsModule,
      ReactiveFormsModule,
       MatFormFieldModule,
      MatInputModule,
      FormsModule
   ],
  bootstrap: [AppComponent],
  providers: [provideHttpClient(withFetch()), provideAnimationsAsync()],
})
export class AppModule { }
