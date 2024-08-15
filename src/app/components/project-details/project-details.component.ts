import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NostrService } from '../../services/nostr.service';

@Component({
  selector: 'app-project-details',
  templateUrl: './project-details.component.html',
  styleUrls: ['./project-details.component.css']
})
export class ProjectDetailsComponent implements OnInit {
  selectedProject: any = null;
  errorMessage: string = '';
  isLoading: boolean = false;
  isRelayConnected: boolean = false; // New state to check relay connection

  constructor(private route: ActivatedRoute, private nostrService: NostrService) { }

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const nostrPubKey = params.get('id');
      if (nostrPubKey) {
        this.fetchProjectMetadata(nostrPubKey);
      } else {
        this.errorMessage = 'Invalid project key. Please check the URL and try again.';
      }
    });
  }

  async fetchProjectMetadata(nostrPubKey: string): Promise<void> {
    this.isLoading = true; // Set loading state to true
    try {
       this.isRelayConnected = true; // Relay connection successful
      const metadata = await this.nostrService.fetchMetadata(nostrPubKey);
      if (metadata) {
        this.selectedProject = metadata;
      } else {
        this.errorMessage = 'No metadata found for the given public key. Please check the public key and try again.';
      }
    } catch (error: any) { // Explicitly typing error as any
      console.error('Error fetching metadata:', error);
      if (!this.isRelayConnected) {
        this.errorMessage = 'Unable to connect to relays. Please check your network connection.';
      } else {
        this.errorMessage = error.message || 'Error fetching project metadata. Please try again later.';
      }
    } finally {
      this.isLoading = false; // Set loading state to false
    }
  }
}
