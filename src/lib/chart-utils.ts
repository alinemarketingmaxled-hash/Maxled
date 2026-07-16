/** Scales a series of values into an SVG viewBox (0,0,width,height), y inverted
 * (higher value = smaller y). `extraValues` (e.g. commission goal tiers) are
 * folded into the min/max so the chart scales to include them even if no
 * month has reached them yet — otherwise a goal line above the tallest bar
 * would just draw off the top of the chart. */
export function buildLineChart(
  values: number[],
  extraValues: number[] = [],
  width = 300,
  height = 100,
  padTop = 10,
  padBottom = 10,
) {
  const allValues = [...values, ...extraValues];
  const max = Math.max(...allValues, 1);
  const min = Math.min(...allValues, 0);
  const range = max - min || 1;
  const usableHeight = height - padTop - padBottom;
  const step = values.length > 1 ? width / (values.length - 1) : 0;

  const valueToY = (v: number) => padTop + usableHeight - ((v - min) / range) * usableHeight;

  const points = values.map((v, i) => {
    const x = i * step;
    return { x: Number(x.toFixed(1)), y: Number(valueToY(v).toFixed(1)) };
  });

  const polyline = points.map((p) => `${p.x},${p.y}`).join(" ");
  const areaPath =
    `M${points[0]?.x ?? 0},${height} ` +
    points.map((p) => `L${p.x},${p.y}`).join(" ") +
    ` L${points[points.length - 1]?.x ?? 0},${height} Z`;

  return { points, polyline, areaPath, valueToY, width, height };
}
