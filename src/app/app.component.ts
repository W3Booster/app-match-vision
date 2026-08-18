import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { MatchVisionClientService } from './core/match-vision-client.service';
import { surfaceFromSearch } from './core/surface';
import { CompactDashboardSurfaceComponent } from './features/dashboard/compact-dashboard-surface.component';
import { DashboardSurfaceComponent } from './features/dashboard/dashboard-surface.component';
import { OverlaySurfaceComponent } from './features/overlay/overlay-surface.component';

@Component({
    selector: 'app-root',
    imports: [CommonModule, CompactDashboardSurfaceComponent, DashboardSurfaceComponent, OverlaySurfaceComponent],
    templateUrl: './app.component.html',
    styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit, OnDestroy {
    readonly connection = inject(MatchVisionClientService);
    readonly surface = surfaceFromSearch(window.location.search);

    ngOnInit(): void {
        document.body.classList.toggle('application-surface', this.surface !== 'overlay');
        void this.connection.start(window.location.search);
    }

    ngOnDestroy(): void {
        document.body.classList.remove('application-surface');
        void this.connection.stop();
    }
}
