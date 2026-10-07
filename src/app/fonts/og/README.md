# Social card fonts

These static TTF subsets were derived from the self-hosted WOFF2 files in the
parent directory. The social image renderer accepts TTF but not the site's
WOFF2 files. All glyphs in those Latin, Thai and Arabic source subsets are
retained; the variable faces were instanced at weight 600.

| File | Source | License |
| --- | --- | --- |
| `dm-sans-latin.ttf` | `../dm-sans-latin.woff2` | `../dmsans-OFL.txt` |
| `noto-sans-thai.ttf` | `../noto-sans-thai.woff2` | `../notosansthai-OFL.txt` |
| `noto-sans-arabic.ttf` | `../noto-sans-arabic.woff2` | `../notosansarabic-OFL.txt` |

Source URLs and SHA-256 hashes are in `../manifest.json`. Recreate these with
FontTools `TTFont` and `fontTools.varLib.instancer.instantiateVariableFont` if
the source fonts change.
