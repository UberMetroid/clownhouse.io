    // CATEGORY 2: NULL & BOUNDARY SEARCH INVARIANTS IN ClownPalette.search()
    // =========================================================================
    console.log('\n----------------------------------------------------------------');
    console.log('CATEGORY 2: NULL & BOUNDARY SEARCH INVARIANTS IN ClownPalette.search()');
    console.log('----------------------------------------------------------------');

    // 2.1: ClownPalette.search(null) returns [] without throwing TypeError
    const searchNullResult = await cdp.eval(`
      (() => {
        try {
          const res = window.ClownPalette.search(null);
          return {
            isArray: Array.isArray(res),
            length: res.length,
            success: Array.isArray(res) && res.length === 0
          };
        } catch (err) {
          return { error: err.message };
        }
      })()
    `);
    record(
      '2.1 ClownPalette.search(null) returns [] fail-closed without TypeError',
      searchNullResult.success === true,
      JSON.stringify(searchNullResult)
    );

    // 2.2: ClownPalette.search(undefined) returns []
    const searchUndefinedResult = await cdp.eval(`
      (() => {
        try {
          const res = window.ClownPalette.search(undefined);
          return Array.isArray(res) && res.length === 0;
        } catch (err) {
          return false;
        }
      })()
    `);
    record(
      '2.2 ClownPalette.search(undefined) returns [] fail-closed',
      searchUndefinedResult === true
    );

    // 2.3: ClownPalette.search(Symbol('query')) returns []
    const searchSymbolResult = await cdp.eval(`
      (() => {
        try {
          const res = window.ClownPalette.search(Symbol('query'));
          return Array.isArray(res) && res.length === 0;
        } catch (err) {
          return false;
        }
      })()
    `);
    record(
      '2.3 ClownPalette.search(Symbol("query")) returns [] fail-closed',
      searchSymbolResult === true
    );

    // 2.4: Non-string search matrix (number, boolean, object, array, function)
    const searchNonStringResult = await cdp.eval(`
      (() => {
        const nonStrings = [
          0,
          12345,
          true,
          false,
          {},
          [],
          () => {},
          { toString() { return 'openooda'; } }
        ];
        let safe = 0;
        for (const input of nonStrings) {
          try {
            const res = window.ClownPalette.search(input);
            if (Array.isArray(res) && res.length === 0) {
              safe++;
            }
          } catch (e) {}
        }
        return { safe, total: nonStrings.length };
      })()
    `);
    record(
      `2.4 Non-string inputs matrix: all ${searchNonStringResult.total} return [] fail-closed`,
      searchNonStringResult.safe === searchNonStringResult.total
    );

    // 2.5: Empty string & whitespace returns full catalog (>= 26 items)
    const emptyQueryResults = await cdp.eval(`
      (() => {
        const resEmpty = window.ClownPalette.search('');
        const resSpaces = window.ClownPalette.search('    ');
        return {
          emptyCount: resEmpty.length,
          spacesCount: resSpaces.length,
          success: resEmpty.length >= 26 && resEmpty.length === resSpaces.length
        };
      })()
    `);
    record(
      '2.5 ClownPalette.search("") and search("   ") return complete catalog (>= 26 items)',
      emptyQueryResults.success === true,
      `emptyCount: ${emptyQueryResults.emptyCount}, spacesCount: ${emptyQueryResults.spacesCount}`
    );

    // 2.6: Exact token query matching openOODA
    const openoodaSearchResult = await cdp.eval(`
      (() => {
        const res = window.ClownPalette.search('openooda');
        return {
          count: res.length,
          firstId: res.length > 0 ? res[0].id : null,
          success: res.length >= 1 && res[0].id === 'proj-openooda'
        };
      })()
    `);
    record(
      '2.6 ClownPalette.search("openooda") locates proj-openooda as primary match',
      openoodaSearchResult.success === true,
      JSON.stringify(openoodaSearchResult)
    );

    // 2.7: Multi-token fuzzy query
    const multiTokenResult = await cdp.eval(`
      (() => {
        const res = window.ClownPalette.search('necrometer telemetry');
        return {
          count: res.length,
          hasNecrometer: res.some(i => i.id === 'proj-necrometer'),
          success: res.length >= 1 && res.some(i => i.id === 'proj-necrometer')
        };
      })()
    `);
    record(
      '2.7 Multi-token search ("necrometer telemetry") resolves correctly',
      multiTokenResult.success === true
    );

    // 2.8: Impossible token query returns empty array
    const impossibleQueryResult = await cdp.eval(`
      (() => {
        const res = window.ClownPalette.search('impossible-token-xyz-0987654321');
        return Array.isArray(res) && res.length === 0;
      })()
    `);
    record(
      '2.8 Impossible query returns empty array [] with 0 matches',
      impossibleQueryResult === true
    );

    // =========================================================================
