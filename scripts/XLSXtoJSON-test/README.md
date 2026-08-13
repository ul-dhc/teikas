# XLSXtoJSON automated tests

This suite verifies both the converter's validation behaviour and the fidelity of
the generated JSON files.

## Run

From the project root:

```text
python scripts/XLSXtoJSON-test/run_tests.py
```

By default the tests use:

```text
latvian_legends_master_data.xlsx
teikas_json/
```

Override either path when testing another publication build:

```text
XLSX_SOURCE=/path/to/source.xlsx JSON_OUTPUT=/path/to/json python scripts/XLSXtoJSON-test/run_tests.py
```

On PowerShell:

```powershell
$env:XLSX_SOURCE = "C:\path\to\source.xlsx"
$env:JSON_OUTPUT = "C:\path\to\json"
python XLSXtoJSON-test/run_tests.py
```

The only non-standard dependency is `openpyxl`, which is already required by
`XLSXtoJSON.py`. No pytest installation is required.

## Coverage

- Every public JSON object is compared with its source XLSX row.
- Required files, record counts, field names, nulls, Unicode text, coordinates,
  computed counts, ordering, and manifest checksums are checked.
- IDs must be present and unique.
- Legend links to collectors, narrators, and places must resolve.
- Legend-source links must resolve at both ends and may not be duplicated.
- `legendCount` and `relationCount` must equal the exact number of matching
  relationship records.
- Fixture workbooks confirm that the converter rejects duplicate IDs, missing
  sheets, changed headers, broken links, incomplete coordinates, invalid
  coordinates, and duplicate source relationships with understandable errors.

Failures name the dataset, object ID, and field whenever possible so an editor
can locate the problem quickly.
