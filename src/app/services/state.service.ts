import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class StateService {
  private projects: any[] = [];

  setProjects(projects: any[]): void {
    this.projects = projects;
  }

  getProjects(): any[] {
    return this.projects;
  }

  hasProjects(): boolean {
    return this.projects.length > 0;
  }

  updateProjectActivity(project: any): void {
    const index = this.projects.findIndex(p => p.nostrPubKey === project.nostrPubKey);
    if (index > -1) {
      this.projects[index] = project;
    } else {
      this.projects.push(project);
    }
    this.projects.sort((a, b) => b.lastActivity - a.lastActivity);
  }
}
