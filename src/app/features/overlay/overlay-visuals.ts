import type { Match, OverlayRuntimeState, Player, Race } from '@w3booster/sdk';
import { broadcasterPlayer, groupPlayersByTeam, playerRelationship } from '@w3booster/sdk/selectors';
import * as standardGame from '@w3booster/sdk/standard-game';

const TEAM_COLOR_PALETTE = {
    self: standardGame.playerColors[1],
    ally: standardGame.playerColors[2],
    opponent: standardGame.playerColors[0]
} as const;
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

/** Match Vision's team ordering is presentation, not protocol state. */
export function orderedOverlayTeams(players: readonly Player[], match: Pick<Match, 'broadcasterPlayerId'>): Player[][] {
    const groups = groupPlayersByTeam(players);
    const broadcaster = broadcasterPlayer(match, players);
    if (!broadcaster) return groups.map(group => [...group.players]);
    return groups
        .sort((left, right) => Number(right.teamId === broadcaster.team) - Number(left.teamId === broadcaster.team))
        .map(group => [...group.players]);
}

/** Match Vision palette for the optional simplified team-color view. */
export function overlayPlayerColor(
    player: Player,
    match: Pick<Match, 'broadcasterPlayerId' | 'isObserver'>,
    players: readonly Player[],
    runtime: Pick<OverlayRuntimeState, 'teamColors'>
): string {
    if (!runtime.teamColors) return standardGame.playerColor(player.colorId);
    const relationship = playerRelationship(player, match, players);
    if (relationship === 'unknown') return standardGame.playerColor(player.colorId);
    if (match.isObserver && relationship === 'self') return TEAM_COLOR_PALETTE.ally;
    return TEAM_COLOR_PALETTE[relationship];
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
