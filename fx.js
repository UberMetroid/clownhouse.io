// clownhouse // fx.js — canvas atmosphere layer.
// Lightning strobes, a god-beam sweeping down from the sky, ground
// fog, shooting stars, and gnats that swarm the pointer. All additive
// ('lighter' composite) so they read as light, not sprites.
// Skipped entirely under prefers-reduced-motion. Zero dependencies.
(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const cv = document.getElementById('fx');
    const ctx = cv.getContext('2d');
    let w, h, mx = -999, my = -999, last = 0;

    const fit = () => { w = cv.width = innerWidth; h = cv.height = innerHeight; };
    fit();
    addEventListener('resize', fit);
    addEventListener('pointermove', e => { mx = e.clientX; my = e.clientY; }, { passive: true });
    addEventListener('pointerleave', () => { mx = my = -999; });

    // ground fog — persistent puffs drifting across the lawn
    const puffs = [...Array(14)].map(() => ({
        x: Math.random(), y: 0.82 + Math.random() * 0.18,
        r: 0.07 + Math.random() * 0.12,
        vx: (Math.random() - 0.5) * 0.02, ph: Math.random() * 6.28
    }));

    // gnats — eased orbiters around the pointer
    const gnats = [...Array(7)].map((_, i) => ({
        a: Math.random() * 6.28, r: 14 + i * 6,
        s: 0.7 + Math.random() * 1.6, x: 0, y: 0
    }));

    let stars = [];                     // shooting stars
    let flash = 0, flashX = 0.5;        // lightning envelope

    function frame(ts) {
        const dt = Math.min((ts - last) / 1000 || 0.016, 0.05);
        last = ts;
        const t = ts / 1000;
        ctx.clearRect(0, 0, w, h);
        ctx.globalCompositeOperation = 'lighter';

        // lightning — rare trigger, strobe re-strikes while decaying
        if (Math.random() < dt * 0.08) { flash = 1; flashX = Math.random(); }
        if (flash > 0.02) {
            if (flash < 0.5 && Math.random() < dt * 14)
                flash = Math.min(flash + 0.3, 0.9);
            flash *= Math.pow(0.02, dt);
            ctx.fillStyle = `rgba(200,185,255,${flash * 0.13})`;
            ctx.fillRect(0, 0, w, h);
            const g = ctx.createRadialGradient(
                flashX * w, -h * 0.1, 0, flashX * w, -h * 0.1, h);
            g.addColorStop(0, `rgba(220,205,255,${flash * 0.35})`);
            g.addColorStop(1, 'rgba(220,205,255,0)');
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, w, h);
        }

        // god beam — moonlit shaft sweeping down across the house
        const bx = w * (0.3 + 0.4 * (Math.sin(t * 0.11) * 0.5 + 0.5));
        const sweep = Math.sin(t * 0.21) * 0.25 + Math.sin(t * 0.07) * 0.1;
        ctx.save();
        ctx.translate(bx, -h * 0.05);
        ctx.rotate(sweep);
        const bg = ctx.createLinearGradient(0, 0, 0, h * 1.1);
        bg.addColorStop(0, 'rgba(190,205,255,0.09)');
        bg.addColorStop(1, 'rgba(190,205,255,0)');
        ctx.fillStyle = bg;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-h * 0.05, h * 1.1);
        ctx.lineTo(h * 0.05, h * 1.1);
        ctx.fill();
        ctx.restore();

        // shooting stars — occasional diagonal streaks across the sky
        if (Math.random() < dt * 0.1 && stars.length < 3)
            stars.push({
                x: Math.random() * w, y: Math.random() * h * 0.25,
                vx: 380 + Math.random() * 320, vy: 140 + Math.random() * 90,
                life: 0
            });
        stars = stars.filter(s => (s.life += dt) < 1.1);
        ctx.lineWidth = 1.5;
        for (const s of stars) {
            s.x += s.vx * dt; s.y += s.vy * dt;
            const a = Math.sin(Math.min(s.life / 1.1, 1) * Math.PI) * 0.8;
            const tx = s.x - s.vx * 0.14, ty = s.y - s.vy * 0.14;
            const sg = ctx.createLinearGradient(s.x, s.y, tx, ty);
            sg.addColorStop(0, `rgba(235,240,255,${a})`);
            sg.addColorStop(1, 'rgba(235,240,255,0)');
            ctx.strokeStyle = sg;
            ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(tx, ty); ctx.stroke();
        }

        // fog puffs — radial gradients breathing along the ground
        for (const p of puffs) {
            p.x += p.vx * dt;
            if (p.x < -0.15) p.x = 1.15;
            if (p.x > 1.15) p.x = -0.15;
            const a = 0.05 + 0.03 * Math.sin(t * 0.3 + p.ph);
            const fg = ctx.createRadialGradient(
                p.x * w, p.y * h, 0, p.x * w, p.y * h, p.r * w);
            fg.addColorStop(0, `rgba(130,110,170,${a})`);
            fg.addColorStop(1, 'rgba(130,110,170,0)');
            ctx.fillStyle = fg;
            ctx.fillRect(p.x * w - p.r * w, p.y * h - p.r * h,
                         p.r * w * 2, p.r * h * 2);
        }

        // gnats — swarm the pointer with jittered orbits
        if (mx > -100) {
            ctx.fillStyle = 'rgba(200,255,190,0.55)';
            for (const g of gnats) {
                g.a += g.s * dt * 2.4;
                const tx = mx + Math.cos(g.a) * g.r + Math.sin(t * 5 + g.r) * 5;
                const ty = my + Math.sin(g.a * 1.35) * g.r * 0.7
                             + Math.cos(t * 4 + g.a) * 5;
                g.x += (tx - g.x) * Math.min(dt * 9, 1);
                g.y += (ty - g.y) * Math.min(dt * 9, 1);
                ctx.fillRect(g.x - 1, g.y - 1, 2, 2);
            }
        }

        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
})();
