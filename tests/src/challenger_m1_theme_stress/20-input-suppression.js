    // CATEGORY 2: INPUT TYPING SUPPRESSION & KEYBOARD SHORTCUTS
    // =========================================================================
    console.log('\n----------------------------------------------------------------');
    console.log('CATEGORY 2: INPUT TYPING SUPPRESSION & SHORTCUT MODIFIERS');
    console.log('----------------------------------------------------------------');

    // Reset theme to tokyo-night
    await cdp.eval('window.ClownTheme.setTheme("tokyo-night")');
    await new Promise(r => setTimeout(r, 100));

    // 2.1: Modifiers (Ctrl, Cmd, Alt) must not trigger theme cycle
    const modCheck = await cdp.eval(`
      (() => {
        const start = window.ClownTheme.getCurrentTheme();
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 't', ctrlKey: true, bubbles: true }));
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 't', metaKey: true, bubbles: true }));
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 't', altKey: true, bubbles: true }));
        const after = window.ClownTheme.getCurrentTheme();
        return start === after;
      })()
    `);
    record('2.1 Modifiers (Ctrl+t, Cmd+t, Alt+t) suppressed from theme cycling', modCheck);

    // 2.2: Typing in <input> suppressed
    const inputCheck = await cdp.eval(`
      (() => {
        const input = document.createElement('input');
        input.type = 'text';
        document.body.appendChild(input);
        input.focus();
        const start = window.ClownTheme.getCurrentTheme();
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 't', bubbles: true }));
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'T', bubbles: true }));
        const after = window.ClownTheme.getCurrentTheme();
        document.body.removeChild(input);
        return start === after;
      })()
    `);
    record('2.2 Keystrokes "t" and "T" inside <input> strictly suppressed', inputCheck);

    // 2.3: Typing in Command Palette (#palette-input) suppressed
    const paletteCheck = await cdp.eval(`
      (() => {
        const pInput = document.getElementById('palette-input');
        if (!pInput) return false;
        pInput.focus();
        const start = window.ClownTheme.getCurrentTheme();
        pInput.dispatchEvent(new KeyboardEvent('keydown', { key: 't', bubbles: true }));
        pInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'T', bubbles: true }));
        const after = window.ClownTheme.getCurrentTheme();
        return start === after;
      })()
    `);
    record('2.3 Keystrokes "t" and "T" inside #palette-input strictly suppressed', paletteCheck);

    // 2.4: Typing in <textarea> suppressed
    const taCheck = await cdp.eval(`
      (() => {
        const ta = document.createElement('textarea');
        document.body.appendChild(ta);
        ta.focus();
        const start = window.ClownTheme.getCurrentTheme();
        ta.dispatchEvent(new KeyboardEvent('keydown', { key: 't', bubbles: true }));
        const after = window.ClownTheme.getCurrentTheme();
        document.body.removeChild(ta);
        return start === after;
      })()
    `);
    record('2.4 Keystrokes inside <textarea> strictly suppressed', taCheck);

    // 2.5: Typing in <select> suppressed
    const selCheck = await cdp.eval(`
      (() => {
        const sel = document.createElement('select');
        document.body.appendChild(sel);
        sel.focus();
        const start = window.ClownTheme.getCurrentTheme();
        sel.dispatchEvent(new KeyboardEvent('keydown', { key: 't', bubbles: true }));
        const after = window.ClownTheme.getCurrentTheme();
        document.body.removeChild(sel);
        return start === after;
      })()
    `);
    record('2.5 Keystrokes inside <select> strictly suppressed', selCheck);

    // 2.6: Typing in contenteditable element and descendant span suppressed
    const ceCheck = await cdp.eval(`
      (() => {
        const ce = document.createElement('div');
        ce.contentEditable = 'true';
        ce.innerHTML = '<span>nested text</span>';
        document.body.appendChild(ce);
        const childSpan = ce.querySelector('span');
        const start = window.ClownTheme.getCurrentTheme();
        ce.dispatchEvent(new KeyboardEvent('keydown', { key: 't', bubbles: true }));
        childSpan.dispatchEvent(new KeyboardEvent('keydown', { key: 't', bubbles: true }));
        const after = window.ClownTheme.getCurrentTheme();
        document.body.removeChild(ce);
        return start === after;
      })()
    `);
    record('2.6 Keystrokes inside contenteditable and descendants suppressed', ceCheck);

    // =========================================================================
