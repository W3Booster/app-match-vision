import { Injectable, effect, inject } from '@angular/core';
import { surfaceFromSearch } from './surface';
import { MatchVisionClientService } from './match-vision-client.service';
import { AutomaticScoreController } from '../features/dashboard/automatic-score.controller';

@Injectable({ providedIn: 'root' })
export class AutomaticScoreService extends AutomaticScoreController {
    private readonly connection = inject(MatchVisionClientService);
    private readonly binding = effect(onCleanup => {
        if (surfaceFromSearch(window.location.search) === 'overlay') return;
        const client = this.connection.client();
        const host = this.connection.host();
        if (client && host.available && host.capabilities.includes('command')) {
            this.connect(client.host, client.state);
            onCleanup(() => this.disconnect());
        }
    });
}
