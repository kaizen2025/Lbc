import { View } from "react-native";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";
import { colors } from "../theme";

/**
 * Courbe de cote style Collectr : ligne + aire dégradée, sans axes.
 * `points` = valeurs en centimes, ordre chronologique.
 */
export function Sparkline({
  points,
  height = 140,
  stroke = colors.accent,
}: {
  points: number[];
  height?: number;
  stroke?: string;
}) {
  if (points.length < 2) return <View style={{ height }} />;

  const width = 600; // viewBox — s'étire en largeur via preserveAspectRatio
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const pad = 8;

  const x = (i: number) => (i / (points.length - 1)) * width;
  const y = (v: number) => pad + (1 - (v - min) / span) * (height - pad * 2);

  const line = points
    .map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`)
    .join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;

  return (
    <Svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
    >
      <Defs>
        <LinearGradient id="sparkfill" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={stroke} stopOpacity={0.35} />
          <Stop offset="1" stopColor={stroke} stopOpacity={0.02} />
        </LinearGradient>
      </Defs>
      <Path d={area} fill="url(#sparkfill)" />
      <Path d={line} stroke={stroke} strokeWidth={2.5} fill="none" />
    </Svg>
  );
}
