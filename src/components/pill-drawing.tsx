import { colorNames, shapeName } from "@/lib/fda/codes";
import {
  imprintFontSize,
  imprintStyle,
  isScored,
  luminance,
  pillFills,
  pillGeometry,
  shade,
} from "@/lib/pill";
import { cn } from "@/lib/utils";

export type PillHighlight = "imprint" | "color" | "shape";

type Props = {
  shapeCode: string;
  colorCodes: string[];
  sizeMm: number;
  imprintSides: string[];
  /** RxNav SCORE (1 = no score line). */
  score?: number;
  highlight?: PillHighlight;
  /** Screen pixels per millimetre. Keep it the same for pills that sit side by side so they compare to scale. */
  pxPerMm?: number;
  /** Show a small millimetre ruler under the pill. */
  ruler?: boolean;
  className?: string;
};

const PAD = 2.4; // mm around the pill for the shadow and highlight ring
const MISMATCH = "#C42F2A";

// Stable ids for gradients/clips without hooks, so this renders on the server.
function idFor(parts: unknown[]) {
  const s = JSON.stringify(parts);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return `pill-${h.toString(36)}`;
}

export function PillDrawing({
  shapeCode,
  colorCodes,
  sizeMm,
  imprintSides,
  score,
  highlight,
  pxPerMm = 12,
  ruler = false,
  className,
}: Props) {
  const geo = pillGeometry(shapeCode, sizeMm);
  const fills = pillFills(colorCodes);
  const front = imprintSides[0] ?? "";
  const back = imprintSides.slice(1).join(" · ");
  const fontSize = front ? imprintFontSize(front, geo) : 0;
  const style = imprintStyle(geo);
  const scored = isScored(score);
  const id = idFor([shapeCode, colorCodes, sizeMm, imprintSides, score, highlight]);

  const rulerMm = ruler ? Math.max(5, Math.floor(geo.width / 5) * 5) : 0;
  const rulerSpace = ruler ? 4.2 : 0;
  const vbW = geo.width + PAD * 2;
  const vbH = geo.height + PAD * 2 + rulerSpace;
  const cy = PAD + geo.height / 2;

  // Imprint ink: debossed letters read as a darker shadow of the pill color; printed capsule ink is near-black.
  const faceFill = fills[0];
  const light = luminance(faceFill) > 0.6;
  const debossDark = shade(faceFill, light ? 0.28 : 0.38);
  const debossLight = shade(faceFill, -0.55);
  const inkColor = luminance(faceFill) > 0.25 ? "#22252B" : "#F4F4F0";

  const label = [
    colorNames(colorCodes) ?? "Unknown color",
    (shapeName(shapeCode) ?? "unknown shape").toLowerCase(),
    "pill,",
    `${sizeMm} mm`,
    front ? `, imprint ${imprintSides.join(" / ")}` : ", no imprint",
    scored ? ", scored" : "",
  ].join(" ");

  const textWidth = front.length * fontSize * 0.62;

  return (
    <figure className={cn("inline-flex flex-col items-center", className)}>
      <svg
        role="img"
        aria-label={label}
        viewBox={`0 0 ${vbW} ${vbH}`}
        width={vbW * pxPerMm}
        height={vbH * pxPerMm}
        className="h-auto max-w-full overflow-visible"
        data-shape={geo.drawn}
        data-fallback={geo.fallback || undefined}
      >
        <defs>
          <clipPath id={`${id}-clip`}>
            <path d={geo.path} />
          </clipPath>
          <radialGradient id={`${id}-gloss`} cx="34%" cy="24%" r="78%">
            <stop offset="0%" stopColor="#fff" stopOpacity={light ? 0.75 : 0.5} />
            <stop offset="45%" stopColor="#fff" stopOpacity={0.08} />
            <stop offset="100%" stopColor="#fff" stopOpacity={0} />
          </radialGradient>
          <linearGradient id={`${id}-shade`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="55%" stopColor="#000" stopOpacity={0} />
            <stop offset="100%" stopColor="#000" stopOpacity={light ? 0.12 : 0.2} />
          </linearGradient>
          <filter id={`${id}-shadow`} x="-30%" y="-30%" width="160%" height="170%">
            <feDropShadow dx="0" dy={0.35} stdDeviation={0.4} floodColor="#17202B" floodOpacity={0.22} />
            <feDropShadow dx="0" dy={1.1} stdDeviation={1.2} floodColor="#17202B" floodOpacity={0.12} />
          </filter>
        </defs>

        <g transform={`translate(${vbW / 2} ${cy})`}>
          {(highlight === "color" || highlight === "shape") && (
            <path
              d={geo.path}
              fill="none"
              stroke={MISMATCH}
              strokeWidth={2.1}
              strokeLinejoin="round"
              strokeDasharray={highlight === "shape" ? "1.1 0.7" : undefined}
              data-highlight={highlight}
            />
          )}
          {(highlight === "color" || highlight === "shape") && (
            <path d={geo.path} fill="none" stroke="#FAFBFC" strokeWidth={1.1} strokeLinejoin="round" />
          )}

          <g filter={`url(#${id}-shadow)`}>
            <path d={geo.path} fill={fills[0]} />
          </g>

          <g clipPath={`url(#${id}-clip)`}>
            {fills[1] && (
              <rect x={0} y={-geo.height} width={geo.width} height={geo.height * 2} fill={fills[1]} />
            )}
            {fills[1] && (
              <line
                x1={0}
                y1={-geo.height}
                x2={0}
                y2={geo.height}
                stroke="#000"
                strokeOpacity={0.14}
                strokeWidth={0.18}
              />
            )}
            <rect x={-geo.width} y={-geo.height} width={geo.width * 2} height={geo.height * 2} fill={`url(#${id}-shade)`} />
            <rect x={-geo.width} y={-geo.height} width={geo.width * 2} height={geo.height * 2} fill={`url(#${id}-gloss)`} />
            {/* inner edge: makes the pill read as a solid object, not a flat sticker */}
            <path d={geo.path} fill="none" stroke="#000" strokeOpacity={light ? 0.14 : 0.2} strokeWidth={0.5} />
            {geo.drawn !== "capsule" && (
              // the bevel "land" just inside the edge of a pressed tablet
              <path
                d={geo.path}
                fill="none"
                stroke="#fff"
                strokeOpacity={0.32}
                strokeWidth={0.22}
                transform="scale(0.9)"
              />
            )}
            {scored && (
              <g>
                <line x1={0} y1={-geo.height / 2} x2={0} y2={geo.height / 2} stroke={debossLight} strokeOpacity={0.6} strokeWidth={0.22} transform="translate(0.12 0)" />
                <line x1={0} y1={-geo.height / 2} x2={0} y2={geo.height / 2} stroke={debossDark} strokeOpacity={0.55} strokeWidth={0.26} />
              </g>
            )}
          </g>

          {front &&
            (style === "debossed" ? (
              <g
                fontFamily="var(--font-mono), ui-monospace, monospace"
                fontWeight={700}
                fontSize={fontSize}
                textAnchor="middle"
                dominantBaseline="central"
              >
                <text x={0.09} y={0.11} fill={debossLight} fillOpacity={0.75}>
                  {front}
                </text>
                <text x={0} y={0} fill={debossDark} fillOpacity={0.85}>
                  {front}
                </text>
              </g>
            ) : (
              <text
                x={0}
                y={0}
                fontFamily="var(--font-mono), ui-monospace, monospace"
                fontWeight={700}
                fontSize={fontSize}
                textAnchor="middle"
                dominantBaseline="central"
                fill={inkColor}
                fillOpacity={0.88}
              >
                {front}
              </text>
            ))}

          {highlight === "imprint" && front && (
            <rect
              x={-textWidth / 2 - 0.7}
              y={-fontSize * 0.72}
              width={textWidth + 1.4}
              height={fontSize * 1.44}
              rx={fontSize * 0.36}
              fill="none"
              stroke={MISMATCH}
              strokeWidth={0.34}
              data-highlight="imprint"
            />
          )}
        </g>

        {ruler && (
          <g transform={`translate(${vbW / 2 - rulerMm / 2} ${PAD * 2 + geo.height + 0.6})`} fill="#5B6573" stroke="#5B6573">
            <line x1={0} y1={0} x2={rulerMm} y2={0} strokeWidth={0.14} />
            {Array.from({ length: rulerMm + 1 }, (_, i) => (
              <line key={i} x1={i} y1={0} x2={i} y2={i % 5 === 0 ? 0.9 : 0.5} strokeWidth={0.1} />
            ))}
            <text
              x={rulerMm / 2}
              y={2.6}
              stroke="none"
              fontSize={1.5}
              textAnchor="middle"
              fontFamily="var(--font-sans), system-ui, sans-serif"
            >
              {rulerMm} mm
            </text>
          </g>
        )}
      </svg>
      {back && (
        <figcaption className="mt-1 text-base text-ink-soft">
          Other side: <span className="font-mono font-semibold text-ink">{back}</span>
        </figcaption>
      )}
    </figure>
  );
}
