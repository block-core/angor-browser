import { Injectable } from '@angular/core';
import { HttpClient, HttpResponse } from '@angular/common/http';
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
  private totalProjects = 0;
  private loading = false;
  private projects: Project[] = [];
  private noMoreProjects = false;
  private totalProjectsFetched = false;

  constructor(
    private http: HttpClient,
    private indexerService: IndexerService
  ) {}

  private async ensureTotalProjectsFetched(): Promise<void> {
    if (!this.totalProjectsFetched) {
      await this.getTotalProjectsCount();
      this.totalProjectsFetched = true;
      this.offset = Math.max(this.totalProjects - this.limit, 0);
    }
  }

  private async getTotalProjectsCount(): Promise<void> {
    const indexerUrl = this.indexerService.getPrimaryIndexer('testnet');
    if (!indexerUrl) {
      throw new Error('No primary indexer found for testnet');
    }

    const url = `${indexerUrl}api/query/Angor/projects?offset=0&limit=1`;

    try {
      const response = await this.http
        .get<Project[]>(url, { observe: 'response' })
        .toPromise();
      if (response && response.headers) {
        const paginationTotal = response.headers.get('pagination-total');
        this.totalProjects = paginationTotal ? +paginationTotal : 0;
        console.log(`Total projects: ${this.totalProjects}`);
      }
    } catch (error) {
      console.error('Error fetching total project count:', error);
    }
  }

  async fetchProjects(): Promise<Project[]> {
    await this.ensureTotalProjectsFetched();

    if (this.loading || this.noMoreProjects) {
      return [];
    }

    this.loading = true;
    const indexerUrl = this.indexerService.getPrimaryIndexer('testnet');
    if (!indexerUrl) {
      this.loading = false;
      throw new Error('No primary indexer found for testnet');
    }

    if (this.projects.length >= this.totalProjects || this.offset < 0) {
      this.noMoreProjects = true;
      this.loading = false;
      return [];
    }

    const url = `${indexerUrl}api/query/Angor/projects?offset=${this.offset}&limit=${this.limit}`;
    console.log(`Fetching projects from URL: ${url}`);

    try {
      const newProjects = await this.http
        .get<Project[]>(url)
        .pipe(
          catchError((error) => {
            console.error('Error fetching projects:', error);
            return of([]);
          })
        )
        .toPromise();

      if (!newProjects || newProjects.length === 0) {
        this.noMoreProjects = true;
        return [];
      } else {
        const uniqueNewProjects = newProjects.filter(
          (newProject) =>
            !this.projects.some(
              (existingProject) =>
                existingProject.projectIdentifier ===
                newProject.projectIdentifier
            )
        );

        if (uniqueNewProjects.length > 0) {
          this.projects = [...this.projects, ...uniqueNewProjects];
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
    const indexerUrl = this.indexerService.getPrimaryIndexer('testnet');
    if (!indexerUrl) {
      console.error('No primary indexer found for testnet');
      return of({} as ProjectStats);
    }

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
    const indexerUrl = this.indexerService.getPrimaryIndexer('testnet');
    if (!indexerUrl) {
      console.error('No primary indexer found for testnet');
      return of({} as Project);
    }

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

  async resetProjects(): Promise<void> {
    await this.ensureTotalProjectsFetched();

    this.projects = [];
    this.noMoreProjects = false;
    this.offset = Math.max(this.totalProjects - this.limit, 0);
  }
}
