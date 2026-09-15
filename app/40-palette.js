
  let paletteModal = null;
  let paletteInput = null;
  let paletteResults = null;
  let selectedIndex = 0;
  let filteredItems = [];

  function scrollToSection(id) {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  }

  function initCommandPalette() {
    paletteModal = document.getElementById('command-palette-modal');
    paletteInput = document.getElementById('palette-input');
    paletteResults = document.getElementById('palette-results');
    const backdrop = document.getElementById('palette-backdrop');
    const closeBadge = document.getElementById('palette-close-badge');

    if (!paletteModal || !paletteInput || !paletteResults) return;

    function openPalette() {
      paletteModal.classList.remove('hidden');
      paletteModal.setAttribute('aria-hidden', 'false');
      paletteInput.value = '';
      renderPaletteResults('');
      paletteInput.focus();
    }

    function closePalette() {
      paletteModal.classList.add('hidden');
      paletteModal.setAttribute('aria-hidden', 'true');
    }

    function togglePalette() {
      if (paletteModal.classList.contains('hidden')) {
        openPalette();
      } else {
        closePalette();
      }
    }

    function renderPaletteResults(query) {
      const q = query.trim().toLowerCase();
      if (!q) {
        filteredItems = [...PALETTE_CATALOG];
      } else {
        const tokens = q.split(/\s+/);
        filteredItems = PALETTE_CATALOG.filter((item) => {
          const haystack = `${item.title} ${item.category} ${item.desc} ${item.keywords || ''}`.toLowerCase();
          return tokens.every((token) => haystack.includes(token));
        });
      }

      selectedIndex = 0;
      paletteResults.innerHTML = '';

      if (filteredItems.length === 0) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'palette-empty';
        emptyDiv.textContent = 'No matching commands or projects found.';
        paletteResults.appendChild(emptyDiv);
        return;
      }

      filteredItems.forEach((item, index) => {
        const itemEl = document.createElement('div');
        itemEl.className = `palette-item${index === selectedIndex ? ' selected' : ''}`;
        itemEl.setAttribute('role', 'option');
        itemEl.setAttribute('aria-selected', index === selectedIndex ? 'true' : 'false');

        const leftEl = document.createElement('div');
        leftEl.className = 'palette-item-left';

        const titleEl = document.createElement('span');
        titleEl.className = 'palette-item-title';
        titleEl.textContent = item.title;

        const descEl = document.createElement('span');
        descEl.className = 'palette-item-desc';
        descEl.textContent = item.desc;

        leftEl.appendChild(titleEl);
        leftEl.appendChild(descEl);

        const badgeEl = document.createElement('span');
        badgeEl.className = 'palette-item-badge';
        badgeEl.textContent = item.category;

        itemEl.appendChild(leftEl);
        itemEl.appendChild(badgeEl);

        itemEl.addEventListener('click', () => {
          executeItem(item);
          closePalette();
        });

        paletteResults.appendChild(itemEl);
      });
    }

    function updateSelection() {
      const items = paletteResults.querySelectorAll('.palette-item');
      items.forEach((el, idx) => {
        if (idx === selectedIndex) {
          el.classList.add('selected');
          el.setAttribute('aria-selected', 'true');
          el.scrollIntoView({ block: 'nearest' });
        } else {
          el.classList.remove('selected');
          el.setAttribute('aria-selected', 'false');
        }
      });
    }

    function executeItem(item) {
      if (!item) return;
      try {
        if (typeof item.action === 'function') {
          item.action();
        } else if (item.url) {
          if (item.external) {
            window.open(item.url, '_blank', 'noopener,noreferrer');
          } else {
            window.location.href = item.url;
          }
        }
      } catch (actionErr) {
        console.warn('[ClownPalette] Action execution error:', actionErr);
      }
    }

    paletteInput.addEventListener('input', (e) => {
      renderPaletteResults(e.target.value);
    });

    paletteInput.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (filteredItems.length > 0) {
          selectedIndex = (selectedIndex + 1) % filteredItems.length;
          updateSelection();
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (filteredItems.length > 0) {
          selectedIndex = (selectedIndex - 1 + filteredItems.length) % filteredItems.length;
          updateSelection();
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredItems.length > 0 && filteredItems[selectedIndex]) {
          executeItem(filteredItems[selectedIndex]);
          closePalette();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        if (paletteInput.value) {
          paletteInput.value = '';
          renderPaletteResults('');
        } else {
          closePalette();
        }
      }
    });

    if (backdrop) backdrop.addEventListener('click', closePalette);
    if (closeBadge) closeBadge.addEventListener('click', closePalette);

    // Global contract for palette
    window.ClownPalette = {
      open: openPalette,
      close: closePalette,
      toggle: togglePalette,
      search: (q) => {
        if (typeof q !== 'string') return [];
        const trimmed = q.trim().toLowerCase();
        if (!trimmed) return [...PALETTE_CATALOG];
        const tokens = trimmed.split(/\s+/);
        return PALETTE_CATALOG.filter((item) => {
          const text = `${item.title} ${item.category} ${item.desc} ${item.keywords || ''}`.toLowerCase();
          return tokens.every((token) => text.includes(token));
        });
      },
      executeItem: (itemId) => {
        const found = PALETTE_CATALOG.find((i) => i.id === itemId);
        if (found) executeItem(found);
      }
    };
  }

