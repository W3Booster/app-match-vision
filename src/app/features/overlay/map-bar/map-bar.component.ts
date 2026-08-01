
import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { Match, OverlayRuntimeState } from '@w3booster/sdk';
import * as standardGame from '@w3booster/sdk/standard-game';
import type { MatchVisionOverlaySettings } from '../../../domain';

@Component({
    selector: 'mv-map-bar',
    imports: [CommonModule],
    templateUrl: './map-bar.component.html',
    styleUrl: './map-bar.component.scss'
})
export class MapBarComponent {
    readonly runtimeInput = input.required<OverlayRuntimeState>({ alias: 'runtime' });
    readonly settingsInput = input.required<MatchVisionOverlaySettings>({ alias: 'settings' });
    readonly matchInput = input.required<Match>({ alias: 'match' });

    get runtime(): OverlayRuntimeState { return this.runtimeInput(); }
    get settings(): MatchVisionOverlaySettings { return this.settingsInput(); }
    get match(): Match { return this.matchInput(); }

    showObserverBar(): boolean {
        return Boolean(this.match.isReplay || this.match.isObserver) && standardGame.isMode(this.match.mode, '1v1');
    }
}
