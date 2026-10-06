import { useT } from "@agent-native/core/client/i18n";
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
 *
 * **Les couleurs passent par `className`, jamais par `stroke="var(--…)"`.** Recharts
 * pose `stroke` en *attribut de présentation* SVG, et un attribut ne résout pas
 * `var()` — seule une propriété CSS le fait. La courbe sortait donc sans trait, avec
 * des points blancs invisibles sur fond clair. `currentColor` dans l'attribut plus une
 * classe qui pose `color` donne un trait qui suit le thème.
 */
export function EmotionCurve({
  curve,
  showReference = true,
}: {
  curve: CurvePoint[];
  showReference?: boolean;
}) {
  const t = useT();
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
            labelFormatter={(step) => t("studio.stepBadge", { step: String(step) })}
            formatter={(value, name) => [
              String(value ?? ""),
              name === "intensity"
                ? t("storyMap.curveYours")
                : t("storyMap.curveReference"),
            ]}
          />
          {/* Le climax : le repère qui structure toute la courbe. */}
          <ReferenceLine x={8} className="stroke-border" strokeDasharray="4 4" />
          {showReference ? (
            <Line
              type="monotone"
              dataKey="referenceIntensity"
              stroke="currentColor"
              className="text-muted-foreground"
              strokeDasharray="4 4"
              strokeWidth={1}
              dot={false}
              isAnimationActive={false}
            />
          ) : null}
          <Line
            type="monotone"
            dataKey="intensity"
            stroke="currentColor"
            className="text-primary"
            strokeWidth={2}
            connectNulls
            dot={{ r: 3, fill: "currentColor", strokeWidth: 0 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
      {!hasData ? (
        <p className="text-muted-foreground -mt-24 text-center text-xs">
          {t("storyMap.curveEmpty")}
        </p>
      ) : null}
    </div>
  );
}
