import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { NostrService } from '../../services/nostr.service';
import { ProjectsService, Project, ProjectStats } from '../../services/projects.service';
import { PasswordDialogComponent } from '../password-dialog/password-dialog.component';
import { NostrEvent } from 'nostr-tools';

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

  constructor(
    private route: ActivatedRoute,
    private nostrService: NostrService,
    private projectsService: ProjectsService,
    private dialog: MatDialog
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

  private loadComments(nostrPubKey: string): void {
    this.nostrService.getEventsByAuthor(nostrPubKey).then(
      (comments) => {
        this.comments = this.organizeCommentsAndReplies(comments);
      },
      (error) => {
        this.handleError(error, 'Error fetching comments.');
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

  addComment(content: string): void {
    this.signAndHandleEvent(content, (signedEvent) => {
      this.nostrService.sendComment(this.nostrPubKey, content).then(
        () => this.loadComments(this.nostrPubKey),
        (error) => this.handleError(error, 'Error posting comment.')
      );
    });
  }

  likeComment(commentId: string): void {
    this.signAndHandleEvent('', () => {
      this.nostrService.reactToEvent(commentId, '👍').then(
        () => this.loadComments(this.nostrPubKey),
        (error) => this.handleError(error, 'Error liking comment.')
      );
    });
  }

  rateComment(commentId: string, rating: number): void {
    const content = `Rating: ${rating}`;
    this.signAndHandleEvent(content, () => {
      this.nostrService.rateEvent(commentId, rating).then(
        () => this.loadComments(this.nostrPubKey),
        (error) => this.handleError(error, 'Error rating comment.')
      );
    });
  }

  replyToComment(comment: NostrEvent): void {
    const content = `Replying to: ${comment.id}`;
    this.signAndHandleEvent(content, () => {
      this.nostrService.sendComment(comment.id, content).then(
        () => this.loadComments(this.nostrPubKey),
        (error) => this.handleError(error, 'Error replying to comment.')
      );
    });
  }

  private signAndHandleEvent(content: string, callback: (signedEvent: NostrEvent) => void): void {
    const publicKey = localStorage.getItem('nostrPublicKey');
    const encryptedPrivateKey = localStorage.getItem('nostrSecretKey');

    if (publicKey && encryptedPrivateKey) {
      const dialogRef = this.dialog.open(PasswordDialogComponent, {
        width: '250px',
        data: { message: 'Please enter your password to sign the event' },
      });

      dialogRef.afterClosed().subscribe((password) => {
        if (password) {
          this.nostrService.signEventWithPassword(content, encryptedPrivateKey, password).then(callback).catch(
            (error) => this.handleError(error, 'Error signing event.')
          );
        }
      });
    } else if (publicKey) {
      this.nostrService.signEventWithExtension(content).then(callback).catch(
        (error) => this.handleError(error, 'Error signing event with extension.')
      );
    } else {
      this.errorMessage = 'No public key found. Please ensure you are logged in.';
    }
  }

  private handleError(error: any, fallbackMessage: string): void {
    console.error(fallbackMessage, error);
    this.errorMessage = error.message || fallbackMessage;
  }
}
