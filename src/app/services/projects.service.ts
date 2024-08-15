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

  constructor(
    private http: HttpClient,
    private indexerService: IndexerService,
    private nostrService: NostrService
  ) {}

  /**
   * Fetches projects from the server with pagination and retrieves metadata.
   */
  fetchProjects(): Promise<any[]> {
    if (this.loading) return Promise.resolve([]);

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
    ).toPromise().then(async (projects = []) => {
      const projectPromises = projects.map(async (project: any) => {
        return {
          nostrPubKey: project.nostrPubKey
        };
      });

      const processedProjects = await Promise.all(projectPromises);

      this.projects = [...this.projects, ...processedProjects];
      console.log(this.projects );

      this.offset += this.limit;
      this.loading = false;
      return processedProjects;
    });
  }

  /**
   * Triggered when the user scrolls to the bottom of the page.
   */
  onScroll(): void {
    this.fetchProjects();
  }

  /**
   * Returns the current list of projects.
   * @returns The list of projects.
   */
  getProjects(): any[] {
    return this.projects;
  }
}
