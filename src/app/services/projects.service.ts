import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { IndexerService } from './indexer.service';
import { NostrService } from './nostr.service';
import { catchError } from 'rxjs/operators';
import { of } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ProjectsService {
  private offset: number = 0;
  private limit: number = 50;
  private loading: boolean = false;
  private projects: any[] = [];
  private noMoreProjects: boolean = false; // Flag to track if more projects are available

  constructor(
    private http: HttpClient,
    private indexerService: IndexerService,
  ) {}

  /**
   * Fetches projects from the server with pagination.
   */
  fetchProjects(): Promise<any[]> {
    if (this.loading || this.noMoreProjects) return Promise.resolve([]);

    this.loading = true;
    const indexerUrl = this.indexerService.getPrimaryIndexer('testnet');
    if (!indexerUrl) {
      console.error('No primary indexer found for testnet');
      this.loading = false;
      return Promise.resolve([]);
    }

    const url = `${indexerUrl}api/query/Angor/projects?offset=${this.offset}&limit=${this.limit}`;
    console.log(url);

    return this.http.get<any[]>(url).pipe(
      catchError(error => {
        console.error('Error fetching projects:', error);
        this.loading = false;
        return of([]); // Return an empty array in case of an error
      })
    ).toPromise().then(projects => {
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

  /**
   * Returns the current list of projects.
   * @returns The list of projects.
   */
  getProjects(): any[] {
    return this.projects;
  }

  /**
   * Resets the project list, typically used when reloading or refreshing.
   */
  resetProjects(): void {
    this.projects = [];
    this.offset = 0;
    this.noMoreProjects = false;
  }
}
