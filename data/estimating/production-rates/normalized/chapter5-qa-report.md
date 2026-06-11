# Chapter 5 Production Rate QA Report

## Totals

- candidates: 1954
- rejectedRows: 243
- duplicates: 1
- skippedTables: 104
- suspiciousRates: 2
- suspiciousUnits: 1
- missingSectionTitle: 53

## Candidates by Division

- 06: 235
- 26: 220
- 09: 203
- 07: 139
- 13: 118
- 31: 102
- 08: 87
- 03: 86
- 04: 85
- 33: 80
- 22: 73
- 23: 73
- 05: 65
- 21: 61
- 32: 59
- 10: 57
- 02: 46
- 34: 39
- 01: 35
- 27: 33
- 35: 24
- 12: 8
- 28: 8
- 41: 8
- 46: 6
- 11: 4

## Rejected Rows by Reason

- Missing unit or man-hours value: 160
- Could not determine CSI/work element section code: 42
- Missing item description after removing section/item codes: 37
- Could not parse numeric man-hours per unit: 4

## Top Units

- Each: 730
- SF: 397
- LF: 327
- BF: 150
- SY: 67
- Square: 56
- Ton: 38
- Bank CYD: 27
- Feet: 22
- Acre: 21
- CYD: 20
- SF Floor: 15
- Opening: 13
- SF of contact surface: 11
- Pair: 8
- SF of shelf: 6
- Each Each: 5
- LB: 4
- CF: 3
- LF Each: 3
- Riser: 3
- SM: 3
- Splice: 3
- Flight: 2
- LF of wall: 2

## Duplicate Samples

```json
[
  {
    "id": "22-13-16.20-bends-each",
    "count": 2,
    "records": [
      {
        "sourceTableFile": "fileoutpart328.xlsx",
        "sourceRowNumberApprox": 10,
        "sectionCode": "22 13 16.20",
        "itemCode": null,
        "workElementDescription": "Bends",
        "unit": "Each",
        "manHoursPerUnit": 0.95
      },
      {
        "sourceTableFile": "fileoutpart328.xlsx",
        "sourceRowNumberApprox": 17,
        "sectionCode": "22 13 16.20",
        "itemCode": null,
        "workElementDescription": "Bends",
        "unit": "Each",
        "manHoursPerUnit": 0.95
      }
    ]
  }
]
```

## Suspicious Unit Samples

```json
[
  {
    "id": "01-54-23.70-0010-scaffolding-0010-erect-and-dismantle-tubular-scaffold-including-planks-and-leveling-square-foot-of-wall-surface",
    "sourceChapter": "chapter5",
    "sourceTableFile": "fileoutpart20.xlsx",
    "sourceSheetName": "Sheet1",
    "sourceRowNumberApprox": 4,
    "sectionCode": "01 54 23.70",
    "sectionTitle": null,
    "itemCode": "0010",
    "workElementDescription": "Scaffolding (0010) Erect and dismantle tubular scaffold (including planks and leveling)",
    "unit": "square foot of wall surface",
    "manHoursPerUnit": 0.04,
    "rateComponents": [
      {
        "name": "fabricate",
        "manHoursPerUnit": 0.04
      }
    ],
    "rawRow": [
      "01 54 23.70 Scaffolding (0010) Erect and dismantle tubular scaffold (including planks and leveling)",
      "square foot of wall surface",
      "0.040"
    ]
  }
]
```

## Candidate Samples

