// 軽量演出用関数
function animateSnapEffect(chart, effect, color) {
  const ctx = chart.ctx;
  const start = Date.now();
  const duration = 800; // 0.8秒で消える

  function step() {
    const now = Date.now();
    const elapsed = now - start;
    const progress = elapsed / duration;
    if (progress >= 1) return;

    const alpha = 1 - progress;
    const radius = 6 + progress * 20;

    ctx.save();
    ctx.fillStyle = `rgba(${color.r},${color.g},${color.b},${alpha})`;
    ctx.beginPath();
    ctx.arc(effect.x, effect.y, radius, 0, 2 * Math.PI);
    ctx.fill();
    ctx.restore();

    requestAnimationFrame(step);
  }

  requestAnimationFrame(step);
}