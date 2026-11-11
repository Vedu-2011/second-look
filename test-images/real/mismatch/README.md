# The wrong pill

Add `label.jpg`: the whole fictional Metformin 1,000 mg TABLET label from `/labels`, NDC 70010-065, made by Granules. Add `pill.jpg`: one real white amoxicillin 500 mg tablet, 93 on one side and 2263 on the other.

For the flip step in the interactive checker, shoot the 93 side first (MISMATCH, asks you to flip), then the 2263 side (identified as amoxicillin 500 mg). For the saved sample builder, use a sharp view of one side. Plain dark surface, close view, angled light, no glare. Keep demo pills separate from bottles used for actual medicine.

Use the fictional patient Alex Rivera and the fictional pharmacy from `/labels`; exclude real patient information. Photos will be published. Run `npm run samples:build` after adding both photos to orient, resize, remove EXIF and run the live check. An empty folder retains the recorded FDA example. Never generate or edit pill photos.
