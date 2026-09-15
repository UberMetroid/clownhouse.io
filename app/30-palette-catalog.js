  // --- Command Palette Engine (Fuzzy Search & Navigation) ---
  const PALETTE_CATALOG = [
    {
      id: 'proj-openooda',
      title: 'openOODA.org',
      category: 'Featured Project',
      desc: 'Autonomous Agentic Architecture & Sovereign Systems Language',
      url: 'https://openooda.org',
      external: true,
      keywords: 'openooda agent ooda rust capabilities autonomous token sovereign'
    },
    {
      id: 'proj-necrometer',
      title: 'necrometer.dev',
      category: 'Featured Project',
      desc: 'Developer Telemetry, Metrics & Codebase Observability',
      url: 'https://necrometer.dev',
      external: true,
      keywords: 'necrometer telemetry metrics github decay mortality wasm rust'
    },
    {
      id: 'proj-bumtrips',
      title: 'bumtrips.com',
      category: 'Featured Project',
      desc: 'Beatniks, Bumtrips & Bullshit — Audio & Counter-Culture',
      url: 'https://bumtrips.com',
      external: true,
      keywords: 'bumtrips audio podcast psychedelic beatniks frequencies radio underground'
    },
    {
      id: 'svc-reactle',
      title: 'reactle.clownhouse.io',
      category: 'Cluster Lab',
      desc: 'Wordle-style retro word game terminal',
      url: 'https://reactle.clownhouse.io',
      external: true,
      keywords: 'reactle wordle game word puzzle retro terminal'
    },
    {
      id: 'svc-giggle',
      title: 'giggle.clownhouse.io',
      category: 'Cluster Compute',
      desc: 'SearXNG privacy-respecting metasearch computation node',
      url: 'https://giggle.clownhouse.io',
      external: true,
      keywords: 'giggle searxng search privacy compute cluster research'
    },
    {
      id: 'svc-contact',
      title: 'jeryd@clownhouse.io',
      category: 'Direct Ingress',
      desc: 'Cloudflare-routed secure email contact',
      url: 'mailto:jeryd@clownhouse.io',
      external: false,
      keywords: 'email contact jeryd mail inbox dispatch'
    },
    {
      id: 'nav-projects',
      title: 'Jump: Featured Projects Showcase',
      category: 'Navigation',
      desc: 'View openOODA, necrometer, and bumtrips architectures',
      action: () => scrollToSection('projects'),
      keywords: 'projects showcase systems featured core'
    },
    {
      id: 'nav-services',
      title: 'Jump: Labs & Cluster Services',
      category: 'Navigation',
      desc: 'View Reactle, Giggle, and direct mail ingress',
      action: () => scrollToSection('services'),
      keywords: 'services cluster labs nodes endpoints'
    },
    {
      id: 'nav-hero',
      title: 'Jump: Return to Top',
      category: 'Navigation',
      desc: 'Scroll back to the top of Clownhouse',
      action: () => scrollToSection('hero'),
      keywords: 'home hero top brand start'
    },
    {
      id: 'link-github',
      title: 'Source: GitHub Repository',
      category: 'Source Code',
      desc: 'View clownhouse.io repository on GitHub',
      url: 'https://github.com/studio2201/clownhouse.io',
      external: true,
      keywords: 'github repo source code git studio2201'
    },
    {
      id: 'act-theme-random',
      title: 'Action: Randomize Theme Palette (R)',
      category: 'Theme Engine',
      desc: 'Pick a random theme palette from the 7 Omarchy presets',
      action: () => randomTheme(),
      keywords: 'theme random randomize palette color shuffle switch'
    },
    {
      id: 'act-theme',
      title: 'Action: Cycle Next Theme (T)',
      category: 'Theme Engine',
      desc: 'Cycle through Tokyo Night, Catppuccin, Gruvbox, Nord, Rosé Pine, Ethereal, Vantablack',
      action: () => cycleTheme(),
      keywords: 'theme palette color cycle swap tokyo catppuccin gruvbox nord rose ethereal vantablack'
    },
    {
      id: 'theme-tokyo',
      title: 'Theme: Tokyo Night',
      category: 'Theme Palette',
      desc: 'Switch to Tokyo Night (Default Neon Dark)',
      action: () => setTheme('tokyo-night'),
      keywords: 'tokyo night theme dark neon'
    },
    {
      id: 'theme-catp',
      title: 'Theme: Catppuccin Mocha',
      category: 'Theme Palette',
      desc: 'Switch to Catppuccin Mocha (Soothing Pastel Dark)',
      action: () => setTheme('catppuccin'),
      keywords: 'catppuccin mocha theme pastel dark'
    },
    {
      id: 'theme-gruv',
      title: 'Theme: Gruvbox Dark',
      category: 'Theme Palette',
      desc: 'Switch to Gruvbox Dark (Warm Retro Groove)',
      action: () => setTheme('gruvbox'),
      keywords: 'gruvbox theme warm retro groove'
    },
    {
      id: 'theme-nord',
      title: 'Theme: Nord Arctic',
      category: 'Theme Palette',
      desc: 'Switch to Nord (Arctic Cold Blue)',
      action: () => setTheme('nord'),
      keywords: 'nord arctic blue theme'
    },
    {
      id: 'theme-rose',
      title: 'Theme: Rosé Pine',
      category: 'Theme Palette',
      desc: 'Switch to Rosé Pine (Warm Paper Light Mode)',
      action: () => setTheme('rose-pine'),
      keywords: 'rose pine light theme paper warm'
    },
    {
      id: 'theme-ethereal',
      title: 'Theme: Ethereal Indigo',
      category: 'Theme Palette',
      desc: 'Switch to Ethereal (Deep Indigo & Amber)',
      action: () => setTheme('ethereal'),
      keywords: 'ethereal indigo amber violet dark'
    },
    {
      id: 'theme-vanta',
      title: 'Theme: Vantablack',
      category: 'Theme Palette',
      desc: 'Switch to Vantablack (Pitch Black OLED)',
      action: () => setTheme('vantablack'),
      keywords: 'vantablack pitch black oled dark monochrome'
    },
    {
      id: 'act-audio',
      title: 'Action: Toggle Ambient Audio (Play/Pause)',
      category: 'Audio Player',
      desc: 'Toggle procedural synthesizer playback (Space)',
      action: () => toggleAudioPill(),
      keywords: 'sound audio music synth drone ambient frequency play pause'
    },
    {
      id: 'act-audio-mute',
      title: 'Action: Toggle Audio Mute',
      category: 'Audio Player',
      desc: 'Mute or unmute master ambient audio synthesizer',
      action: () => toggleMutePill(),
      keywords: 'mute unmute sound silence volume audio'
    },
    {
      id: 'act-audio-next',
      title: 'Action: Next Ambient Frequency Track',
      category: 'Audio Player',
      desc: 'Advance to next procedural frequency synthesizer mode',
      action: () => {
        if (window.ClownAudio && typeof window.ClownAudio.nextTrack === 'function') {
          window.ClownAudio.nextTrack();
        }
      },
      keywords: 'next track skip frequency cycle ambient'
    },
    {
      id: 'track-lab01',
      title: 'Track: LAB-01: Carrier Drift',
      category: 'Audio Track',
      desc: '55Hz Sub · 432Hz Carrier (Binaural carrier wave)',
      action: () => {
        if (window.ClownAudio && typeof window.ClownAudio.setTrack === 'function') {
          window.ClownAudio.setTrack(0);
          window.ClownAudio.play();
        }
      },
      keywords: 'carrier drift 432hz 55hz binaural lab 01'
    },
    {
      id: 'track-lab02',
      title: 'Track: LAB-02: Cybernetic Drone',
      category: 'Audio Track',
      desc: '110Hz Drone · Modulated Filter (Sweeping lowpass harmonics)',
      action: () => {
        if (window.ClownAudio && typeof window.ClownAudio.setTrack === 'function') {
          window.ClownAudio.setTrack(1);
          window.ClownAudio.play();
        }
      },
      keywords: 'cybernetic drone 110hz saw lowpass filter lab 02'
    },
    {
      id: 'track-lab03',
      title: 'Track: LAB-03: Necrometer 528Hz',
      category: 'Audio Track',
      desc: '528Hz Solfeggio Matrix · Pulse Sweep (Stereo delay feedback)',
      action: () => {
        if (window.ClownAudio && typeof window.ClownAudio.setTrack === 'function') {
          window.ClownAudio.setTrack(2);
          window.ClownAudio.play();
        }
      },
      keywords: 'necrometer 528hz solfeggio repair matrix delay lab 03'
    },
    {
      id: 'track-lab04',
      title: 'Track: LAB-04: Velvet Frequency',
      category: 'Audio Track',
      desc: '63Hz Warm Bass · Pink Noise Wash (Deep analog baseline)',
      action: () => {
        if (window.ClownAudio && typeof window.ClownAudio.setTrack === 'function') {
          window.ClownAudio.setTrack(3);
          window.ClownAudio.play();
        }
      },
      keywords: 'velvet frequency 63hz pink noise warm analog lab 04'
    },
    {
      id: 'ext-repo',
      title: 'Source: GitHub Repository',
      category: 'External Link',
      desc: 'View clownhouse.io source repository on GitHub',
      url: 'https://github.com/studio2201/clownhouse.io',
      external: true,
      keywords: 'github repo source code repository'
    }
  ];
