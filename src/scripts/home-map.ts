// Adapted from the Norwegian homepage: one softly drifting light over the
// existing Latvian point geometry, without changing coordinates or counts.
const map = document.querySelector<HTMLElement>('.home-map');
const ambientMotion = matchMedia(
  '(min-width:1100px) and (hover:hover) and (pointer:fine) and (prefers-reduced-motion:no-preference)',
);
if (map) {
  const svg = map.querySelector<SVGSVGElement>('svg')!;
  const light = map.querySelector<SVGRadialGradientElement>('#latvia-home-light')!;
  let frame = 0;
  let previousTime = 0;
  let currentX = svg.viewBox.baseVal.width / 2;
  let currentY = svg.viewBox.baseVal.height / 2;
  let targetX = currentX;
  let targetY = currentY;

  const paintLight = () => {
    light.setAttribute('cx', String(currentX));
    light.setAttribute('cy', String(currentY));
  };
  const drift = (now: number) => {
    const elapsed = previousTime ? Math.min(64, now - previousTime) : 16;
    previousTime = now;
    const ease = 1 - Math.exp(-elapsed / 240);
    currentX += (targetX - currentX) * ease;
    currentY += (targetY - currentY) * ease;
    paintLight();
    if (Math.hypot(targetX - currentX, targetY - currentY) > .15) {
      frame = requestAnimationFrame(drift);
    } else {
      frame = 0;
      previousTime = 0;
    }
  };
  const locate = (event: PointerEvent) => {
    const matrix = svg.getScreenCTM();
    if (!matrix) return false;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    targetX = point.x;
    targetY = point.y;
    return true;
  };
  map.addEventListener('pointerenter', event => {
    if (!ambientMotion.matches || !locate(event)) return;
    currentX = targetX;
    currentY = targetY;
    paintLight();
    map.classList.add('is-lit');
  });
  map.addEventListener('pointermove', event => {
    if (!ambientMotion.matches || !locate(event)) return;
    map.classList.add('is-lit');
    if (!frame) frame = requestAnimationFrame(drift);
  }, {passive:true});
  const settle = () => {
    map.classList.remove('is-lit');
    cancelAnimationFrame(frame);
    frame = 0;
    previousTime = 0;
  };
  map.addEventListener('pointerleave', settle);
  map.addEventListener('pointercancel', settle);
  ambientMotion.addEventListener('change', settle);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) settle();
  });
}
export {};
