# Phase 2 pill-photo sources

The NIH/NLM Pill Image Recognition Challenge dataset is hosted at:
https://data.lhncbc.nlm.nih.gov/public/Pills/index.html

The public directory is organized as `PillProjectDisc*` folders and includes consumer photographs plus XML metadata.
The dataset is used for research evaluation in phase 4. The live AI smoke runner accepts these files when matching
images are selected. If a needed I2, L484, or Advil-type image is not located, that absence is recorded here rather
than substituting an invented photo.

Reference paper: Yaniv Z et al., “The National Library of Medicine Pill Image Recognition Challenge: An Initial
Report,” IEEE Applied Imagery and Pattern Recognition Workshop, 2016, PMID 29854569.

The included `strattera-10mg-1.jpg` and `strattera-10mg-2.jpg` are consumer-grade reference photos from
the dataset's `C3PI_Test` entries for NDC `00002322730`, downloaded from the matching `PillProjectDisc10`
and `PillProjectDisc11` image paths. The directory did not contain exact consumer images for the demo
imprints `I2`, `L484`, or the Advil NDCs, so those scenario photos are not fabricated or mislabeled.
