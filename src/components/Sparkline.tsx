interface SparklineProps {
  values: number[];
  color?: string;
}

const WIDTH = 100;
const HEIGHT = 26;

export default function Sparkline({ values, color = '#3d5245' }: SparklineProps) {
  if (values.length < 2) {
    return <div className="h-[26px]" />;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * WIDTH;
      const y = HEIGHT - ((v - min) / range) * HEIGHT;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      width="100%"
      height={HEIGHT}
      preserveAspectRatio="none"
      className="block"
      role="img"
      aria-label="แนวโน้มค่าล่าสุด"
    >
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
