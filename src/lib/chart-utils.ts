/** Scales a series of values into an SVG viewBox (0,0,width,height), y inverted (higher value = smaller y). */
export function buildLineChart(values: number[], width = 300, height = 100, padTop = 10, padBottom = 10) {
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const usableHeight = height - padTop - padBottom;
  const step = values.length > 1 ? width / (values.length - 1) : 0;

  const points = values.map((v, i) => {
    const x = i * step;
    const y = padTop + usableHeight - ((v - min) / range) * usableHeight;
    return { x: Number(x.toFixed(1)), y: Number(y.toFixed(1)) };
  });

  const polyline = points.map((p) => `${p.x},${p.y}`).join(" ");
  const areaPath =
    `M${points[0]?.x ?? 0},${height} ` +
    points.map((p) => `L${p.x},${p.y}`).join(" ") +
    ` L${points[points.length - 1]?.x ?? 0},${height} Z`;

  return { points, polyline, areaPath };
}
