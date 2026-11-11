# The right pill

Put two phone photos here: `label.jpg` (the whole fictional pharmacy label, printed from `/labels`) and `pill.jpg` (one real pill, on a plain surface, letters facing up, in good light).

Use the store-brand ibuprofen 200 mg pill that matches the label's NDC. Default label: 0113-0517, L. Perrigo, orange oval I2. Change the printed label's NDC and maker to match the actual package you buy. Use only the fictional patient Alex Rivera. These demo photos will be published; exclude any real patient information.

Run `npm run samples:build`. Both photos are required. The command applies orientation, resizes, removes EXIF, checks the photos live, and saves public images and the result. Commit those generated files to publish them. An empty folder keeps the recorded FDA example.

## Current real pills (Nov 10)
Label: Kirkland ibuprofen 200 mg capsule, NDC 63981-598, Costco (use Advil Liqui-Gels NDC 0573-0169, Haleon for different-maker).
Right pill: shiny blue Kirkland softgel, small PRINTED IB1. Shoot close with angled light and no glare, letters facing up.
Wrong pill: white Tylenol Extra Strength caplet, TYLENOL on one side and 500 on the other (NDC 50580-937). Capture both sides to demonstrate the flip step.
Use fictional patient labels. Do not edit or generate the pill photos.
