import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { Router } from '@angular/router';
import { ProjectsService } from '../../services/projects.service';
import { NostrService } from '../../services/nostr.service';
import { StateService } from '../../services/state.service';

interface Project {
  nostrPubKey: string;
}

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit, OnDestroy {
  projects: Project[] = [];
  errorMessage: string = '';
  loading: boolean = false;
  noMoreProjects: boolean = false; // Flag to indicate no more projects
  private scrollListener!: () => void;

  constructor(
    private projectService: ProjectsService,
    private nostrService: NostrService,
    private router: Router,
    private stateService: StateService
  ) {}

  ngOnInit(): void {
    if (this.stateService.hasProjects()) {
      this.projects = this.stateService.getProjects();
      this.loading = false;
    } else {
      this.loadProjects();
    }

    this.scrollListener = this.onScroll.bind(this);
    window.addEventListener('scroll', this.scrollListener);
  }

  loadProjects(): void {
    if (this.loading || this.noMoreProjects) return; // Prevent multiple requests and if no more projects
    this.loading = true;

    // Save the current scroll position
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;

    this.projectService.fetchProjects().then((projects: any[]) => {
      const projectPromises = projects.map(async (project: any) => ({
        nostrPubKey: project.nostrPubKey
      }));

      Promise.all(projectPromises).then((loadedProjects: Project[]) => {
        if (loadedProjects.length === 0) {
          this.noMoreProjects = true; // No more projects
          this.errorMessage = 'No more projects found';
        } else {
          this.projects = [...this.projects, ...loadedProjects];
          this.stateService.setProjects(this.projects);
          this.errorMessage = ''; // Clear any previous error message
        }
        this.loading = false;

        // Restore the scroll position after a short delay
        setTimeout(() => {
          window.scrollTo(0, scrollTop);
        }, 100); // Adjust the delay as needed
      }).catch((error: any) => {
        console.error('Error processing projects:', error);
        this.errorMessage = 'Error processing projects. Please try again later.';
        this.loading = false;

        // Restore the scroll position after a short delay
        setTimeout(() => {
          window.scrollTo(0, scrollTop);
        }, 100); // Adjust the delay as needed
      });
    }).catch((error: any) => {
      console.error('Error fetching projects:', error);
      this.errorMessage = 'Error fetching projects. Please try again later.';
      this.loading = false;

      // Restore the scroll position after a short delay
      setTimeout(() => {
        window.scrollTo(0, scrollTop);
      }, 100); // Adjust the delay as needed
    });
  }

  @HostListener('window:scroll', [])
  onScroll(): void {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
    const scrollHeight = document.documentElement.scrollHeight;
    const clientHeight = document.documentElement.clientHeight;

    // Trigger loading projects when near the bottom
    if (scrollTop + clientHeight >= scrollHeight - 10 && !this.loading && !this.noMoreProjects) {
      this.loadProjects();
    }
  }

  goToProjectDetails(project: Project): void {
    this.router.navigate(['/projects', project.nostrPubKey]);
  }

  ngOnDestroy(): void {
    if (this.scrollListener) {
      window.removeEventListener('scroll', this.scrollListener);
    }
  }
}
