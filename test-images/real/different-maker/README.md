# Same medicine, new look

Add `label.jpg`: the whole fictional Advil Liqui-Gels (ibuprofen) 200 mg CAPSULE label from `/labels`, NDC 0573-0169, made by Haleon. Add `pill.jpg`: one real Kirkland blue softgel with PRINTED IB 200, not an Advil pill.

The IB 200 print is small, faint and curved on a shiny capsule. Shoot very close, with soft angled light and no glare, on a plain white surface, letters up and facing the camera. If the letters aren't readable in the photo, the result stays "can't tell"; retake it rather than guessing. The result should be SAME_MEDICINE_DIFFERENT_MAKER, "sold by N companies".

Use the fictional patient Alex Rivera and the fictional pharmacy from `/labels`; exclude real patient information. Photos will be published. Run `npm run samples:build` after adding both photos to orient, resize, remove EXIF and run the live check. An empty folder retains the recorded FDA example. Never generate or edit pill photos.
