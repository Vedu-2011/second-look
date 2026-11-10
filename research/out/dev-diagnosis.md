# Development diagnosis (phase-4 frozen caches, no model calls)

200 photos / 400 pairs. 257 UNSURE pairs; 54 no-read photos; 8 reader-error photos. All 400 rows, including every no-read and UNSURE, are in dev-diagnosis.json. Counts below overlap. “Other side” is only a hypothesis from FDA multipart text, never a claim we know what the unseen photo contains.

| Flag on UNSURE pairs | Count |
|---|---:|
| no imprint read | 108 |
| FDA has multiple imprint parts; unseen side possible, not proven | 137 |
| low imprint confidence | 244 |
| color disagrees | 69 |
| discontinued record (context, not an abstention cause) | 149 |
| partial matching imprint | 42 |
| shape disagrees | 25 |
| multiple-pill flag (new engine will abstain) | 14 |
| reader error | 16 |

## Ten examples (first ten in fixed cohort order, not selected for success)

| Photo | Label NDC | FDA imprint | Read | Flags |
|---|---|---|---|---|
| research/data/00093032101-0.jpg | 00093032101 | 93;321 |  | no imprint read; FDA has multiple imprint parts; unseen side possible, not proven; low imprint confidence |
| research/data/00093032101-0.jpg | 68180040301 | LUPIN;250 |  | no imprint read; FDA has multiple imprint parts; unseen side possible, not proven; low imprint confidence |
| research/data/00093032101-1.jpg | 00093032101 | 93;321 | 93 321 | low imprint confidence; color disagrees |
| research/data/00093032101-1.jpg | 68180040301 | LUPIN;250 | 93 321 | low imprint confidence; color disagrees |
| research/data/00378041510-0.jpg | 00378041510 | M;15 | M 15 | low imprint confidence; discontinued record (context, not an abstention cause) |
| research/data/00378041510-0.jpg | 00172409760 | 4097;TV | M 15 | low imprint confidence |
| research/data/00378041510-1.jpg | 00378041510 | M;15 | 15 | partial matching imprint; FDA has multiple imprint parts; unseen side possible, not proven; low imprint confidence; discontinued record (context, not an abstention cause) |
| research/data/00378041510-1.jpg | 00172409760 | 4097;TV | 15 | low imprint confidence |
| research/data/65862014301-0.jpg | 65862014301 | E;02 | M | low imprint confidence; shape disagrees |
| research/data/65862014301-0.jpg | 50458030006 | R1;JANSSEN | M | low imprint confidence; shape disagrees |

## Plan grounded in the diagnosis

Preserve the existing 0.7 imprint threshold. Empty visible sides need another view, not a lower threshold. Clean bounded strings before schema validation and mark trimmed evidence below threshold rather than discarding the entire reading. Ask for a second view when no imprint or a partial/multipart imprint is present. Require compatible appearance on both views and retain every disagreement as UNSURE. The current matcher already accepts a visible subset of FDA imprint tokens; do not introduce a further permissive partial-side rule. No rereading development photos with v2: reserve the $5 budget for a product-disjoint holdout.
