import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import type { Match } from '@w3booster/sdk';
import type { MatchVisionPlayerView } from '../../../domain';
import { WarcraftAssetsService } from '../../../shared/warcraft/warcraft-assets.service';
import { productionPlayers, progressLabel, remainingSecondsLabel, isProgressWaiting } from './production-queue-presentation';

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
    readonly enabled = input(true);
    readonly constructionEnabled = input(true);
    readonly groups = computed(() => productionPlayers(this.players(), this.match(), this.reversePlayerOrder(), this.enabled(), this.constructionEnabled()));
    readonly sides = ['left', 'right'] as const;
    readonly panels = computed(() => this.sides.map(side => ({ side, groups: this.groups().filter(group => group.side === side) })));
    readonly progressLabel = progressLabel;
    readonly isProgressWaiting = isProgressWaiting;
    readonly remainingSecondsLabel = remainingSecondsLabel;
    private readonly assets = inject(WarcraftAssetsService);
    constructionIcon(): string | null { return this.assets.abilityIconPath(this.match(), { typeId: 'AObu', level: 1 }); }
    icon(typeId: string): string | null { return this.assets.unitIconPath(this.match(), typeId); }
    queueIcon(typeId: string, player: MatchVisionPlayerView): string | null {
        return this.assets.productionIconPath(this.match(), typeId, player.upgrades?.active);
    }
}
