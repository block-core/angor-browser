import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { Router } from '@angular/router';
import { ProjectsService } from '../../services/projects.service';
import { StateService } from '../../services/state.service';
import { NostrService } from '../../services/nostr.service';

interface Project {
  projectIdentifier:string;
  nostrPubKey: string;
  displayName?: string;
  picture?: string;
}

@Component({
  selector: 'app-explore',
  templateUrl: './explore.component.html',
  styleUrl: './explore.component.css'
})
 export class ExploreComponent implements OnInit, OnDestroy {
  projects: Project[] = [];
  errorMessage: string = '';
  loading: boolean = false;
  private scrollListener!: () => void;
  private metadataLoadLimit = 5;
  constructor(
    private projectService: ProjectsService,
    private router: Router,
    private stateService: StateService,
    private nostrService: NostrService
  ) {}

  ngOnInit(): void {
    this.projects = this.stateService.getProjects();
    if (this.projects.length === 0) {
      this.loadProjects();
    } else {

      this.loading = false;
    }

    this.scrollListener = this.onScroll.bind(this);
    window.addEventListener('scroll', this.scrollListener);
  }

  loadProjects(): void {
    if (this.loading) return; // Prevent multiple requests

    const scrollTop = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;

    this.projectService.fetchProjects().then(async (projects: Project[]) => {
      if (projects.length === 0 && this.projects.length === 0) {
        this.errorMessage = 'No projects found';
      } else if (projects.length === 0) {
        this.errorMessage = 'No more projects found';
      } else {
        this.projects = [...this.projects, ...projects];

        for (let i = 0; i < projects.length; i += this.metadataLoadLimit) {
          const batch = projects.slice(i, i + this.metadataLoadLimit);
          await Promise.all(batch.map(project => this.loadMetadataForProject(project)));
        }
        this.stateService.setProjects(this.projects);

      }
      this.loading = false;
      window.scrollTo(0, scrollTop); // Restore scroll position
    }).catch((error: any) => {
      console.error('Error fetching projects:', error);
      this.errorMessage = 'Error fetching projects. Please try again later.';
      this.loading = false;
      window.scrollTo(0, scrollTop); // Restore scroll position on error
    });
  }

  async loadMetadataForProject(project: Project): Promise<void> {
    try {
      if ('requestIdleCallback' in window) {
        window.requestIdleCallback(async () => {
          const metadata = await this.nostrService.getMetadata(project.nostrPubKey);
          this.updateProjectMetadata(project, metadata);
        });
      } else {
        const metadata = await this.nostrService.getMetadata(project.nostrPubKey);
        this.updateProjectMetadata(project, metadata);
      }
    } catch (error) {
      console.error(`Error fetching metadata for project ${project.nostrPubKey}:`, error);
    }
  }
  updateProjectMetadata(project: Project, metadata: any): void {
    project.displayName = metadata.name;
    project.picture = metadata.picture;
  }
  @HostListener('window:scroll', [])
  onScroll(): void {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
    const scrollHeight = document.documentElement.scrollHeight;
    const clientHeight = document.documentElement.clientHeight;

    if (scrollTop + clientHeight >= scrollHeight - 10 && !this.loading) {
      this.loadProjects();
    }
  }

  goToProjectDetails(project: Project): void {
    this.router.navigate(['/projects', project.projectIdentifier]);
  }

  ngOnDestroy(): void {
    if (this.scrollListener) {
      window.removeEventListener('scroll', this.scrollListener);
    }
  }
}

