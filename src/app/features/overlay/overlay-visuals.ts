import type { Match, Player, Race } from '@w3booster/sdk';
import { playerHeroes } from '@w3booster/sdk/selectors';
import * as standardGame from '@w3booster/sdk/standard-game';
import { orderedMatchVisionTeams } from '../../domain';

const RACE_SPRITE_INDEX: Readonly<Record<Race, number>> = {
    random: 0,
    human: 1,
    orc: 2,
    undead: 3,
    'night-elf': 4
};
const ENGLISH_RACE_NAMES: Readonly<Record<Race, string>> = {
    random: 'Random', human: 'Human', orc: 'Orc', undead: 'Undead', 'night-elf': 'Night Elf'
};
const ENGLISH_RACE_SHORT_NAMES: Readonly<Record<Race, string>> = {
    random: 'RDM', human: 'HU', orc: 'ORC', undead: 'UD', 'night-elf': 'NE'
};
const CLOCK_PHASE_SECONDS = 30;
const CLOCK_PHASE_COUNT = 16;
const CLOCK_SPRITE_ALIGNMENT_SECONDS = 11;
const INVENTORY_RAIL_WIDTH = 138;
// Inventory starts 74px after the portrait; its content is inset another 3px.
const INVENTORY_CONTENT_INSET = 77;
const ABILITY_COLUMN_WIDTH = 45;
const UPGRADE_PANEL_GAP = 24;

/** Places upgrades directly after the first hero's occupied ability columns. */
export function upgradePanelInset(
    player: Player,
    showInventory: boolean,
    showAbilities: boolean
): number {
    const abilityCount = showAbilities ? (playerHeroes(player)[0]?.abilities?.length ?? 0) : 0;
    const abilityColumns = Math.ceil(abilityCount / 2);
    return (showInventory ? INVENTORY_RAIL_WIDTH : abilityCount > 0 ? INVENTORY_CONTENT_INSET : 0) + abilityColumns * ABILITY_COLUMN_WIDTH + UPGRADE_PANEL_GAP;
}

/** Match Vision's team ordering is presentation, not protocol state. */
export function orderedOverlayTeams<TPlayer extends Player>(
    players: readonly TPlayer[],
    match: Pick<Match, 'mode' | 'broadcasterPlayerId' | 'isObserver' | 'isReplay'>,
    reversePlayerOrder = false
): readonly (readonly TPlayer[])[] {
    return orderedMatchVisionTeams(players, match, reversePlayerOrder).map(team => team.players);
}

/** Index into Match Vision's race sprite sheet. */
export function raceSpriteIndex(race: Race | undefined): number {
    return RACE_SPRITE_INDEX[race ?? 'random'] ?? RACE_SPRITE_INDEX.random;
}

/** Match Vision's current English presentation copy. */
export function raceName(race: Race | undefined): string {
    return ENGLISH_RACE_NAMES[race ?? 'random'] ?? ENGLISH_RACE_NAMES.random;
}

/** Match Vision's current English abbreviated presentation copy. */
export function raceShortName(race: Race | undefined): string {
    return ENGLISH_RACE_SHORT_NAMES[race ?? 'random'] ?? ENGLISH_RACE_SHORT_NAMES.random;
}

/** Frames for Match Vision's 16-frame day/night sprite animation. */
export function dayNightSprite(gameTime: number): { phase: number; previousPhase: number; phaseProgress: number } {
    const clock = standardGame.dayNightState(gameTime);
    const aligned = (clock.secondsIntoCycle + CLOCK_SPRITE_ALIGNMENT_SECONDS) % 480;
    const phase = Math.floor(aligned / CLOCK_PHASE_SECONDS);
    return {
        phase,
        previousPhase: (phase - 1 + CLOCK_PHASE_COUNT) % CLOCK_PHASE_COUNT,
        phaseProgress: (aligned % CLOCK_PHASE_SECONDS) / CLOCK_PHASE_SECONDS
    };
}
