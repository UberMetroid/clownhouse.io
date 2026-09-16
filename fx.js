// clownhouse // fx.js — canvas atmosphere layer.
// Ground fog and gnats that swarm the pointer.
// All additive ('lighter' composite) so they read as light, not
// sprites. Skipped entirely under prefers-reduced-motion.
// Zero dependencies.
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

    function frame(ts) {
        const dt = Math.min((ts - last) / 1000 || 0.016, 0.05);
        last = ts;
        const t = ts / 1000;
        ctx.clearRect(0, 0, w, h);
        ctx.globalCompositeOperation = 'lighter';

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
