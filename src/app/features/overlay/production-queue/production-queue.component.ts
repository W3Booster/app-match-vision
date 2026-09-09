import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import type { Match } from '@w3booster/sdk';
import type { MatchVisionPlayerView } from '../../../domain';
import { WarcraftAssetsService } from '../../../shared/warcraft/warcraft-assets.service';
import { productionPlayers, progressLabel } from './production-queue-presentation';

@Component({
    selector: 'mv-production-queue',
    templateUrl: './production-queue.component.html',
    styleUrl: './production-queue.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProductionQueueComponent {
    readonly match = input.required<Match>();
    readonly players = input.required<readonly MatchVisionPlayerView[]>();
    readonly reversePlayerOrder = input(false);
    readonly groups = computed(() => productionPlayers(this.players(), this.match(), this.reversePlayerOrder()));
    readonly progressLabel = progressLabel;
    private readonly assets = inject(WarcraftAssetsService);
    icon(typeId: string): string | null { return this.assets.iconPath(this.match(), typeId); }
}
