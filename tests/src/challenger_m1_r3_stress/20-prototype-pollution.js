    // SECTION 2: AUDIO PROTOTYPE POLLUTION & HOSTILE TYPE TESTING
    // =========================================================================
    console.log('\n----------------------------------------------------------------');
    console.log('SECTION 2: AUDIO PROTOTYPE POLLUTION & HOSTILE TYPE VECTORS');
    console.log('----------------------------------------------------------------');

    const hostileVectorsTest = await cdp.eval(`
      (() => {
        const tests = [];
        const dangerousKeys = [
          '__proto__',
          'constructor',
          'prototype',
          'toString',
          'valueOf',
          'hasOwnProperty',
          'isPrototypeOf',
          'propertyIsEnumerable',
          'toLocaleString',
          '__defineGetter__',
          '__defineSetter__',
          '__lookupGetter__',
          '__lookupSetter__'
        ];

        // 1. Prototype property attacks
        for (const key of dangerousKeys) {
          try {
            const res = window.ClownAudio.playSfx(key);
            tests.push({
              vector: key,
              type: typeof key,
              result: res,
              pass: res === false,
              threw: false
            });
          } catch (err) {
            tests.push({
              vector: key,
              type: typeof key,
              result: null,
              pass: false,
              threw: true,
              error: err.message
            });
          }
        }

        // 2. Hostile primitive & non-string types
        const nonStrings = [
          { name: 'null', val: null },
          { name: 'undefined', val: undefined },
          { name: 'number-0', val: 0 },
          { name: 'number-1', val: 1 },
          { name: 'NaN', val: NaN },
          { name: 'Infinity', val: Infinity },
          { name: 'boolean-true', val: true },
          { name: 'boolean-false', val: false },
          { name: 'object-empty', val: {} },
          { name: 'array-empty', val: [] },
          { name: 'function', val: () => {} },
          { name: 'symbol', val: Symbol('exploit') }
        ];

        for (const item of nonStrings) {
          try {
            const res = window.ClownAudio.playSfx(item.val);
            tests.push({
              vector: item.name,
              type: typeof item.val,
              result: res,
              pass: res === false,
              threw: false
            });
          } catch (err) {
            tests.push({
              vector: item.name,
              type: typeof item.val,
              result: null,
              pass: false,
              threw: true,
              error: err.message
            });
          }
        }

        // 3. Verify Object.prototype was NOT polluted
        const protoPristine = (
          typeof Object.prototype.hover === 'undefined' &&
          typeof Object.prototype.select === 'undefined' &&
          typeof Object.prototype.polluted === 'undefined'
        );

        const allPass = tests.every(t => t.pass) && protoPristine;
        return {
          allPass,
          protoPristine,
          failedCount: tests.filter(t => !t.pass).length,
          failures: tests.filter(t => !t.pass),
          totalTested: tests.length
        };
      })()
    `);
    record(
      `2.1 Hostile type & prototype pollution matrix (${hostileVectorsTest.totalTested} vectors fail-closed without throwing)`,
      hostileVectorsTest.allPass,
      `Failures: ${JSON.stringify(hostileVectorsTest.failures)}`
    );

    // =========================================================================
