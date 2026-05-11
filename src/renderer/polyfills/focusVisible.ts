const FOCUS_VISIBLE_SELECTOR = ':focus-visible';

function supportsFocusVisible(): boolean {
    try {
        document.createElement('span').matches(FOCUS_VISIBLE_SELECTOR);
        return true;
    } catch {
        return false;
    }
}

if (typeof document !== 'undefined' && typeof Element !== 'undefined' && !supportsFocusVisible()) {
    const nativeMatches = Element.prototype.matches;

    Element.prototype.matches = function patchedMatches(selector: string): boolean {
        if (selector === FOCUS_VISIBLE_SELECTOR) {
            return this.classList.contains('focus-visible') || this.classList.contains('Mui-focusVisible');
        }

        return nativeMatches.call(this, selector);
    };
}
