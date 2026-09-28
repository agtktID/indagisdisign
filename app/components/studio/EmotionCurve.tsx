import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface CurvePoint {
  step: number;
  intensity: number | null;
  referenceIntensity: number;
}

/**
 * La courbe émotionnelle, tracée depuis les intensités saisies.
 *
 * Recharts est déjà une dépendance de `@agent-native/core` — aucune bibliothèque de
 * graphiques n'est ajoutée au projet.
 *
 * La courbe de référence de la méthode est affichée en pointillé : pic à l'étape 8,
 * respiration à la 9, relance à la 11. C'est une indication, jamais une cible imposée.
 */
export function EmotionCurve({
  curve,
  showReference = true,
}: {
  curve: CurvePoint[];
  showReference?: boolean;
}) {
  const hasData = curve.some((point) => point.intensity !== null);

  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={curve} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
          <XAxis
            dataKey="step"
            tick={{ fontSize: 11 }}
            className="text-muted-foreground"
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 11 }}
            className="text-muted-foreground"
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              fontSize: 12,
            }}
            labelFormatter={(step) => `Étape ${String(step)}`}
            formatter={(value, name) => [
              String(value ?? ""),
              name === "intensity" ? "Votre intensité" : "Référence",
            ]}
          />
          {/* Le climax : le repère qui structure toute la courbe. */}
          <ReferenceLine x={8} stroke="var(--border)" strokeDasharray="4 4" />
          {showReference ? (
            <Line
              type="monotone"
              dataKey="referenceIntensity"
              stroke="var(--muted-foreground)"
              strokeDasharray="4 4"
              strokeWidth={1}
              dot={false}
              isAnimationActive={false}
            />
          ) : null}
          <Line
            type="monotone"
            dataKey="intensity"
            stroke="var(--primary)"
            strokeWidth={2}
            connectNulls
            dot={{ r: 3 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
      {!hasData ? (
        <p className="text-muted-foreground -mt-24 text-center text-xs">
          Aucune intensité saisie. La courbe se trace au fur et à mesure.
        </p>
      ) : null}
    </div>
  );
}
