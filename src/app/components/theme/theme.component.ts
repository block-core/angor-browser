import { Component } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ThemeColorComponent } from './theme-color/theme-color.component';

@Component({
  selector: 'app-theme',
  templateUrl: './theme.component.html',
  styleUrls: ['./theme.component.css']
})
export class ThemeComponent {
  constructor(public dialog: MatDialog) { }

  openSettings() {
    const dialogRef = this.dialog.open(ThemeColorComponent, {
      width: '420px',
      panelClass: 'custom-dialog-container',
      maxHeight: '90vh',
      height: 'auto',
    });

    document.body.classList.add('dialog-open');

    dialogRef.afterClosed().subscribe(() => {
      document.body.classList.remove('dialog-open');
    });
  }
}
