import { Injectable } from '@angular/core';
import { NostrService } from './nostr.service';

@Injectable({
  providedIn: 'root'
})
export class StateService {
  private projects: any[] = [];
  private metadataCache: Map<string, any> = new Map();

  constructor(private nostrService: NostrService) {}

  async setProjects(projects: any[]): Promise<void> {
    this.projects = projects;
    this.updateMetadataInBackground();
  }

  getProjects(): any[] {
    return this.projects;
  }

  hasProjects(): boolean {
    return this.projects.length > 0;
  }

  async updateProjectActivity(project: any): Promise<void> {
    const index = this.projects.findIndex(p => p.nostrPubKey === project.nostrPubKey);

    if (index > -1) {
      this.projects[index] = project;
    } else {
      this.projects.push(project);
    }

    this.projects.sort((a, b) => b.lastActivity - a.lastActivity);
    this.updateMetadataForProject(project);  // Update metadata for the specific project
  }

  private updateMetadataInBackground(): void {
    // Limit the number of concurrent requests to improve performance
    const batchSize = 5;
    for (let i = 0; i < this.projects.length; i += batchSize) {
      const batch = this.projects.slice(i, i + batchSize);
      batch.forEach(project => this.updateMetadataForProject(project));
    }
  }

  private async updateMetadataForProject(project: any): Promise<void> {
    if (this.metadataCache.has(project.nostrPubKey)) {
      this.applyMetadata(project, this.metadataCache.get(project.nostrPubKey));
      return;
    }

    try {
      const metadata = await this.nostrService.getMetadata(project.nostrPubKey);
      this.applyMetadata(project, metadata);
      this.metadataCache.set(project.nostrPubKey, metadata); // Cache the metadata
    } catch (error) {
      console.error(`Error fetching metadata for project ${project.nostrPubKey}:`, error);
    }
  }

  private applyMetadata(project: any, metadata: any): void {
    project.displayName = metadata.name;
    project.picture = metadata.picture;
  }
}
