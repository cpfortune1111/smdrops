# SMD stage converter

This read-only converter implements the `SMStageDataImpl.Deserialize` format
from the decompiled Sailor Moon Drops 1.29.0 code.

```powershell
python smd_stage_converter.py `
  --source "E:\SMDrops-AssetDump-Full" `
  --output "stage-json"
```

The output uses WW as the base set. Because 7,144 matching JP files are
byte-identical, it only writes the 10 different JP files and 35 JP-only ADV
stages to `stages/jp-overrides`. `catalog.json` is the loading index and
`audit.json` records any parser warnings or failures.

The converter never writes to the source directory and refuses to write into a
non-empty output directory.

