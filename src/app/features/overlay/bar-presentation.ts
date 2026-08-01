import type { Match } from '@w3booster/sdk';
import * as standardGame from '@w3booster/sdk/standard-game';
import type { MatchVisionOverlaySettings } from '../../domain';

const SUPPORTED_MODES = ['1v1', '2v2', '3v3', '4v4', '3ffa', '4ffa'];

export function showsMatchBar(match: Match): boolean {
    return SUPPORTED_MODES.some(mode => standardGame.isMode(match.mode, mode));
}

export function matchBarClasses(match: Match, settings: MatchVisionOverlaySettings): string {
    const classes: string[] = [];
    if (settings.topBarStatisticsOfMeEnabled === false) classes.push('options-no-streamer-stats');
    if (settings.topBarStatisticsOfOpponentEnabled === false || isBnetLadderFfa(match)) classes.push('options-no-opponent-stats');
    if (!standardGame.isMode(match.mode, '1v1') && settings.topBarPlayerColorsEnabled === false) classes.push('options-no-player-colors');
    if (standardGame.isMode(match.mode, '1v1') && settings.topBarPlayerColorsEnabledIn1V1 !== true) classes.push('options-no-player-colors');
    return classes.join(' ');
}

export function formatGameTime(seconds: number, compactHours = false): string {
    const time = new Date(Math.max(0, seconds) * 1000).toISOString().substring(14, 19);
    return compactHours ? time.replace(/^00/, '0') : time;
}

export function truncated(value: number, digits: number): string {
    const precision = Math.max(0, Math.trunc(digits));
    const factor = 10 ** precision;
    return (Math.trunc(value * factor) / factor).toFixed(precision);
}

function isBnetLadderFfa(match: Match): boolean {
    return standardGame.isMode(match.mode, '4ffa') && !match.isReplay && !match.isObserver;
}
