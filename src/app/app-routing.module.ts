import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HomeComponent } from './components/home/home.component';
import { ProfileComponent } from './components/profile/profile.component';
import { SettingsComponent } from './components/settings/settings.component';
import { ExploreComponent } from './components/explore/explore.component';
import { ChatComponent } from './components/messages/chat/chat.component';
import { BookmarksComponent } from './components/bookmarks/bookmarks.component';
import { NotificationsComponent } from './components/notifications/notifications.component';
import { HelpComponent } from './components/help/help.component';
import { ExtensionComponent } from './components/profile/extension/extension.component';
import { NewComponent } from './components/profile/new/new.component';
import { MenemonicComponent } from './components/profile/menemonic/menemonic.component';
import { PrivatekeyComponent } from './components/profile/privatekey/privatekey.component';
import { EditProfileComponent } from './components/profile/editprofile/editprofile.component';
import { MessagesComponent } from './components/messages/messages.component';
import { ProjectDetailsComponent } from './components/explore/project-details/project-details.component';

const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'profile', component: ProfileComponent },
  { path: 'profile/extension', component: ExtensionComponent },
  { path: 'profile/privatekey', component: PrivatekeyComponent },
  { path: 'profile/menemonic', component: MenemonicComponent },
  { path: 'profile/new', component: NewComponent },
  { path: 'profile/editprofile', component: EditProfileComponent },

  { path: 'messages',component:MessagesComponent},
  { path: 'messages/:pubkey',component:ChatComponent},
  { path: 'projects',component:ExploreComponent},
  { path: 'projects/:id', component: ProjectDetailsComponent },
  { path: 'explore',component:ExploreComponent},
  { path: 'bookmarks',component:BookmarksComponent},
  { path: 'notifications',component:NotificationsComponent},
  { path: 'settings',component:SettingsComponent},
  { path: 'help',component:HelpComponent},
  { path: '**', redirectTo: '', pathMatch: 'full' }
 ];

@NgModule({
  imports: [RouterModule.forRoot(routes, { onSameUrlNavigation: 'reload' })],
  exports: [RouterModule]
})
export class AppRoutingModule { }
