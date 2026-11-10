# The right pill

Put two phone photos here: `label.jpg` (the whole fictional pharmacy label, printed from `/labels`) and `pill.jpg` (one real pill, on a plain surface, letters facing up, in good light).

Use the store-brand ibuprofen 200 mg pill that matches the label's NDC. Default label: 0113-0517, L. Perrigo, orange oval I2. Change the printed label's NDC and maker to match the actual package you buy. Use only the fictional patient Alex Rivera. These demo photos will be published; exclude any real patient information.

Run `npm run samples:build`. Both photos are required. The command applies orientation, resizes, removes EXIF, checks the photos live, and saves public images and the result. Commit those generated files to publish them. An empty folder keeps the recorded FDA example.
