import { Component, computed, input } from '@angular/core';
import { raceInfo } from '@w3booster/sdk/standard-game';

const RACE_TAGS: Record<string, { id: string; label: string; name: string }> = {
    'race.human': { id: 'human', label: 'HU', name: 'Human' },
    'race.orc': { id: 'orc', label: 'Orc', name: 'Orc' },
    'race.undead': { id: 'undead', label: 'UD', name: 'Undead' },
    'race.night-elf': { id: 'night-elf', label: 'NE', name: 'Night Elf' },
    'race.random': { id: 'random', label: 'RDM', name: 'Random' }
};

@Component({
    selector: 'mv-race-tag',
    template: `<span [attr.data-race]="race().id" [title]="race().name" [attr.aria-label]="race().name">{{race().label}}</span>`,
    styles: `
        :host { display: inline-flex; flex: 0 0 auto; vertical-align: middle; }
        span { padding: 1px 4px; border-radius: 3px; background: #30373c; color: #c7d2d9;
            font-size: .8em; font-weight: 600; line-height: 1.1; white-space: nowrap; }
        span[data-race='human'] { background: #203b54; color: #a4d1ff; }
        span[data-race='orc'] { background: #482c29; color: #ffb6a7; }
        span[data-race='undead'] { background: #342b48; color: #d2baff; }
        span[data-race='night-elf'] { background: #203d31; color: #9fe1bd; }
    `
})
export class RaceTagComponent {
    readonly value = input<string | undefined>('random');
    readonly race = computed(() => RACE_TAGS[raceInfo(this.value() ?? 'random').localizationKey] ?? RACE_TAGS['race.random']);
}
