import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { NostrEvent } from 'nostr-tools';
import { NostrService } from '../../../services/nostr.service';
import { Project, ProjectStats, ProjectsService } from '../../../services/projects.service';

@Component({
  selector: 'app-project-details',
  templateUrl: './project-details.component.html',
  styleUrls: ['./project-details.component.css'],
})
export class ProjectDetailsComponent implements OnInit {
  selectedProject: Project | null = null;
  selectedProjectStats: ProjectStats | null = null;
  selectedProjectMetadata: any = null;
  comments: NostrEvent[] = [];
  events: NostrEvent[] = [];
  errorMessage: string = '';
  isLoading: boolean = false;
  isRelayConnected: boolean = false;
  nostrPubKey: string = '';
  publicKey = '';
  isLoggedIn: boolean = false;


  constructor(
    private route: ActivatedRoute,
    private nostrService: NostrService,
    private projectsService: ProjectsService,
    private dialog: MatDialog,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const projectIdentifier = params.get('id');
      if (projectIdentifier) {
        this.initializeProjectData(projectIdentifier);
      } else {
        this.errorMessage = 'Invalid project identifier. Please check the URL and try again.';
      }
    });
    this.checkLoginStatus();
  }

  private initializeProjectData(projectIdentifier: string): void {
    this.loadProjectDetails(projectIdentifier);
    this.loadProjectStats(projectIdentifier);
  }

  private loadProjectDetails(projectIdentifier: string): void {
    this.projectsService.fetchProjectDetails(projectIdentifier).subscribe(
      (project) => {
        this.selectedProject = project;
        this.nostrPubKey = project.nostrPubKey || '';
        if (this.nostrPubKey) {
          this.loadProjectMetadata(this.nostrPubKey);
          this.loadComments(this.nostrPubKey);
          this.loadEvents(this.nostrPubKey);
        } else {
          this.errorMessage = 'No Nostr public key found in project details. Unable to fetch metadata.';
        }
      },
      (error) => {
        console.error('Error fetching project details:', error);
        this.errorMessage = 'Error fetching project details. Please try again later.';
      }
    );
  }

  private loadProjectStats(projectIdentifier: string): void {
    this.isLoading = true;
    this.projectsService.fetchProjectStats(projectIdentifier).subscribe(
      (stats) => {
        this.selectedProjectStats = stats;
        this.isLoading = false;
      },
      (error) => {
        console.error('Error fetching project stats:', error);
        this.errorMessage = 'Error fetching project stats. Please try again later.';
        this.isLoading = false;
      }
    );
  }

  private async loadProjectMetadata(nostrPubKey: string): Promise<void> {
    try {
      this.isRelayConnected = true;
      const metadata = await this.nostrService.fetchMetadata(nostrPubKey);
      if (metadata) {
        this.selectedProjectMetadata = metadata;
      } else {
        this.errorMessage = 'No metadata found for the given public key.';
      }
    } catch (error) {
      this.handleError(error, 'Error fetching project metadata.');
    }
  }

 getTagType(tagType: string): string {
  switch (tagType) {
    case 'root':
      return 'Root Event';
    case 'reply':
      return 'Reply to Event';
    default:
      return 'Unknown Tag';
  }
}

loadComments(nostrPubKey: string) {
  this.nostrService.getEventsByAuthor(nostrPubKey).then(
    (comments) => {
      this.comments = comments.map(comment => {
        return {
          content: comment.content,
          created_at: comment.created_at,
          tags: comment.tags,
          kind: comment.kind,
          pubkey: comment.pubkey,
          id: comment.id,
          sig: comment.sig,
        };
      });
    },
    (error: any) => {
      console.error('Error fetching comments:', error);
      this.errorMessage = 'Error fetching comments. Please try again later.';
    }
  );
}


  private loadEvents(nostrPubKey: string): void {
    this.nostrService.getEventsByAuthor(nostrPubKey).then(
      (events) => {
        this.events = events;
      },
      (error) => {
        this.handleError(error, 'Error fetching events.');
      }
    );
  }

  private organizeCommentsAndReplies(comments: NostrEvent[]): NostrEvent[] {
    return comments.map(comment => ({
      ...comment,
      replies: comments.filter(reply => reply.tags.some(tag => tag[0] === 'e' && tag[1] === comment.id))
    })).filter(comment => !comment.tags.some(tag => tag[0] === 'e'));
  }



  private checkLoginStatus(): void {
     this.isLoggedIn = !!this.nostrService.getUserPublicKey();
   }

   navigateToMessages(): void {
    if (this.nostrPubKey) {
      this.router.navigate(['/messages', this.nostrPubKey]);
    }
  }


  private handleError(error: any, fallbackMessage: string): void {
    console.error(fallbackMessage, error);
    this.errorMessage = error.message || fallbackMessage;
  }
}
