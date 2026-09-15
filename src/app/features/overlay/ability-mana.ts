import type { Hero, HeroAbility } from '@w3booster/sdk';
import type { GameData } from '@w3booster/sdk/game-data';

export interface AbilityManaState {
    readonly cost: number;
    readonly missing: number;
    readonly availableFraction: number;
    readonly recoverySeconds: number | null;
    readonly label: string;
}

/** Estimates mana recovery from the current observation, never a browser clock or catalog regeneration. */
export function abilityManaState(hero: Hero, ability: HeroAbility, data: GameData | null | undefined): AbilityManaState | null {
    const cost = data?.abilities.get(ability.typeId)?.levels[ability.level - 1]?.manaCost;
    const mana = hero.mana;
    if (!mana || !Number.isFinite(mana.current) || typeof cost !== 'number' || !Number.isFinite(cost) || cost <= 0) return null;
    const missing = Math.max(0, cost - mana.current);
    // The optional observation is absent in older SDK/recorder snapshots.
    const rate = 'regenerationPerSecond' in mana ? mana.regenerationPerSecond : undefined;
    const recoverySeconds = typeof rate === 'number' && Number.isFinite(rate) && rate > 0 && cost <= mana.max &&
        !(hero.hitpoints && hero.hitpoints.current <= 0) ? missing / rate : null;
    return {
        cost,
        missing,
        availableFraction: Math.max(0, Math.min(1, mana.current / cost)),
        recoverySeconds,
        label: missing === 0 ? 'Enough mana for this ability.' : `${Math.ceil(missing)} more mana needed. ${recoverySeconds === null
            ? 'Mana recovery time unavailable.'
            : `Approximately ${Math.ceil(recoverySeconds)} seconds at the current regeneration rate.`}`
    };
}
