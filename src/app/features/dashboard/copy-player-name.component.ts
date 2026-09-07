import { Component, OnDestroy, input, signal } from '@angular/core';

@Component({
    selector: 'mv-copy-player-name',
    template: `
        <span class="name">{{name()}}</span>
        <button type="button" (click)="copy()" [attr.aria-label]="'Copy ' + name()"
            [title]="message() || 'Copy ' + name()">
            <svg aria-hidden="true" viewBox="0 0 16 16">
                @if (copiedName() === name()) {
                    <path d="m3 8 3 3 7-7" />
                } @else {
                    <rect x="5.5" y="5.5" width="8" height="8" rx="1" />
                    <path d="M10.5 3.5v-1h-8v8h1" />
                }
            </svg>
        </button>
        <span class="status" role="status">{{message()}}</span>
    `,
    styles: `
        :host { display: inline-flex; align-items: baseline; gap: 4px; min-width: 0; max-width: 100%; }
        .name { min-width: 0; overflow-wrap: anywhere; user-select: text; }
        button { display: inline-flex; align-self: center; align-items: center; justify-content: center;
            flex: 0 0 24px; width: 24px; height: 24px; padding: 4px; border: 0; border-radius: 3px;
            background: transparent; color: #8da6b5; cursor: pointer; }
        button:hover { background: #263b47; color: #d7edfa; }
        button:focus-visible { outline: 2px solid #56bce9; outline-offset: 1px; }
        svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 1.4;
            stroke-linecap: round; stroke-linejoin: round; }
        .status { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
    `
})
export class CopyPlayerNameComponent implements OnDestroy {
    readonly name = input.required<string>();
    readonly copiedName = signal<string | null>(null);
    readonly message = signal('');
    private resetTimer?: ReturnType<typeof setTimeout>;

    async copy(): Promise<void> {
        const name = this.name();
        let copied = false;
        try {
            await navigator.clipboard.writeText(name);
            copied = true;
        } catch {
            // Embedded desktop/iframe contexts may not expose the Clipboard API.
            const active = document.activeElement as HTMLElement | null;
            const selection = document.getSelection();
            const ranges = selection ? Array.from({ length: selection.rangeCount }, (_, index) => selection.getRangeAt(index).cloneRange()) : [];
            const field = document.createElement('textarea');
            field.value = name;
            field.readOnly = true;
            field.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
            document.body.append(field);
            field.select();
            try { copied = document.execCommand('copy'); } catch { /* Report failure below. */ }
            finally {
                field.remove();
                active?.focus({ preventScroll: true });
                selection?.removeAllRanges();
                for (const range of ranges) selection?.addRange(range);
            }
        }
        this.copiedName.set(copied ? name : null);
        this.message.set(copied ? 'Copied ' + name : 'Could not copy. Select the name and copy it manually.');
        clearTimeout(this.resetTimer);
        this.resetTimer = setTimeout(() => { this.copiedName.set(null); this.message.set(''); }, 2500);
    }

    ngOnDestroy(): void { clearTimeout(this.resetTimer); }
}
