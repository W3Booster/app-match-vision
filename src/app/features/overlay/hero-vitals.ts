import type { Hero } from '@w3booster/sdk';
import { valuePoolRatio } from '@w3booster/sdk/standard-game';

/** Preserve the original overlay's green → yellow (60%) → red health ramp. */
export function heroHealthColor(hero: Hero): string {
    const ratio = valuePoolRatio(hero.hitpoints);
    const red = ratio <= 0.6 ? 1 : 1 - (ratio - 0.6) / 0.4;
    const green = ratio > 0.6 ? 1 : ratio / 0.6;
    return `rgb(${Math.round(red * 255)}, ${Math.round(green * 255)}, 0)`;
}
