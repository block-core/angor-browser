import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { IndexerService } from './indexer.service';
import { catchError } from 'rxjs/operators';
import { of, Observable } from 'rxjs';

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
  private loading = false;
  private projects: Project[] = [];
  private noMoreProjects = false;

  constructor(
    private http: HttpClient,
    private indexerService: IndexerService
  ) {}

  fetchProjects(): Promise<Project[]> {
    if (this.loading || this.noMoreProjects) {
      return Promise.resolve([]);
    }

    this.loading = true;
    const indexerUrl = this.indexerService.getPrimaryIndexer('testnet');
    if (!indexerUrl) {
      console.error('No primary indexer found for testnet');
      this.loading = false;
      return Promise.resolve([]);
    }

    const url = `${indexerUrl}api/query/Angor/projects?offset=${this.offset}&limit=${this.limit}`;
    console.log(`Fetching projects from URL: ${url}`);

    return this.http
      .get<Project[]>(url)
      .pipe(
        catchError((error) => {
          console.error('Error fetching projects:', error);
          this.loading = false;
          return of([]); // Return an empty array in case of an error
        })
      )
      .toPromise()
      .then((projects) => {
        projects = projects || []; // Ensure `projects` is always an array
        if (projects.length === 0) {
          this.noMoreProjects = true;
        } else {
          this.projects = [...this.projects, ...projects];
          this.offset += this.limit;
        }
        this.loading = false;
        return projects;
      });
  }

  fetchProjectStats(projectIdentifier: string): Observable<ProjectStats> {
    const indexerUrl = this.indexerService.getPrimaryIndexer('testnet');
    if (!indexerUrl) {
      console.error('No primary indexer found for testnet');
      return of({} as ProjectStats); // Return an empty ProjectStats object
    }

    const url = `${indexerUrl}api/query/Angor/projects/${projectIdentifier}/stats`;
    console.log(`Fetching project stats from URL: ${url}`);

    return this.http.get<ProjectStats>(url).pipe(
      catchError((error) => {
        console.error(`Error fetching stats for project ${projectIdentifier}:`, error);
        return of({} as ProjectStats); // Return an empty ProjectStats object in case of an error
      })
    );
  }

  fetchProjectDetails(projectIdentifier: string): Observable<Project> {
    const indexerUrl = this.indexerService.getPrimaryIndexer('testnet');
    if (!indexerUrl) {
      console.error('No primary indexer found for testnet');
      return of({} as Project); // Return an empty Project object
    }

    const url = `${indexerUrl}api/query/Angor/projects/${projectIdentifier}`;
    console.log(`Fetching project details from URL: ${url}`);

    return this.http.get<Project>(url).pipe(
      catchError((error) => {
        console.error(`Error fetching details for project ${projectIdentifier}:`, error);
        return of({} as Project); // Return an empty Project object in case of an error
      })
    );
  }

  getProjects(): Project[] {
    return this.projects;
  }

  resetProjects(): void {
    this.projects = [];
    this.offset = 0;
    this.noMoreProjects = false;
  }
}
