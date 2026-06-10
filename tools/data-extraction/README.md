# Chapter 5 production-rate extraction

Python tools for extracting, normalizing, and promoting MCRP/NTRP production tables.

See [docs/estimating-data-pipeline.md](../../docs/estimating-data-pipeline.md) for the full workflow.

```powershell
python -m pip install -r tools/data-extraction/requirements.txt
python tools/data-extraction/extract_chapter5.py                      # priority divisions
python tools/data-extraction/extract_chapter5.py --all-divisions      # full manual
python tools/data-extraction/normalize_raw.py
```
