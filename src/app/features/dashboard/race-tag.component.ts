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
        span { display: inline-flex; align-items: center; justify-content: center; height: 1.5em; padding: 0 4px; border-radius: 3px; background: #30373c; color: #c7d2d9;
            font-size: .8em; font-weight: 600; line-height: normal; white-space: nowrap; }
        span[data-race='human'] { background: #a4d1ff; color: #112638; }
        span[data-race='orc'] { background: #ffb6a7; color: #4c2018; }
        span[data-race='undead'] { background: #d2baff; color: #302044; }
        span[data-race='night-elf'] { background: #9fe1bd; color: #163325; }
        span[data-race='random'] { background: #ffd2a2; color: #4f2a0c; }
    `
})
export class RaceTagComponent {
    readonly value = input<string | undefined>('random');
    readonly race = computed(() => RACE_TAGS[raceInfo(this.value() ?? 'random').localizationKey] ?? RACE_TAGS['race.random']);
}
