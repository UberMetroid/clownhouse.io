/**
 * CLOWNHOUSE.IO // MULTI-CONCEPT THEME SHOWCASE CONTROLLER
 * Milestone M1: Core Shell & Dynamic Switcher Bar Controller
 * 
 * Features:
 * - Real-time hot-swapping across 5 bespoke themes without page reload
 * - Fail-closed localStorage persistence with strict whitelist validation
 * - CustomEvent 'themechange' and 'soundstatechange' dispatching
 * - Master audio mute toggle state management & ClownAudio coordination
 * - Universal link delegation (.theme-link) for procedural audio triggers
 * - Fully accessible keyboard navigation (WAI-ARIA roving tabindex tabs pattern)
 * - Interactive widget ergonomics (Genesis volume slider, MMX Buster charge)
 * - Zero syntax errors (node --check compliant)
 */

(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.clownhouse = factory();
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // --- Constants & Whitelists ---
  var VALID_THEMES = Object.freeze([
    'tower-of-power',
    'chozo-visor',
    'wrx-telemetry',
    'hunter-base',
    'pacific-outpost'
  ]);

  var DEFAULT_THEME = 'tower-of-power';

  var STORAGE_KEYS = Object.freeze({
    THEME: 'clownhouse_theme',
    SOUND: 'clownhouse_sound'
  });

  // --- State ---
  var currentTheme = DEFAULT_THEME;
  var isMuted = true; // Audio is muted by default per autoplay requirements
  var isInitialized = false;

  // --- Safe Storage Layer (Fail-Closed) ---
  function safeGetStorage(key) {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
    } catch (err) {
      // Catch SecurityError / DOMException (Safari private browsing, blocked storage)
    }
    return null;
  }

  function safeSetStorage(key, value) {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
        return true;
      }
    } catch (err) {
      // QuotaExceededError or SecurityError
    }
    return false;
  }

  // --- Safe DOM Query Helpers ---
  function safeQuery(parent, sel) {
    if (!parent) return null;
    try {
      if (typeof parent.querySelector === 'function') {
        return parent.querySelector(sel);
      }
      if (typeof parent.querySelectorAll === 'function') {
        var all = parent.querySelectorAll(sel);
        return (all && all.length > 0) ? all[0] : null;
      }
      if (parent === document && typeof document !== 'undefined' && document.body && typeof document.body.querySelectorAll === 'function') {
        var allBody = document.body.querySelectorAll(sel);
        return (allBody && allBody.length > 0) ? allBody[0] : null;
      }
    } catch (e) {}
    return null;
  }

  function safeQueryAll(parent, sel) {
    if (!parent) return [];
    try {
      var res = null;
      if (typeof parent.querySelectorAll === 'function') {
        res = parent.querySelectorAll(sel);
      } else if (parent === document && typeof document !== 'undefined' && document.body && typeof document.body.querySelectorAll === 'function') {
        res = document.body.querySelectorAll(sel);
      }
      if (!res) return [];
      if (Array.isArray(res)) return res;
      if (typeof res.forEach === 'function') return res;
      return Array.prototype.slice.call(res);
    } catch (e) {}
    return [];
  }

  function isValidTheme(theme) {
    return typeof theme === 'string' && VALID_THEMES.indexOf(theme) !== -1;
  }

  function resolveInitialTheme() {
    var stored = null;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        stored = window.localStorage.getItem('clownhouse_theme');
      }
    } catch (err) {
      // Safe fallback on SecurityError
    }

    if (isValidTheme(stored)) {
      return stored;
    }
    // If stored value was present but invalid/corrupted, overwrite with default to self-heal
    if (stored !== null) {
      safeSetStorage('clownhouse_theme', DEFAULT_THEME);
    }
    return DEFAULT_THEME;
  }

  // --- Dynamic Theme Hot-Swapping ---
  function setTheme(themeName, options) {
    var opts = options || {};
    var force = Boolean(opts.force);
    var triggerAudio = opts.triggerAudio !== false;

    // Fail-closed validation
    if (!isValidTheme(themeName)) {
      var safeThemeStr = 'unknown';
      try {
        if (typeof themeName === 'symbol') {
          safeThemeStr = themeName.toString();
        } else if (themeName && typeof themeName === 'object' && Object.getPrototypeOf(themeName) === null) {
          safeThemeStr = '[object Object]';
        } else {
          safeThemeStr = String(themeName);
        }
      } catch (e) {
        safeThemeStr = '[unserializable]';
      }
      console.warn('[clownhouse] Invalid theme rejected: "' + safeThemeStr + '". Keeping: "' + currentTheme + '".');
      return false;
    }

    if (themeName === currentTheme && !force && isInitialized) {
      return true;
    }

    var previousTheme = currentTheme;
    currentTheme = themeName;

    // Persist to storage
    safeSetStorage(STORAGE_KEYS.THEME, themeName);

    // Update DOM attributes on root and body
    if (typeof document !== 'undefined') {
      var rootEl = document.documentElement;
      if (rootEl) {
        rootEl.setAttribute('data-theme', themeName);
      }
      if (document.body) {
        document.body.setAttribute('data-theme', themeName);
      }

      // Update Switcher Buttons UI
      var buttons = document.querySelectorAll(
        '#theme-switcher-bar [data-theme], #theme-switcher-bar [data-theme-target], .theme-btn, .theme-switcher-btn, .switcher-btn'
      );
      for (var i = 0; i < buttons.length; i++) {
        var btn = buttons[i];
        var btnTarget = btn.getAttribute('data-theme') || btn.getAttribute('data-theme-target');
        var isMatch = (btnTarget === themeName);

        if (isMatch) {
          btn.classList.add('active');
          btn.setAttribute('aria-pressed', 'true');
          btn.setAttribute('aria-selected', 'true');
          btn.setAttribute('tabindex', '0');
        } else {
          btn.classList.remove('active');
          btn.setAttribute('aria-pressed', 'false');
          btn.setAttribute('aria-selected', 'false');
          btn.setAttribute('tabindex', '-1');
        }
      }

      // Update Theme Containers UI (Show active, hide others)
      var containers = document.querySelectorAll('.theme-container');
      for (var j = 0; j < containers.length; j++) {
        var container = containers[j];
        var containerTheme = container.getAttribute('data-theme') || container.id.replace(/^theme-/, '');
        var isContainerMatch = (containerTheme === themeName);

        if (isContainerMatch) {
          container.classList.add('active');
          container.removeAttribute('hidden');
          container.setAttribute('aria-hidden', 'false');
        } else {
          container.classList.remove('active');
          container.setAttribute('hidden', '');
          container.setAttribute('aria-hidden', 'true');
        }
      }
    }

    // Coordinate with Audio Engine (ClownAudio) if available
    if (typeof window !== 'undefined' && window.ClownAudio) {
      if (typeof window.ClownAudio.setTheme === 'function') {
        try {
          window.ClownAudio.setTheme(themeName);
        } catch (e) {
          // Audio safety guard
        }
      }
      if (triggerAudio && !isMuted && typeof window.ClownAudio.playSfx === 'function') {
        try {
          window.ClownAudio.playSfx('switch');
        } catch (e) {
          // Audio safety guard
        }
      }
    }

    // Dispatch CustomEvent 'themechange' on window and document
    if (typeof window !== 'undefined' && typeof window.CustomEvent === 'function') {
      var eventDetail = {
        theme: themeName,
        previousTheme: previousTheme
      };
      var event = new CustomEvent('themechange', {
        bubbles: false,
        cancelable: true,
        detail: eventDetail
      });
      window.dispatchEvent(event);
      if (typeof document !== 'undefined' && typeof document.dispatchEvent === 'function') {
        document.dispatchEvent(event);
      }
    }

    return true;
  }

  // --- Master Audio Mute Toggle ---
  function updateSoundUI(muted) {
    if (typeof document === 'undefined') return;
    var toggleBtn = document.getElementById('sound-toggle');
    if (!toggleBtn) return;

    toggleBtn.setAttribute('aria-pressed', muted ? 'false' : 'true');
    toggleBtn.setAttribute('title', muted ? 'Sound: Muted (Click to unmute)' : 'Sound: Active (Click to mute)');

    if (muted) {
      toggleBtn.classList.remove('active');
      toggleBtn.classList.add('muted');
    } else {
      toggleBtn.classList.remove('muted');
      toggleBtn.classList.add('active');
    }

    var stateSpan = safeQuery(toggleBtn, '.btn-state');
    if (stateSpan) {
      stateSpan.textContent = muted ? 'MUTED' : 'ACTIVE';
    } else {
      var currentLabel = toggleBtn.textContent.trim();
      if (/^SOUND:/i.test(currentLabel)) {
        toggleBtn.textContent = muted ? 'SOUND: MUTED' : 'SOUND: ACTIVE';
      }
    }
  }

  function toggleSound(forcedState) {
    var targetMuted;
    if (typeof forcedState === 'boolean') {
      targetMuted = forcedState;
    } else {
      targetMuted = !isMuted;
    }

    isMuted = targetMuted;
    safeSetStorage(STORAGE_KEYS.SOUND, isMuted ? 'off' : 'on');

    // Coordinate with ClownAudio engine
    if (typeof window !== 'undefined' && window.ClownAudio) {
      if (!isMuted && typeof window.ClownAudio.initContext === 'function') {
        try {
          window.ClownAudio.initContext();
        } catch (e) {
          // Ignore context errors
        }
      }
      if (typeof window.ClownAudio.toggleMute === 'function') {
        try {
          if (typeof window.ClownAudio.isMuted === 'function') {
            if (window.ClownAudio.isMuted() !== isMuted) {
              window.ClownAudio.toggleMute();
            }
          } else {
            window.ClownAudio.toggleMute();
          }
        } catch (e) {
          // Audio safety guard
        }
      }
      if (!isMuted && typeof window.ClownAudio.playSfx === 'function') {
        try {
          window.ClownAudio.playSfx('switch');
        } catch (e) {
          // Audio safety guard
        }
      }
    }

    updateSoundUI(isMuted);

    // Dispatch CustomEvent 'soundstatechange'
    if (typeof window !== 'undefined' && typeof window.CustomEvent === 'function') {
      var event = new CustomEvent('soundstatechange', {
        bubbles: true,
        cancelable: true,
        detail: { muted: isMuted }
      });
      window.dispatchEvent(event);
    }

    return isMuted;
  }

  // --- Volume Control Helper ---
  function setVolume(fraction) {
    var num = 0;
    try {
      if (typeof fraction === 'number') {
        num = fraction;
      } else if (typeof fraction === 'string') {
        num = parseFloat(fraction) || 0;
      } else if (fraction !== null && typeof fraction !== 'undefined' && typeof fraction !== 'symbol') {
        var n = Number(fraction);
        num = isNaN(n) ? 0 : n;
      }
    } catch (e) {
      num = 0;
    }
    if (isNaN(num) || typeof num !== 'number') {
      num = 0;
    }
    var vol = Math.max(0, Math.min(1, num));
    if (typeof window !== 'undefined' && window.ClownAudio && typeof window.ClownAudio.setVolume === 'function') {
      try {
        window.ClownAudio.setVolume(vol);
      } catch (e) {
        // Audio safety guard
      }
    }
    return vol;
  }

  // --- Interactive Widgets Setup ---
  function setupInteractiveWidgets() {
    if (typeof document === 'undefined') return;

    // =========================================================================
    // 1. SEGA GENESIS VOLUME SLIDER CONTROLLER (#top-volume-slider)
    // =========================================================================
    try {
      (function setupSegaVolumeSlider() {
        var volSlider = document.getElementById('top-volume-slider');
        var volVal = document.getElementById('top-volume-val');
        var resetBtn = document.getElementById('top-reset-btn');
        var powerLed = safeQuery(document, '.power-led');

        if (!volSlider && !resetBtn) return;

        function applyVolume(val, triggerAudio) {
          var numericVal = parseInt(val, 10);
          if (isNaN(numericVal)) numericVal = 7;
          numericVal = Math.max(0, Math.min(10, numericVal));

          if (volSlider && volSlider.value !== String(numericVal)) {
            volSlider.value = numericVal;
          }
          if (volSlider) {
            volSlider.setAttribute('aria-valuenow', String(numericVal));
          }
          if (volVal) {
            volVal.textContent = String(numericVal);
          }

          var fraction = numericVal / 10;
          setVolume(fraction);

          // Highlight tick marks up to current value
          var ticks = safeQueryAll(document, '.slider-scale .slider-tick');
          if (ticks && ticks.length > 0) {
            ticks.forEach(function (tick, idx) {
              if (idx <= (numericVal / 2)) {
                tick.classList.add('tick-active');
              } else {
                tick.classList.remove('tick-active');
              }
            });
          }

          // Subtle audio feedback when sliding while unmuted
          if (triggerAudio && !isMuted && typeof window !== 'undefined' && window.ClownAudio && typeof window.ClownAudio.playTone === 'function') {
            try {
              window.ClownAudio.playTone(300 + (numericVal * 60), 'sine', 0.02, 0.08);
            } catch (e) {}
          }
        }

        if (volSlider) {
          volSlider.addEventListener('input', function () {
            applyVolume(volSlider.value, true);
          });
          volSlider.addEventListener('change', function () {
            applyVolume(volSlider.value, false);
          });
        }

        if (resetBtn) {
          resetBtn.addEventListener('click', function () {
            applyVolume(7, false);
            if (powerLed) {
              powerLed.classList.add('led-reset-blink');
              setTimeout(function () {
                powerLed.classList.remove('led-reset-blink');
              }, 600);
            }
            if (!isMuted && typeof window !== 'undefined' && window.ClownAudio && typeof window.ClownAudio.playSfx === 'function') {
              try {
                window.ClownAudio.playSfx('special');
              } catch (e) {}
            }
          });
        }
      })();
    } catch (err) {}

    // =========================================================================
    // 2. WRX TR TURBO BOOST GAUGE & SHIFT LIGHTS DYNAMICS
    // =========================================================================
    try {
      (function setupWrxBoostGauge() {
        var wrxContainer = document.getElementById('theme-wrx-telemetry');
        var gaugeWidget = safeQuery(wrxContainer, '.boost-gauge-widget') || safeQuery(document, '.boost-gauge-widget') || safeQuery(document, '.boost-gauge');
        var boostReadout = safeQuery(gaugeWidget || wrxContainer || document, '.boost-readout');
        var peakReadout = safeQuery(gaugeWidget || wrxContainer || document, '.peak-readout');
        var rpmVal = document.getElementById('wrx-rpm-val');
        var needleGroup = document.getElementById('wrx-needle-group');
        var throttleBtn = document.getElementById('wrx-throttle-btn');
        var shiftLeds = safeQueryAll(wrxContainer || document, '.shift-lights .shift-led');

        if (!gaugeWidget && !needleGroup && !throttleBtn) return;

        var currentBar = -0.50;
        var targetBar = -0.50;
        var peakBar = 1.68;
        var isHovered = false;
        var rafId = null;

        function updateGaugeDisplay(barVal) {
          if (boostReadout) {
            var prefix = barVal >= 0 ? '+' : '';
            boostReadout.innerHTML = prefix + barVal.toFixed(2) + ' <span class="gauge-unit">BAR</span>';
          }

          // Rotate SVG analog indicator needle (-1.0 bar = -135deg, +1.8 bar = +135deg)
          if (needleGroup) {
            var clamped = Math.max(-1.0, Math.min(1.8, barVal));
            var angle = -135 + ((clamped - (-1.0)) / 2.8) * 270;
            needleGroup.style.transform = 'rotate(' + angle.toFixed(1) + 'deg)';
          }

          // Sequential Shift Lights illumination across 7 stages
          if (shiftLeds && shiftLeds.length >= 7) {
            if (barVal > -0.2) shiftLeds[0].classList.add('active');
            else shiftLeds[0].classList.remove('active');

            if (barVal > 0.2) shiftLeds[1].classList.add('active');
            else shiftLeds[1].classList.remove('active');

            if (barVal > 0.6) shiftLeds[2].classList.add('active');
            else shiftLeds[2].classList.remove('active');

            if (barVal > 1.0) shiftLeds[3].classList.add('active');
            else shiftLeds[3].classList.remove('active');

            if (barVal > 1.3) shiftLeds[4].classList.add('active');
            else shiftLeds[4].classList.remove('active');

            if (barVal > 1.5) shiftLeds[5].classList.add('active');
            else shiftLeds[5].classList.remove('active');

            if (barVal > 1.65) {
              shiftLeds[6].classList.add('active', 'redline-active');
            } else {
              shiftLeds[6].classList.remove('active', 'redline-active');
            }
          }

          // Update tachometer numeric display
          if (rpmVal) {
            var clampedBar = Math.max(-1.0, Math.min(1.8, barVal));
            var calculatedRpm = Math.round(3500 + ((clampedBar - (-1.0)) / 2.8) * 4000);
            rpmVal.textContent = calculatedRpm.toLocaleString() + ' RPM';
          }

          // Update peak hold
          if (barVal > peakBar) {
            peakBar = barVal;
            if (peakReadout) {
              peakReadout.textContent = 'PEAK: +' + peakBar.toFixed(2) + ' BAR';
            }
          }
        }

        function isWrxActive() {
          return currentTheme === 'wrx-telemetry' || (wrxContainer && wrxContainer.classList.contains('active') && !wrxContainer.hidden);
        }

        function startGaugeLoop() {
          if (rafId !== null) return;
          if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
            rafId = window.requestAnimationFrame(stepGauge);
          } else {
            updateGaugeDisplay(currentBar);
          }
        }

        function stopGaugeLoop() {
          if (rafId !== null) {
            if (typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function') {
              window.cancelAnimationFrame(rafId);
            }
            rafId = null;
          }
        }

        function stepGauge() {
          rafId = null;
          if (!isWrxActive()) {
            return;
          }

          var diff = targetBar - currentBar;
          if (Math.abs(diff) > 0.01) {
            currentBar += diff * 0.22; // Smooth spring dampening
          } else {
            currentBar = targetBar;
          }

          // Idle micro-flutter when sitting at engine vacuum
          if (!isHovered && Math.abs(currentBar - (-0.50)) < 0.05) {
            var flutter = (Math.sin(Date.now() / 250) * 0.03);
            updateGaugeDisplay(currentBar + flutter);
          } else {
            updateGaugeDisplay(currentBar);
          }

          if (isWrxActive() && typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
            rafId = window.requestAnimationFrame(stepGauge);
          }
        }

        // Start loop only if WRX telemetry is currently active
        if (isWrxActive()) {
          startGaugeLoop();
        } else {
          updateGaugeDisplay(currentBar);
        }

        // Listen for themechange to pause/resume animation frame loop
        if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
          window.addEventListener('themechange', function (e) {
            var nextTheme = e && e.detail ? e.detail.theme : currentTheme;
            if (nextTheme === 'wrx-telemetry') {
              startGaugeLoop();
            } else {
              stopGaugeLoop();
            }
          });
        }

        function triggerSpool(intensity) {
          isHovered = true;
          targetBar = typeof intensity === 'number' ? intensity : 1.58;
        }

        function triggerDump() {
          isHovered = false;
          targetBar = -0.50; // Return to engine vacuum
        }

        if (gaugeWidget) {
          gaugeWidget.addEventListener('mouseenter', function () {
            triggerSpool(1.72);
          });
          gaugeWidget.addEventListener('mouseleave', triggerDump);
          gaugeWidget.addEventListener('click', function () {
            triggerSpool(1.78);
            setTimeout(triggerDump, 400);
          });
        }

        if (throttleBtn) {
          throttleBtn.addEventListener('click', function () {
            triggerSpool(1.80);
            if (!isMuted && typeof window !== 'undefined' && window.ClownAudio && typeof window.ClownAudio.playSfx === 'function') {
              try {
                window.ClownAudio.playSfx('special');
              } catch (e) {}
            }
            setTimeout(triggerDump, 600);
          });
        }

        // Spool boost when hovering any rally checkpoint inside WRX theme
        if (wrxContainer) {
          var checkpoints = safeQueryAll(wrxContainer, '.rally-checkpoint, .rally-link');
          checkpoints.forEach(function (cp) {
            cp.addEventListener('mouseenter', function () {
              triggerSpool(1.48);
            });
            cp.addEventListener('mouseleave', triggerDump);
          });
        }
      })();
    } catch (err) {}

    // =========================================================================
    // 3. MEGA MAN X BUSTER CHARGE & HEALTH METER CONTROLLER
    // =========================================================================
    try {
      (function setupBusterCharge() {
        var chargeBtn = document.getElementById('buster-charge-btn');
        var chargeIndicator = document.getElementById('charge-indicator');
        var chargeBar = document.getElementById('charge-bar');
        var chargeWidget = document.getElementById('buster-charge-widget');
        var healthMeter = document.getElementById('hunter-health-meter');
        var healthNumeric = document.getElementById('hunter-health-numeric');

        // Health meter interactive refill simulation
        if (healthMeter) {
          healthMeter.addEventListener('click', function () {
            var ticks = safeQueryAll(healthMeter, '.health-bar-28 .tick');
            if (ticks && ticks.length > 0) {
              ticks.forEach(function (t, i) {
                t.classList.remove('filled');
                setTimeout(function () {
                  t.classList.add('filled');
                }, i * 25);
              });
              if (healthNumeric) healthNumeric.textContent = '28/28';
              if (!isMuted && typeof window !== 'undefined' && window.ClownAudio && typeof window.ClownAudio.playTone === 'function') {
                try {
                  window.ClownAudio.playTone(660, 'square', 0.12, 0.3);
                } catch (e) {}
              }
            }
          });
        }

        if (!chargeBtn) return;

        var chargeStartTime = 0;
        var chargeTimer = null;
        var isCharging = false;

        function updateChargeAura(level) {
          if (chargeBtn) {
            chargeBtn.setAttribute('data-charge-level', level);
            chargeBtn.classList.remove('charging-blue', 'charging-green', 'charging-pink');
            if (level !== 'idle') {
              chargeBtn.classList.add('charging-' + level);
            }
          }
        }

        function startCharging(e) {
          if (isCharging) return;
          isCharging = true;
          chargeStartTime = Date.now();
          updateChargeAura('blue');

          if (chargeIndicator) {
            chargeIndicator.textContent = 'CHARGING: LV1 [BLUE]';
          }
          if (chargeBar) {
            chargeBar.style.width = '33%';
          }

          // Periodic charge step check
          chargeTimer = setInterval(function () {
            if (!isCharging) return;
            var elapsed = Date.now() - chargeStartTime;

            if (elapsed >= 1400) {
              updateChargeAura('pink');
              if (chargeIndicator) {
                chargeIndicator.textContent = 'MAX CHARGE! [PINK]';
              }
              if (chargeBar) {
                chargeBar.style.width = '100%';
              }
            } else if (elapsed >= 600) {
              updateChargeAura('green');
              if (chargeIndicator) {
                chargeIndicator.textContent = 'CHARGING: LV2 [GREEN]';
              }
              if (chargeBar) {
                chargeBar.style.width = '66%';
              }
            }
          }, 80);
        }

        function releaseCharge(e) {
          if (!isCharging) return;
          var elapsed = Date.now() - chargeStartTime;
          clearInterval(chargeTimer);
          isCharging = false;

          if (elapsed >= 1400) {
            // MAX PLASMA BURST
            if (chargeIndicator) chargeIndicator.textContent = 'RELEASE: MAX PLASMA BURST!';
            if (chargeWidget) {
              chargeWidget.classList.add('plasma-burst-active');
              setTimeout(function () {
                chargeWidget.classList.remove('plasma-burst-active');
              }, 600);
            }
            if (!isMuted && typeof window !== 'undefined' && window.ClownAudio && typeof window.ClownAudio.playSfx === 'function') {
              try {
                window.ClownAudio.playSfx('special');
              } catch (err) {}
            }
          } else if (elapsed >= 600) {
            // MEDIUM CHARGE
            if (chargeIndicator) chargeIndicator.textContent = 'FIRED: CHARGE SHOT LV2';
            if (!isMuted && typeof window !== 'undefined' && window.ClownAudio && typeof window.ClownAudio.playTone === 'function') {
              try {
                window.ClownAudio.playTone(880, 'square', 0.1, 0.35);
              } catch (err) {}
            }
          } else {
            // NORMAL SHOT
            if (chargeIndicator) chargeIndicator.textContent = 'FIRED: NORMAL SHOT';
            if (!isMuted && typeof window !== 'undefined' && window.ClownAudio && typeof window.ClownAudio.playTone === 'function') {
              try {
                window.ClownAudio.playTone(587.33, 'square', 0.04, 0.25);
              } catch (err) {}
            }
          }

          updateChargeAura('idle');
          if (chargeBar) {
            chargeBar.style.width = '0%';
          }

          setTimeout(function () {
            if (!isCharging && chargeIndicator) {
              chargeIndicator.textContent = 'READY';
            }
          }, 1200);
        }

        function cancelCharge() {
          if (!isCharging) return;
          clearInterval(chargeTimer);
          isCharging = false;
          updateChargeAura('idle');
          if (chargeBar) {
            chargeBar.style.width = '0%';
          }
          if (chargeIndicator) {
            chargeIndicator.textContent = 'READY';
          }
        }

        // Pointer events for smooth mouse, touch, and pen interactions
        chargeBtn.addEventListener('pointerdown', startCharging);
        chargeBtn.addEventListener('pointerup', releaseCharge);
        chargeBtn.addEventListener('pointercancel', cancelCharge);
        chargeBtn.addEventListener('pointerleave', cancelCharge);

        // Keyboard support: Space / Enter to charge
        chargeBtn.addEventListener('keydown', function (e) {
          if (e.key === ' ' || e.key === 'Enter') {
            if (!isCharging) startCharging(e);
          }
        });
        chargeBtn.addEventListener('keyup', function (e) {
          if (e.key === ' ' || e.key === 'Enter') {
            if (isCharging) releaseCharge(e);
          }
        });

        // Window blur and theme switch safety guards
        if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
          window.addEventListener('blur', cancelCharge);
          window.addEventListener('themechange', function () {
            if (isCharging) {
              cancelCharge();
            }
          });
        }
      })();
    } catch (err) {}

    // =========================================================================
    // 4. PACIFIC OUTPOST RADAR / SONAR DOCK CONTROLLER
    // =========================================================================
    try {
      (function setupPacificRadarDock() {
        var outpostContainer = document.getElementById('theme-pacific-outpost');
        var radarWidget = document.getElementById('pacific-radar-widget');
        var radarScope = document.getElementById('pacific-radar-scope');
        var radarStatus = document.getElementById('pacific-radar-status');
        var sonarWave = document.getElementById('radar-sonar-wave');
        var magmaSensor = document.getElementById('outpost-sens-magma');
        var turboSensor = document.getElementById('outpost-sens-turbo');

        if (!outpostContainer || (!radarWidget && !radarScope)) return;

        var targetMeta = {
          openooda:   { title: 'openOODA.org', freq: '142.85 MHz', az: '045°', rng: '1,240 KM' },
          necrometer: { title: 'NECROMETER.DEV', freq: '218.40 MHz', az: '120°', rng: '2,850 KM' },
          bumtrips:   { title: 'BUMTRIPS.COM', freq: '88.50 MHz', az: '210°', rng: '410 KM' },
          reactle:    { title: 'REACTLE.CLOWNHOUSE.IO', freq: '320.10 MHz', az: '290°', rng: 'LOCAL MESH' },
          giggle:     { title: 'GIGGLE.CLOWNHOUSE.IO', freq: '440.00 MHz', az: '335°', rng: 'LOCAL MESH' },
          contact:    { title: 'JERYD@CLOWNHOUSE.IO', freq: '999.99 MHz', az: '000°', rng: 'DIRECT LINE' }
        };

        function triggerSonarPing() {
          if (sonarWave) {
            sonarWave.classList.remove('pinging');
            void sonarWave.offsetWidth; // Force reflow
            sonarWave.classList.add('pinging');
          }
          if (!isMuted && typeof window !== 'undefined' && window.ClownAudio && typeof window.ClownAudio.playSfx === 'function') {
            try {
              window.ClownAudio.playSfx('hover');
            } catch (e) {}
          }
        }

        function highlightTarget(destKey) {
          if (!destKey || !targetMeta[destKey]) return;
          var info = targetMeta[destKey];

          if (radarStatus) {
            radarStatus.textContent = 'TARGET LOCKED: ' + info.title + ' [AZ ' + info.az + ' // ' + info.freq + ']';
          }

          // Highlight radar blip
          var blip = safeQuery(outpostContainer, '.radar-blip[data-target="' + destKey + '"]');
          if (blip) blip.classList.add('active-target');

          // Highlight comms card
          var card = safeQuery(outpostContainer, '.comms-relay[data-destination="' + destKey + '"]');
          if (card) card.classList.add('active-tracked');
        }

        function unhighlightTarget(destKey) {
          if (radarStatus) {
            radarStatus.textContent = 'RADAR: SWEEPING 360° // ALL SIGNALS LOCKED';
          }

          var blip = safeQuery(outpostContainer, '.radar-blip[data-target="' + destKey + '"]');
          if (blip) blip.classList.remove('active-target');

          var card = safeQuery(outpostContainer, '.comms-relay[data-destination="' + destKey + '"]');
          if (card) card.classList.remove('active-tracked');
        }

        // Blip interactions
        var blips = safeQueryAll(outpostContainer, '.radar-blip');
        blips.forEach(function (blip) {
          var dest = blip.getAttribute('data-target');
          blip.addEventListener('mouseenter', function () {
            highlightTarget(dest);
            triggerSonarPing();
          });
          blip.addEventListener('mouseleave', function () {
            unhighlightTarget(dest);
          });
          blip.addEventListener('click', function () {
            var cardLink = safeQuery(outpostContainer, '.comms-relay[data-destination="' + dest + '"] a.theme-link');
            if (cardLink && typeof cardLink.click === 'function') {
              cardLink.click();
            }
          });
        });

        // Comms card interactions
        var commsCards = safeQueryAll(outpostContainer, '.comms-relay');
        commsCards.forEach(function (card) {
          var dest = card.getAttribute('data-destination');
          card.addEventListener('mouseenter', function () {
            highlightTarget(dest);
            triggerSonarPing();
          });
          card.addEventListener('mouseleave', function () {
            unhighlightTarget(dest);
          });
        });

        // Click on radar scope triggers sonar ping
        if (radarScope) {
          radarScope.addEventListener('click', triggerSonarPing);
        }

        // Ambient station telemetry micro-flutter (runs every 3.5s only if sensors exist)
        if (magmaSensor || turboSensor) {
          setInterval(function () {
            if (magmaSensor) {
              var psi = (94.1 + Math.random() * 0.3).toFixed(1);
              magmaSensor.textContent = psi + ' PSI';
            }
            if (turboSensor) {
              var bar = (1.18 + Math.random() * 0.05).toFixed(2);
              turboSensor.textContent = '+' + bar + ' BAR';
            }
          }, 3500);
        }
      })();
    } catch (err) {}

    // =========================================================================
    // 5. CHOZO SCAN VISOR DYNAMIC RETICLE & E-TANK INTERACTION
    // =========================================================================
    try {
      (function setupChozoVisorInteractive() {
        var chozoContainer = document.getElementById('theme-chozo-visor');
        if (!chozoContainer) return;

        var reticle = safeQuery(chozoContainer, '.targeting-reticle');
        if (reticle) {
          reticle.style.cursor = 'pointer';
          reticle.addEventListener('click', function () {
            if (!isMuted && typeof window !== 'undefined' && window.ClownAudio && typeof window.ClownAudio.playTone === 'function') {
              try {
                window.ClownAudio.playTone(1200, 'sine', 0.08, 0.2);
                setTimeout(function () {
                  window.ClownAudio.playTone(1600, 'sine', 0.12, 0.25);
                }, 80);
              } catch (e) {}
            }
          });
        }

        var eTanks = safeQuery(chozoContainer, '.e-tanks-cluster');
        if (eTanks) {
          eTanks.style.cursor = 'pointer';
          eTanks.addEventListener('click', function () {
            var tanks = safeQueryAll(eTanks, '.e-tank');
            tanks.forEach(function (tank, i) {
              setTimeout(function () {
                tank.classList.add('filled');
              }, i * 80);
            });
            if (!isMuted && typeof window !== 'undefined' && window.ClownAudio && typeof window.ClownAudio.playTone === 'function') {
              try {
                window.ClownAudio.playTone(880, 'triangle', 0.15, 0.25);
              } catch (e) {}
            }
          });
        }
      })();
    } catch (err) {}
  }

  // --- Universal Link & SFX Delegation ---
  function setupLinkDelegation() {
    if (typeof document === 'undefined' || typeof document.addEventListener !== 'function') return;

    var lastHoverTime = 0;
    var lastHoverElement = null;

    function handleLinkHover(e) {
      if (isMuted) return;
      var link = e.target && typeof e.target.closest === 'function' ? e.target.closest('.theme-link') : null;
      if (!link) return;

      var now = Date.now();
      if (link === lastHoverElement && (now - lastHoverTime) < 100) {
        return; // Deduplicate rapid sequential pointerenter / mouseenter
      }
      lastHoverTime = now;
      lastHoverElement = link;

      if (typeof window !== 'undefined' && window.ClownAudio && typeof window.ClownAudio.playSfx === 'function') {
        try {
          window.ClownAudio.playSfx('hover');
        } catch (err) {
          // Audio safety guard
        }
      }
    }

    // Hover / mouseenter and pointerenter with timestamp debounce guard
    document.addEventListener('mouseenter', handleLinkHover, true);
    document.addEventListener('pointerenter', handleLinkHover, true);

    // Click sound effect
    document.addEventListener('click', function (e) {
      if (isMuted) return;
      var link = e.target && typeof e.target.closest === 'function' ? e.target.closest('.theme-link') : null;
      if (link && typeof window !== 'undefined' && window.ClownAudio && typeof window.ClownAudio.playSfx === 'function') {
        try {
          window.ClownAudio.playSfx('click');
        } catch (err) {
          // Audio safety guard
        }
      }
    }, false);
  }

  // --- Switcher Bar Keyboard Navigation (Roving Tabindex) ---
  function setupKeyboardNavigation() {
    if (typeof document === 'undefined') return;
    var switcherBar = document.getElementById('theme-switcher-bar');
    if (!switcherBar || typeof switcherBar.addEventListener !== 'function') return;

    switcherBar.addEventListener('keydown', function (e) {
      var buttons = Array.from(
        switcherBar.querySelectorAll('[data-theme], [data-theme-target], .theme-btn, .theme-switcher-btn, .switcher-btn')
      );
      if (!buttons.length) return;

      var activeIndex = buttons.findIndex(function (btn) {
        return btn === document.activeElement;
      });

      if (activeIndex === -1) return;

      var targetIndex = -1;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        targetIndex = (activeIndex + 1) % buttons.length;
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        targetIndex = (activeIndex - 1 + buttons.length) % buttons.length;
      } else if (e.key === 'Home') {
        e.preventDefault();
        targetIndex = 0;
      } else if (e.key === 'End') {
        e.preventDefault();
        targetIndex = buttons.length - 1;
      }

      if (targetIndex !== -1) {
        var targetBtn = buttons[targetIndex];
        if (targetBtn && typeof targetBtn.focus === 'function') {
          targetBtn.focus();
        }
        var theme = targetBtn ? (targetBtn.getAttribute('data-theme') || targetBtn.getAttribute('data-theme-target')) : null;
        if (theme) {
          setTheme(theme);
        }
      }
    });
  }

  // --- Switcher Bar Event Listeners ---
  function setupSwitcherEvents() {
    if (typeof document === 'undefined') return;

    var switcherBar = document.getElementById('theme-switcher-bar');
    if (switcherBar && typeof switcherBar.addEventListener === 'function') {
      switcherBar.addEventListener('click', function (e) {
        var themeBtn = e.target && typeof e.target.closest === 'function'
          ? e.target.closest('button[data-theme], button[data-theme-target], .theme-btn, .theme-switcher-btn, .switcher-btn')
          : null;

        if (themeBtn) {
          e.preventDefault();
          var targetTheme = themeBtn.getAttribute('data-theme') || themeBtn.getAttribute('data-theme-target');
          if (targetTheme) {
            setTheme(targetTheme);
          }
          return;
        }

        var soundBtn = e.target && typeof e.target.closest === 'function'
          ? e.target.closest('#sound-toggle')
          : null;

        if (soundBtn) {
          e.preventDefault();
          toggleSound();
        }
      });
    }

    // Fallback direct listener on sound-toggle if outside switcherBar
    var soundToggle = document.getElementById('sound-toggle');
    if (soundToggle && typeof soundToggle.addEventListener === 'function') {
      var isInside = switcherBar && typeof switcherBar.contains === 'function' ? switcherBar.contains(soundToggle) : false;
      if (!isInside) {
        soundToggle.addEventListener('click', function (e) {
          e.preventDefault();
          toggleSound();
        });
      }
    }
  }

  // --- Initialization ---
  function init() {
    if (isInitialized) return;

    var initialTheme = resolveInitialTheme();
    var savedSound = safeGetStorage(STORAGE_KEYS.SOUND);

    // Audio starts muted by default per autoplay requirements
    isMuted = true;

    // Apply theme immediately
    setTheme(initialTheme, { force: true, triggerAudio: false });

    // Update sound UI
    if (savedSound === 'on') {
      var soundToggle = typeof document !== 'undefined' ? document.getElementById('sound-toggle') : null;
      if (soundToggle) {
        var stateSpan = safeQuery(soundToggle, '.btn-state');
        if (stateSpan) {
          stateSpan.textContent = 'MUTED';
        }
        soundToggle.setAttribute('aria-pressed', 'false');
      }
    } else {
      updateSoundUI(true);
    }

    // Attach listeners
    setupSwitcherEvents();
    setupKeyboardNavigation();
    setupLinkDelegation();
    setupInteractiveWidgets();

    isInitialized = true;
  }

  // Auto-init on DOM ready
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading' && typeof document.addEventListener === 'function') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }

  // Return Public API
  return {
    init: init,
    setTheme: setTheme,
    getActiveTheme: function () {
      return currentTheme;
    },
    toggleSound: toggleSound,
    isSoundMuted: function () {
      return isMuted;
    },
    setVolume: setVolume,
    getThemes: function () {
      return VALID_THEMES.slice();
    }
  };
}));
