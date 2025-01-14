import { Injectable } from '@angular/core';
import { HttpClient, HttpResponse } from '@angular/common/http';
import { catchError } from 'rxjs/operators';
import { of, Observable } from 'rxjs';
import { IndexerService } from './indexer.service';

export interface Project {
  founderKey: string;
  nostrPubKey: string;
  projectIdentifier: string;
  createdOnBlock: number;
  trxId: string;
  totalInvestmentsCount: number;
}

export interface ProjectStats {
  investorCount: number;
  amountInvested: number;
  amountSpentSoFarByFounder: number;
  amountInPenalties: number;
  countInPenalties: number;
}

@Injectable({
  providedIn: 'root',
})
export class ProjectsService {
  private offset = 0;
  private limit = 50;
  private totalProjects = 0;
  private loading = false;
  private projects: Project[] = [];
  private noMoreProjects = false;
  private totalProjectsFetched = false;
  selectedNetwork: 'mainnet' | 'testnet' = 'testnet';

  constructor(
    private http: HttpClient,
    private indexerService: IndexerService

  ) {
    this.loadNetwork();
  }

  loadNetwork() {
    this.selectedNetwork = this.indexerService.getNetwork();
  }
  async fetchProjects(): Promise<Project[]> {
    if (this.loading || this.noMoreProjects) {
      return [];
    }

    this.loading = true;
    const indexerUrl = this.indexerService.getPrimaryIndexer(this.selectedNetwork);
    const url = this.totalProjectsFetched
      ? `${indexerUrl}api/query/Angor/projects?offset=${this.offset}&limit=${this.limit}`
      : `${indexerUrl}api/query/Angor/projects?limit=${this.limit}`;

    console.log(`Fetching projects from URL: ${url}`);

    try {
      const response = await this.http
        .get<Project[]>(url, { observe: 'response' })
        .toPromise();

      if (!this.totalProjectsFetched && response && response.headers) {
        const paginationTotal = response.headers.get('pagination-total');
        this.totalProjects = paginationTotal ? +paginationTotal : 0;
        console.log(`Total projects: ${this.totalProjects}`);
        this.totalProjectsFetched = true;

        this.offset = Math.max(this.totalProjects - this.limit, 0);
      }

      const newProjects = response?.body || [];
      console.log('New projects received:', newProjects);

      if (!newProjects || newProjects.length === 0) {
        this.noMoreProjects = true;
        return [];
      } else {
        const uniqueNewProjects = newProjects.filter(
          (newProject) =>
            !this.projects.some(
              (existingProject) =>
                existingProject.projectIdentifier === newProject.projectIdentifier
            )
        );

        if (uniqueNewProjects.length > 0) {
          this.projects = [...this.projects, ...uniqueNewProjects];
          console.log(`${uniqueNewProjects.length} new projects added`);

          this.offset = Math.max(this.offset - this.limit, 0);
          return uniqueNewProjects;
        } else {
          this.noMoreProjects = true;
          return [];
        }
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
      return [];
    } finally {
      this.loading = false;
    }
  }


  fetchProjectStats(projectIdentifier: string): Observable<ProjectStats> {
    const indexerUrl = this.indexerService.getPrimaryIndexer(this.selectedNetwork);
    const url = `${indexerUrl}api/query/Angor/projects/${projectIdentifier}/stats`;
    console.log(`Fetching project stats from URL: ${url}`);

    return this.http.get<ProjectStats>(url).pipe(
      catchError((error) => {
        console.error(
          `Error fetching stats for project ${projectIdentifier}:`,
          error
        );
        return of({} as ProjectStats);
      })
    );
  }

  fetchProjectDetails(projectIdentifier: string): Observable<Project> {
    const indexerUrl = this.indexerService.getPrimaryIndexer(this.selectedNetwork);
    const url = `${indexerUrl}api/query/Angor/projects/${projectIdentifier}`;
    console.log(`Fetching project details from URL: ${url}`);

    return this.http.get<Project>(url).pipe(
      catchError((error) => {
        console.error(
          `Error fetching details for project ${projectIdentifier}:`,
          error
        );
        return of({} as Project);
      })
    );
  }

  getProjects(): Project[] {
    return this.projects;
  }

  resetProjects(): void {
    this.projects = [];
    this.noMoreProjects = false;
    this.offset = 0;
    this.totalProjectsFetched = false;
  }
}
