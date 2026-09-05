import type { GameContext } from '@w3booster/sdk';
import type { MatchVisionScore } from '../../../domain';

import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { Match } from '@w3booster/sdk';
import { isObserverOrReplayMatch } from '@w3booster/sdk/selectors';
import * as standardGame from '@w3booster/sdk/standard-game';
import type { MatchVisionOverlaySettings } from '../../../domain';

@Component({
    selector: 'mv-map-bar',
    imports: [CommonModule],
    templateUrl: './map-bar.component.html',
    styleUrl: './map-bar.component.scss'
})
export class MapBarComponent {
    readonly score = input<MatchVisionScore>();
    readonly gameContextInput = input.required<GameContext>({ alias: 'gameContext' });
    readonly settingsInput = input.required<MatchVisionOverlaySettings>({ alias: 'settings' });
    readonly matchInput = input.required<Match>({ alias: 'match' });

    get gameContext(): GameContext { return this.gameContextInput(); }
    get settings(): MatchVisionOverlaySettings { return this.settingsInput(); }
    get match(): Match { return this.matchInput(); }

    showObserverBar(): boolean {
        return isObserverOrReplayMatch(this.match) && standardGame.isMode(this.match.mode, '1v1');
    }
}
