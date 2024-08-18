import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NostrService } from '../../services/nostr.service';
import { ProjectsService, Project, ProjectStats } from '../../services/projects.service';

@Component({
  selector: 'app-project-details',
  templateUrl: './project-details.component.html',
  styleUrls: ['./project-details.component.css'],
})
export class ProjectDetailsComponent implements OnInit {
  selectedProject: Project | null = null;
  selectedProjectStats: ProjectStats | null = null;
  selectedProjectMetadata: any = null;
  errorMessage: string = '';
  isLoading: boolean = false;
  isRelayConnected: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private nostrService: NostrService,
    private projectsService: ProjectsService
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const projectIdentifier = params.get('id');
      if (projectIdentifier) {
        this.loadProjectDetails(projectIdentifier);
        this.loadProjectStats(projectIdentifier);
      } else {
        this.errorMessage = 'Invalid project identifier. Please check the URL and try again.';
      }
    });
  }

  loadProjectDetails(projectIdentifier: string) {
    this.projectsService.fetchProjectDetails(projectIdentifier).subscribe(
      (project) => {
        this.selectedProject = project;
        if (project.nostrPubKey) {
          this.fetchProjectMetadata(project.nostrPubKey);
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

  loadProjectStats(projectIdentifier: string) {
    this.isLoading = true;
    this.projectsService.fetchProjectStats(projectIdentifier).subscribe(
      (stats) => {
        this.selectedProjectStats = stats;
      },
      (error) => {
        console.error('Error fetching project stats:', error);
        this.errorMessage = 'Error fetching project stats. Please try again later.';
        this.isLoading = false;
      }
    );
  }

  async fetchProjectMetadata(nostrPubKey: string): Promise<void> {
    try {
      this.isRelayConnected = true;
      const metadata = await this.nostrService.fetchMetadata(nostrPubKey);

      if (metadata) {
        this.selectedProjectMetadata = metadata;
      } else {
        this.errorMessage = 'No metadata found for the given public key. Please check the public key and try again.';
      }
    } catch (error: any) {
      console.error('Error fetching metadata:', error);
      if (!this.isRelayConnected) {
        this.errorMessage = 'Unable to connect to relays. Please check your network connection.';
      } else {
        this.errorMessage = error.message || 'Error fetching project metadata. Please try again later.';
      }
    } finally {
      this.isLoading = false;
    }
  }
}
