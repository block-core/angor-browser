import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { Router } from '@angular/router';
import { ProjectsService } from '../../services/projects.service';
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
  private scrollListener!: () => void;

  constructor(
    private projectService: ProjectsService,
    private router: Router,
    private stateService: StateService
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

    this.projectService.fetchProjects().then((projects: any[]) => {
      if (projects.length === 0 && this.projects.length === 0) {
        this.errorMessage = 'No projects found';
      } else if (projects.length === 0) {
        this.errorMessage = 'No more projects found';
      } else {
        this.projects = [...this.projects, ...projects];
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
    this.router.navigate(['/projects', project.nostrPubKey]);
  }

  ngOnDestroy(): void {
    if (this.scrollListener) {
      window.removeEventListener('scroll', this.scrollListener);
    }
  }
}