```json
[
  {
    "id": "01-51-13.80-trailer-mounted-floodlight-set-4-light-telescoping-each",
    "sourceChapter": "chapter5",
    "sourceTableFile": "fileoutpart20.xlsx",
    "sourceSheetName": "Sheet1",
    "sourceRowNumberApprox": 2,
    "sectionCode": "01 51 13.80",
    "sectionTitle": null,
    "itemCode": null,
    "workElementDescription": "Trailer Mounted Floodlight Set, 4 Light, Telescoping",
    "unit": "Each",
    "manHoursPerUnit": 5,
    "rateComponents": [
      {
        "name": "fabricate",
        "manHoursPerUnit": 5
      }
    ],
    "rawRow": [
      "01 51 13.80 0300 Trailer Mounted Floodlight Set, 4 Light, Telescoping",
      "Each",
      ".5"
    ]
  },
  {
    "id": "01-51-13.80-jobsite-portolet-each",
    "sourceChapter": "chapter5",
    "sourceTableFile": "fileoutpart20.xlsx",
    "sourceSheetName": "Sheet1",
    "sourceRowNumberApprox": 3,
    "sectionCode": "01 51 13.80",
    "sectionTitle": null,
    "itemCode": null,
    "workElementDescription": "Jobsite Portolet",
    "unit": "Each",
    "manHoursPerUnit": 5,
    "rateComponents": [
      {
        "name": "fabricate",
        "manHoursPerUnit": 5
      }
    ],
    "rawRow": [
      "01 51 13.80 0400 Jobsite Portolet",
      "Each",
      ".5"
    ]
  },
  {
    "id": "01-54-23.70-0010-scaffolding-0010-erect-and-dismantle-tubular-scaffold-including-planks-and-leveling-square-foot-of-wall-surface",
    "sourceChapter": "chapter5",
    "sourceTableFile": "fileoutpart20.xlsx",
    "sourceSheetName": "Sheet1",
    "sourceRowNumberApprox": 4,
    "sectionCode": "01 54 23.70",
    "sectionTitle": null,
    "itemCode": "0010",
    "workElementDescription": "Scaffolding (0010) Erect and dismantle tubular scaffold (including planks and leveling)",
    "unit": "square foot of wall surface",
    "manHoursPerUnit": 0.04,
    "rateComponents": [
      {
        "name": "fabricate",
        "manHoursPerUnit": 0.04
      }
    ],
    "rawRow": [
      "01 54 23.70 Scaffolding (0010) Erect and dismantle tubular scaffold (including planks and leveling)",
      "square foot of wall surface",
      "0.040"
    ]
  },
  {
    "id": "01-54-36.00-cese-mobilization-or-demobilization-each",
    "sourceChapter": "chapter5",
    "sourceTableFile": "fileoutpart20.xlsx",
    "sourceSheetName": "Sheet1",
    "sourceRowNumberApprox": 7,
    "sectionCode": "01 54 36.00",
    "sectionTitle": null,
    "itemCode": null,
    "workElementDescription": "CESE Mobilization or Demobilization",
    "unit": "Each",
    "manHoursPerUnit": 3,
    "rateComponents": [
      {
        "name": "fabricate",
        "manHoursPerUnit": 3
      }
    ],
    "rawRow": [
      "01 54 36.00 0010 CESE Mobilization or Demobilization",
      "Each",
      "3.0"
    ]
  },
  {
    "id": "01-54-39.00-tool-kit-inventory-kit",
    "sourceChapter": "chapter5",
    "sourceTableFile": "fileoutpart20.xlsx",
    "sourceSheetName": "Sheet1",
    "sourceRowNumberApprox": 8,
    "sectionCode": "01 54 39.00",
    "sectionTitle": null,
    "itemCode": null,
    "workElementDescription": "Tool Kit Inventory",
    "unit": "Kit",
    "manHoursPerUnit": 2,
    "rateComponents": [
      {
        "name": "fabricate",
        "manHoursPerUnit": 2
      }
    ],
    "rawRow": [
      "01 54 39.00 0010 Tool Kit Inventory",
      "Kit",
      "2.0"
    ]
  },
  {
    "id": "01-58-13.00-project-sign-each",
    "sourceChapter": "chapter5",
    "sourceTableFile": "fileoutpart20.xlsx",
    "sourceSheetName": "Sheet1",
    "sourceRowNumberApprox": 9,
    "sectionCode": "01 58 13.00",
    "sectionTitle": null,
    "itemCode": null,
    "workElementDescription": "Project Sign",
    "unit": "Each",
    "manHoursPerUnit": 16,
    "rateComponents": [
      {
        "name": "fabricate",
        "manHoursPerUnit": 16
      }
    ],
    "rawRow": [
      "01 58 13.00 0010 Project Sign",
      "Each",
      "16.0"
    ]
  },
  {
    "id": "01-55-23.50-0010-roads-gravel-fill-no-surfacing-4-inch-gravel-depth-sy",
    "sourceChapter": "chapter5",
    "sourceTableFile": "fileoutpart22.xlsx",
    "sourceSheetName": "Sheet1",
    "sourceRowNumberApprox": 4,
    "sectionCode": "01 55 23.50",
    "sectionTitle": "Roads and Sidewalks",
    "itemCode": "0010",
    "workElementDescription": "Roads, gravel fill, no surfacing, 4-inch gravel depth",
    "unit": "SY",
    "manHoursPerUnit": 0.09,
    "rateComponents": [
      {
        "name": "fabricate",
        "manHoursPerUnit": 0.09
      }
    ],
    "rawRow": [
      "(0010) Roads, gravel fill, no surfacing, 4-inch gravel depth",
      "SY",
      "0.090"
    ]
  },
  {
    "id": "01-55-23.50-0020-8-inch-gravel-depth-sy",
    "sourceChapter": "chapter5",
    "sourceTableFile": "fileoutpart22.xlsx",
    "sourceSheetName": "Sheet1",
    "sourceRowNumberApprox": 5,
    "sectionCode": "01 55 23.50",
    "sectionTitle": "Roads and Sidewalks",
    "itemCode": "0020",
    "workElementDescription": "8-inch gravel depth",
    "unit": "SY",
    "manHoursPerUnit": 0.104,
    "rateComponents": [
      {
        "name": "fabricate",
        "manHoursPerUnit": 0.104
      }
    ],
    "rawRow": [
      "(0020) 8-inch gravel depth",
      "SY",
      "0.104"
    ]
  },
  {
    "id": "01-55-23.50-0030-ramp-3-4-inch-plywood-on-2-by-6-inch-joists-16-inches-on-center-sf",
    "sourceChapter": "chapter5",
    "sourceTableFile": "fileoutpart22.xlsx",
    "sourceSheetName": "Sheet1",
    "sourceRowNumberApprox": 6,
    "sectionCode": "01 55 23.50",
    "sectionTitle": "Roads and Sidewalks",
    "itemCode": "0030",
    "workElementDescription": "Ramp, 3/4-inch plywood on 2- by 6-inch joists, 16 inches on center",
    "unit": "SF",
    "manHoursPerUnit": 0.07,
    "rateComponents": [
      {
        "name": "fabricate",
        "manHoursPerUnit": 0.07
      }
    ],
    "rawRow": [
      "(0030) Ramp, 3/4-inch plywood on 2- by 6-inch joists, 16 inches on center",
      "SF",
      "0.070"
    ]
  },
  {
    "id": "01-55-23.50-0040-2-by-10-inch-joists-16-inches-on-center-sf",
    "sourceChapter": "chapter5",
    "sourceTableFile": "fileoutpart22.xlsx",
    "sourceSheetName": "Sheet1",
    "sourceRowNumberApprox": 7,
    "sectionCode": "01 55 23.50",
    "sectionTitle": "Roads and Sidewalks",
    "itemCode": "0040",
    "workElementDescription": "2- by 10-inch joists, 16 inches on center",
    "unit": "SF",
    "manHoursPerUnit": 0.077,
    "rateComponents": [
      {
        "name": "fabricate",
        "manHoursPerUnit": 0.077
      }
    ],
    "rawRow": [
      "(0040) 2- by 10-inch joists, 16 inches on center",
      "SF",
      "0.077"
    ]
  }
]
```