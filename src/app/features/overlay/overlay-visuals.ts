import type { Match, Player, Race } from '@w3booster/sdk';
import { broadcasterFirstTeams } from '@w3booster/sdk/selectors';
import * as standardGame from '@w3booster/sdk/standard-game';

const RACE_SPRITE_INDEX: Readonly<Record<Race, number>> = {
    random: 0,
    human: 1,
    orc: 2,
    undead: 3,
    'night-elf': 4
};
const CLOCK_PHASE_SECONDS = 30;
const CLOCK_PHASE_COUNT = 16;
const CLOCK_SPRITE_ALIGNMENT_SECONDS = 11;
const INVENTORY_RAIL_WIDTH = 138;
const ABILITY_COLUMN_WIDTH = 45;
const UPGRADE_PANEL_GAP = 24;

/** Places upgrades directly after the first hero's occupied ability columns. */
export function upgradePanelInset(
    player: Player,
    showInventory: boolean,
    showAbilities: boolean
): number {
    const abilityCount = showAbilities ? (player.heroes?.[0]?.abilities?.length ?? 0) : 0;
    const abilityColumns = Math.ceil(abilityCount / 2);
    return (showInventory ? INVENTORY_RAIL_WIDTH : 0) + abilityColumns * ABILITY_COLUMN_WIDTH + UPGRADE_PANEL_GAP;
}

/** Match Vision's team ordering is presentation, not protocol state. */
export function orderedOverlayTeams(
    players: readonly Player[],
    match: Pick<Match, 'broadcasterPlayerId'>,
    reversePlayerOrder = false
): readonly (readonly Player[])[] {
    return broadcasterFirstTeams(players, match, { reverse: reversePlayerOrder }).map(team => team.players);
}

/** Index into Match Vision's race sprite sheet. */
export function raceSpriteIndex(race: Race | undefined): number {
    return RACE_SPRITE_INDEX[race ?? 'random'] ?? RACE_SPRITE_INDEX.random;
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
