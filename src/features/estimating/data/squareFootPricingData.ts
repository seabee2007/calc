export const squareFootPricingData = {
  "version": "2026.06.us_sf_budget_v1",
  "createdDate": "2026-06-06",
  "purpose": "Early budget price-per-square-foot calculator for residential/light construction planning. Not a final estimate.",
  "importantLimitations": [
    "Use for early budgeting only.",
    "Excludes land unless the app adds land separately.",
    "Soft costs, design fees, permits, impact fees, utility taps, financing, and owner FF&E should be separate adders.",
    "Always convert to a work breakdown/activity estimate before proposal issuance.",
    "Territory data is less reliable than state data and should be locally verified."
  ],
  "projectTypeMultipliers": {
    "newConstruction": {
      "factor": 1.0,
      "description": "Ground-up new build; cleanest use of SF pricing."
    },
    "additionBuildOut": {
      "factor": 1.2,
      "description": "Single-story addition tying into existing structure."
    },
    "additionBuildUp": {
      "factor": 1.75,
      "description": "Second-story/vertical addition; structural tie-ins drive cost."
    },
    "lightRemodel": {
      "factor": 0.35,
      "description": "Cosmetic remodel; paint, flooring, fixtures. Apply to affected SF only."
    },
    "moderateRemodel": {
      "factor": 0.7,
      "description": "Layout/MEP/finish updates. Apply to affected SF only."
    },
    "gutRemodel": {
      "factor": 1.1,
      "description": "Major renovation down to studs with MEP and structural changes."
    },
    "demoAndRebuild": {
      "factor": 1.12,
      "description": "New construction plus demolition/site reset. Add demolition cost separately when possible."
    }
  },
  "finishMultipliers": {
    "basic": 0.88,
    "standard": 1.0,
    "premium": 1.2,
    "luxury": 1.5,
    "custom": 1.75
  },
  "complexityMultipliers": {
    "simpleBox": 0.92,
    "average": 1.0,
    "complex": 1.15,
    "highCustom": 1.3
  },
  "siteConditionMultipliers": {
    "easyFlatAccess": 1.0,
    "moderate": 1.08,
    "difficultSlopeLimitedAccess": 1.2,
    "remoteIslandOrHardLogistics": 1.3
  },
  "demoCostPerSfDefaults": {
    "interiorDemoLow": 2,
    "interiorDemoHigh": 8,
    "wholeHouseDemoLow": 4,
    "wholeHouseDemoHigh": 17,
    "heavyOrIslandDemoLow": 12,
    "heavyOrIslandDemoHigh": 35
  },
  "locations": [
    {
      "code": "AL",
      "name": "Alabama",
      "region": "South",
      "currency": "USD",
      "unit": "per_square_foot",
      "newConstruction": {
        "hardCostAvg": 159,
        "planningLow": 150,
        "planningHigh": 270,
        "suggestedMidWithContractorOHProfit": 191
      },
      "locationFactorVsNational195": 0.979,
      "confidence": "medium",
      "notes": "50-state benchmark blended from public state average and published low/high planning range. Excludes land. Verify with local bid data."
    },
    {
      "code": "AK",
      "name": "Alaska",
      "region": "Pacific",
      "currency": "USD",
      "unit": "per_square_foot",
      "newConstruction": {
        "hardCostAvg": 228,
        "planningLow": 215,
        "planningHigh": 315,
        "suggestedMidWithContractorOHProfit": 274
      },
      "locationFactorVsNational195": 1.405,
      "confidence": "medium",
      "notes": "50-state benchmark blended from public state average and published low/high planning range. Excludes land. Verify with local bid data."
    },
    {
      "code": "AZ",
      "name": "Arizona",
      "region": "Southwest",
      "currency": "USD",
      "unit": "per_square_foot",
      "newConstruction": {
        "hardCostAvg": 165,
        "planningLow": 160,
        "planningHigh": 280,
        "suggestedMidWithContractorOHProfit": 198
      },
      "locationFactorVsNational195": 1.015,
      "confidence": "medium",
      "notes": "50-state benchmark blended from public state average and published low/high planning range. Excludes land. Verify with local bid data."
    },
    {
      "code": "AR",
      "name": "Arkansas",
      "region": "South Central",
      "currency": "USD",
      "unit": "per_square_foot",
      "newConstruction": {
        "hardCostAvg": 156,
        "planningLow": 150,
        "planningHigh": 260,
        "suggestedMidWithContractorOHProfit": 187
      },
      "locationFactorVsNational195": 0.959,
      "confidence": "medium",
      "notes": "50-state benchmark blended from public state average and published low/high planning range. Excludes land. Verify with local bid data."
    },
    {
      "code": "CA",
      "name": "California",
      "region": "West Coast",
      "currency": "USD",
      "unit": "per_square_foot",
      "newConstruction": {
        "hardCostAvg": 225,
        "planningLow": 215,
        "planningHigh": 430,
        "suggestedMidWithContractorOHProfit": 270
      },
      "locationFactorVsNational195": 1.385,
      "confidence": "medium",
      "notes": "50-state benchmark blended from public state average and published low/high planning range. Excludes land. Verify with local bid data."
    },
    {
      "code": "CO",
      "name": "Colorado",
      "region": "Mountain West",
      "currency": "USD",
      "unit": "per_square_foot",
      "newConstruction": {
        "hardCostAvg": 172,
        "planningLow": 160,
        "planningHigh": 280,
        "suggestedMidWithContractorOHProfit": 206
      },
      "locationFactorVsNational195": 1.056,
      "confidence": "medium",
      "notes": "50-state benchmark blended from public state average and published low/high planning range. Excludes land. Verify with local bid data."
    },
    {
      "code": "CT",
      "name": "Connecticut",
      "region": "Northeast",
      "currency": "USD",
      "unit": "per_square_foot",
      "newConstruction": {
        "hardCostAvg": 200,
        "planningLow": 200,
        "planningHigh": 350,
        "suggestedMidWithContractorOHProfit": 240
      },
      "locationFactorVsNational195": 1.231,
      "confidence": "medium",
      "notes": "50-state benchmark blended from public state average and published low/high planning range. Excludes land. Verify with local bid data."
    },
    {
      "code": "DE",
      "name": "Delaware",
      "region": "South Atlantic",
      "currency": "USD",
      "unit": "per_square_foot",
      "newConstruction": {
        "hardCostAvg": 170,
        "planningLow": 190,
        "planningHigh": 330,
        "suggestedMidWithContractorOHProfit": 204
      },
      "locationFactorVsNational195": 1.046,
      "confidence": "medium",
      "notes": "50-state benchmark blended from public state average and published low/high planning range. Excludes land. Verify with local bid data."
    },
    {
      "code": "FL",
      "name": "Florida",
      "region": "South Atlantic",
      "currency": "USD",
      "unit": "per_square_foot",
      "newConstruction": {
        "hardCostAvg": 160,
        "planningLow": 150,
        "planningHigh": 270,
        "suggestedMidWithContractorOHProfit": 192
      },
      "locationFactorVsNational195": 0.985,
      "confidence": "medium",
      "notes": "50-state benchmark blended from public state average and published low/high planning range. Excludes land. Verify with local bid data."
    },
    {
      "code": "GA",
      "name": "Georgia",
      "region": "South Atlantic",
      "currency": "USD",
      "unit": "per_square_foot",
      "newConstruction": {
        "hardCostAvg": 162,
        "planningLow": 160,
        "planningHigh": 280,
        "suggestedMidWithContractorOHProfit": 194
      },
      "locationFactorVsNational195": 0.995,
      "confidence": "medium",
      "notes": "50-state benchmark blended from public state average and published low/high planning range. Excludes land. Verify with local bid data."
    },
    {
      "code": "HI",
      "name": "Hawaii",
      "region": "Pacific",
      "currency": "USD",
      "unit": "per_square_foot",
      "newConstruction": {
        "hardCostAvg": 230,
        "planningLow": 215,
        "planningHigh": 450,
        "suggestedMidWithContractorOHProfit": 276
      },
      "locationFactorVsNational195": 1.415,
      "confidence": "medium",
      "notes": "50-state benchmark blended from public state average and published low/high planning range. Excludes land. Verify with local bid data."
    },
    {
      "code": "ID",
      "name": "Idaho",
      "region": "Mountain West",
      "currency": "USD",
      "unit": "per_square_foot",
      "newConstruction": {
        "hardCostAvg": 163,
        "planningLow": 170,
        "planningHigh": 260,
        "suggestedMidWithContractorOHProfit": 196
      },
      "locationFactorVsNational195": 1.005,
      "confidence": "medium",
      "notes": "50-state benchmark blended from public state average and published low/high planning range. Excludes land. Verify with local bid data."
    },
    {
      "code": "IL",
      "name": "Illinois",
      "region": "Midwest",
      "currency": "USD",
      "unit": "per_square_foot",
      "newConstruction": {
        "hardCostAvg": 170,
        "planningLow": 200,
        "planningHigh": 320,
        "suggestedMidWithContractorOHProfit": 204
      },
      "locationFactorVsNational195": 1.046,
      "confidence": "medium",
      "notes": "50-state benchmark blended from public state average and published low/high planning range. Excludes land. Verify with local bid data."
    },
    {
      "code": "IN",
      "name": "Indiana",
      "region": "Midwest",
      "currency": "USD",
      "unit": "per_square_foot",
      "newConstruction": {
        "hardCostAvg": 161,
        "planningLow": 170,
        "planningHigh": 290,
        "suggestedMidWithContractorOHProfit": 193
      },
      "locationFactorVsNational195": 0.99,
      "confidence": "medium",
      "notes": "50-state benchmark blended from public state average and published low/high planning range. Excludes land. Verify with local bid data."
    },
    {
      "code": "IA",
      "name": "Iowa",
      "region": "Midwest",
      "currency": "USD",
      "unit": "per_square_foot",
      "newConstruction": {
        "hardCostAvg": 171,
        "planningLow": 160,
        "planningHigh": 280,
        "suggestedMidWithContractorOHProfit": 205
      },
      "locationFactorVsNational195": 1.051,
      "confidence": "medium",
      "notes": "50-state benchmark blended from public state average and published low/high planning range. Excludes land. Verify with local bid data."
    },
    {
      "code": "KS",
      "name": "Kansas",
      "region": "Midwest",
      "currency": "USD",
      "unit": "per_square_foot",
      "newConstruction": {
        "hardCostAvg": 162,
        "planningLow": 160,
        "planningHigh": 280,
        "suggestedMidWithContractorOHProfit": 194
      },
      "locationFactorVsNational195": 0.995,
      "confidence": "medium",
      "notes": "50-state benchmark blended from public state average and published low/high planning range. Excludes land. Verify with local bid data."
    },
    {
      "code": "KY",
      "name": "Kentucky",
      "region": "South Central",
      "currency": "USD",
      "unit": "per_square_foot",
      "newConstruction": {
        "hardCostAvg": 158,
        "planningLow": 150,
        "planningHigh": 270,
        "suggestedMidWithContractorOHProfit": 190
      },
      "locationFactorVsNational195": 0.974,
      "confidence": "medium",
      "notes": "50-state benchmark blended from public state average and published low/high planning range. Excludes land. Verify with local bid data."
    },
    {
      "code": "LA",
      "name": "Louisiana",
      "region": "South Central",
      "currency": "USD",
      "unit": "per_square_foot",
      "newConstruction": {
        "hardCostAvg": 158,
        "planningLow": 150,
        "planningHigh": 270,
        "suggestedMidWithContractorOHProfit": 190
      },
      "locationFactorVsNational195": 0.974,
      "confidence": "medium",
      "notes": "50-state benchmark blended from public state average and published low/high planning range. Excludes land. Verify with local bid data."
    },
    {
      "code": "ME",
      "name": "Maine",
      "region": "Northeast",
      "currency": "USD",
      "unit": "per_square_foot",
      "newConstruction": {
        "hardCostAvg": 172,
        "planningLow": 170,
        "planningHigh": 290,
        "suggestedMidWithContractorOHProfit": 206
      },
      "locationFactorVsNational195": 1.056,
      "confidence": "medium",
      "notes": "50-state benchmark blended from public state average and published low/high planning range. Excludes land. Verify with local bid data."
    },
    {
      "code": "MD",
      "name": "Maryland",
      "region": "South Atlantic",
      "currency": "USD",
      "unit": "per_square_foot",
      "newConstruction": {
        "hardCostAvg": 165,
        "planningLow": 165,
        "planningHigh": 290,
        "suggestedMidWithContractorOHProfit": 198
      },
      "locationFactorVsNational195": 1.015,
      "confidence": "medium",
      "notes": "50-state benchmark blended from public state average and published low/high planning range. Excludes land. Verify with local bid data."
    },
    {
      "code": "MA",
      "name": "Massachusetts",
      "region": "Northeast",
      "currency": "USD",
      "unit": "per_square_foot",
      "newConstruction": {
        "hardCostAvg": 210,
        "planningLow": 200,
        "planningHigh": 350,
        "suggestedMidWithContractorOHProfit": 252
      },
      "locationFactorVsNational195": 1.292,
      "confidence": "medium",
      "notes": "50-state benchmark blended from public state average and published low/high planning range. Excludes land. Verify with local bid data."
    },
    {
      "code": "MI",
      "name": "Michigan",
      "region": "Midwest",
      "currency": "USD",
      "unit": "per_square_foot",
      "newConstruction": {
        "hardCostAvg": 160,
        "planningLow": 170,
        "planningHigh": 290,
        "suggestedMidWithContractorOHProfit": 192
      },
      "locationFactorVsNational195": 0.985,
      "confidence": "medium",
      "notes": "50-state benchmark blended from public state average and published low/high planning range. Excludes land. Verify with local bid data."
    },
    {
      "code": "MN",
      "name": "Minnesota",
      "region": "Midwest",
      "currency": "USD",
      "unit": "per_square_foot",
      "newConstruction": {
        "hardCostAvg": 178,
        "planningLow": 180,
        "planningHigh": 320,
        "suggestedMidWithContractorOHProfit": 214
      },
      "locationFactorVsNational195": 1.097,
      "confidence": "medium",
      "notes": "50-state benchmark blended from public state average and published low/high planning range. Excludes land. Verify with local bid data."
    },
    {
      "code": "MS",
      "name": "Mississippi",
      "region": "South Central",
      "currency": "USD",
      "unit": "per_square_foot",
      "newConstruction": {
        "hardCostAvg": 154,
        "planningLow": 150,
        "planningHigh": 250,
        "suggestedMidWithContractorOHProfit": 185
      },
      "locationFactorVsNational195": 0.949,
      "confidence": "medium",
      "notes": "50-state benchmark blended from public state average and published low/high planning range. Excludes land. Verify with local bid data."
    },
    {
      "code": "MO",
      "name": "Missouri",
      "region": "Midwest",
      "currency": "USD",
      "unit": "per_square_foot",
      "newConstruction": {
        "hardCostAvg": 160,
        "planningLow": 170,
        "planningHigh": 300,
        "suggestedMidWithContractorOHProfit": 192
      },
      "locationFactorVsNational195": 0.985,
      "confidence": "medium",
      "notes": "50-state benchmark blended from public state average and published low/high planning range. Excludes land. Verify with local bid data."
    },
    {
      "code": "MT",
      "name": "Montana",
      "region": "Mountain West",
      "currency": "USD",
      "unit": "per_square_foot",
      "newConstruction": {
        "hardCostAvg": 162,
        "planningLow": 160,
        "planningHigh": 280,
        "suggestedMidWithContractorOHProfit": 194
      },
      "locationFactorVsNational195": 0.995,
      "confidence": "medium",
      "notes": "50-state benchmark blended from public state average and published low/high planning range. Excludes land. Verify with local bid data."
    },
    {
      "code": "NE",
      "name": "Nebraska",
      "region": "Midwest",
      "currency": "USD",
      "unit": "per_square_foot",
      "newConstruction": {
        "hardCostAvg": 162,
        "planningLow": 160,
        "planningHigh": 280,
        "suggestedMidWithContractorOHProfit": 194
      },
      "locationFactorVsNational195": 0.995,
      "confidence": "medium",
      "notes": "50-state benchmark blended from public state average and published low/high planning range. Excludes land. Verify with local bid data."
    },
    {
      "code": "NV",
      "name": "Nevada",
      "region": "Southwest",
      "currency": "USD",
      "unit": "per_square_foot",
      "newConstruction": {
        "hardCostAvg": 180,
        "planningLow": 180,
        "planningHigh": 315,
        "suggestedMidWithContractorOHProfit": 216
      },
      "locationFactorVsNational195": 1.108,
      "confidence": "medium",
      "notes": "50-state benchmark blended from public state average and published low/high planning range. Excludes land. Verify with local bid data."
    },
    {
      "code": "NH",
      "name": "New Hampshire",
      "region": "Northeast",
      "currency": "USD",
      "unit": "per_square_foot",
      "newConstruction": {
        "hardCostAvg": 173,
        "planningLow": 175,
        "planningHigh": 300,
        "suggestedMidWithContractorOHProfit": 208
      },
      "locationFactorVsNational195": 1.067,
      "confidence": "medium",
      "notes": "50-state benchmark blended from public state average and published low/high planning range. Excludes land. Verify with local bid data."
    },
    {
      "code": "NJ",
      "name": "New Jersey",
      "region": "Northeast",
      "currency": "USD",
      "unit": "per_square_foot",
      "newConstruction": {
        "hardCostAvg": 225,
        "planningLow": 215,
        "planningHigh": 370,
        "suggestedMidWithContractorOHProfit": 270
      },
      "locationFactorVsNational195": 1.385,
      "confidence": "medium",
      "notes": "50-state benchmark blended from public state average and published low/high planning range. Excludes land. Verify with local bid data."
    },
    {
      "code": "NM",
      "name": "New Mexico",
      "region": "Southwest",
      "currency": "USD",
      "unit": "per_square_foot",
      "newConstruction": {
        "hardCostAvg": 160,
        "planningLow": 160,
        "planningHigh": 250,
        "suggestedMidWithContractorOHProfit": 192
      },
      "locationFactorVsNational195": 0.985,
      "confidence": "medium",
      "notes": "50-state benchmark blended from public state average and published low/high planning range. Excludes land. Verify with local bid data."
    },
    {
      "code": "NY",
      "name": "New York",
      "region": "Northeast",
      "currency": "USD",
      "unit": "per_square_foot",
      "newConstruction": {
        "hardCostAvg": 211,
        "planningLow": 200,
        "planningHigh": 350,
        "suggestedMidWithContractorOHProfit": 253
      },
      "locationFactorVsNational195": 1.297,
      "confidence": "medium",
      "notes": "50-state benchmark blended from public state average and published low/high planning range. Excludes land. Verify with local bid data."
    },
    {
      "code": "NC",
      "name": "North Carolina",
      "region": "South Atlantic",
      "currency": "USD",
      "unit": "per_square_foot",
      "newConstruction": {
        "hardCostAvg": 168,
        "planningLow": 180,
        "planningHigh": 300,
        "suggestedMidWithContractorOHProfit": 202
      },
      "locationFactorVsNational195": 1.036,
      "confidence": "medium",
      "notes": "50-state benchmark blended from public state average and published low/high planning range. Excludes land. Verify with local bid data."
    },
    {
      "code": "ND",
      "name": "North Dakota",
      "region": "Midwest",
      "currency": "USD",
      "unit": "per_square_foot",
      "newConstruction": {
        "hardCostAvg": 162,
        "planningLow": 160,
        "planningHigh": 280,
        "suggestedMidWithContractorOHProfit": 194
      },
      "locationFactorVsNational195": 0.995,
      "confidence": "medium",
      "notes": "50-state benchmark blended from public state average and published low/high planning range. Excludes land. Verify with local bid data."
    },
    {
      "code": "OH",
      "name": "Ohio",
      "region": "Midwest",
      "currency": "USD",
      "unit": "per_square_foot",
      "newConstruction": {
        "hardCostAvg": 160,
        "planningLow": 170,
        "planningHigh": 300,
        "suggestedMidWithContractorOHProfit": 192
      },
      "locationFactorVsNational195": 0.985,
      "confidence": "medium",
      "notes": "50-state benchmark blended from public state average and published low/high planning range. Excludes land. Verify with local bid data."
    },
    {
      "code": "OK",
      "name": "Oklahoma",
      "region": "South Central",
      "currency": "USD",
      "unit": "per_square_foot",
      "newConstruction": {
        "hardCostAvg": 158,
        "planningLow": 150,
        "planningHigh": 260,
        "suggestedMidWithContractorOHProfit": 190
      },
      "locationFactorVsNational195": 0.974,
      "confidence": "medium",
      "notes": "50-state benchmark blended from public state average and published low/high planning range. Excludes land. Verify with local bid data."
    },
    {
      "code": "OR",
      "name": "Oregon",
      "region": "West Coast",
      "currency": "USD",
      "unit": "per_square_foot",
      "newConstruction": {
        "hardCostAvg": 188,
        "planningLow": 190,
        "planningHigh": 330,
        "suggestedMidWithContractorOHProfit": 226
      },
      "locationFactorVsNational195": 1.159,
      "confidence": "medium",
      "notes": "50-state benchmark blended from public state average and published low/high planning range. Excludes land. Verify with local bid data."
    },
    {
      "code": "PA",
      "name": "Pennsylvania",
      "region": "Northeast",
      "currency": "USD",
      "unit": "per_square_foot",
      "newConstruction": {
        "hardCostAvg": 185,
        "planningLow": 175,
        "planningHigh": 300,
        "suggestedMidWithContractorOHProfit": 222
      },
      "locationFactorVsNational195": 1.138,
      "confidence": "medium",
      "notes": "50-state benchmark blended from public state average and published low/high planning range. Excludes land. Verify with local bid data."
    },
    {
      "code": "RI",
      "name": "Rhode Island",
      "region": "Northeast",
      "currency": "USD",
      "unit": "per_square_foot",
      "newConstruction": {
        "hardCostAvg": 195,
        "planningLow": 200,
        "planningHigh": 340,
        "suggestedMidWithContractorOHProfit": 234
      },
      "locationFactorVsNational195": 1.2,
      "confidence": "medium",
      "notes": "50-state benchmark blended from public state average and published low/high planning range. Excludes land. Verify with local bid data."
    },
    {
      "code": "SC",
      "name": "South Carolina",
      "region": "South Atlantic",
      "currency": "USD",
      "unit": "per_square_foot",
      "newConstruction": {
        "hardCostAvg": 173,
        "planningLow": 180,
        "planningHigh": 310,
        "suggestedMidWithContractorOHProfit": 208
      },
      "locationFactorVsNational195": 1.067,
      "confidence": "medium",
      "notes": "50-state benchmark blended from public state average and published low/high planning range. Excludes land. Verify with local bid data."
    },
    {
      "code": "SD",
      "name": "South Dakota",
      "region": "Midwest",
      "currency": "USD",
      "unit": "per_square_foot",
      "newConstruction": {
        "hardCostAvg": 162,
        "planningLow": 160,
        "planningHigh": 280,
        "suggestedMidWithContractorOHProfit": 194
      },
      "locationFactorVsNational195": 0.995,
      "confidence": "medium",
      "notes": "50-state benchmark blended from public state average and published low/high planning range. Excludes land. Verify with local bid data."
    },
    {
      "code": "TN",
      "name": "Tennessee",
      "region": "South Central",
      "currency": "USD",
      "unit": "per_square_foot",
      "newConstruction": {
        "hardCostAvg": 158,
        "planningLow": 150,
        "planningHigh": 270,
        "suggestedMidWithContractorOHProfit": 190
      },
      "locationFactorVsNational195": 0.974,
      "confidence": "medium",
      "notes": "50-state benchmark blended from public state average and published low/high planning range. Excludes land. Verify with local bid data."
    },
    {
      "code": "TX",
      "name": "Texas",
      "region": "South Central",
      "currency": "USD",
      "unit": "per_square_foot",
      "newConstruction": {
        "hardCostAvg": 162,
        "planningLow": 150,
        "planningHigh": 270,
        "suggestedMidWithContractorOHProfit": 194
      },
      "locationFactorVsNational195": 0.995,
      "confidence": "medium",
      "notes": "50-state benchmark blended from public state average and published low/high planning range. Excludes land. Verify with local bid data."
    },
    {
      "code": "UT",
      "name": "Utah",
      "region": "Mountain West",
      "currency": "USD",
      "unit": "per_square_foot",
      "newConstruction": {
        "hardCostAvg": 163,
        "planningLow": 160,
        "planningHigh": 270,
        "suggestedMidWithContractorOHProfit": 196
      },
      "locationFactorVsNational195": 1.005,
      "confidence": "medium",
      "notes": "50-state benchmark blended from public state average and published low/high planning range. Excludes land. Verify with local bid data."
    },
    {
      "code": "VT",
      "name": "Vermont",
      "region": "Northeast",
      "currency": "USD",
      "unit": "per_square_foot",
      "newConstruction": {
        "hardCostAvg": 175,
        "planningLow": 180,
        "planningHigh": 310,
        "suggestedMidWithContractorOHProfit": 210
      },
      "locationFactorVsNational195": 1.077,
      "confidence": "medium",
      "notes": "50-state benchmark blended from public state average and published low/high planning range. Excludes land. Verify with local bid data."
    },
    {
      "code": "VA",
      "name": "Virginia",
      "region": "South Atlantic",
      "currency": "USD",
      "unit": "per_square_foot",
      "newConstruction": {
        "hardCostAvg": 173,
        "planningLow": 180,
        "planningHigh": 310,
        "suggestedMidWithContractorOHProfit": 208
      },
      "locationFactorVsNational195": 1.067,
      "confidence": "medium",
      "notes": "50-state benchmark blended from public state average and published low/high planning range. Excludes land. Verify with local bid data."
    },
    {
      "code": "WA",
      "name": "Washington",
      "region": "West Coast",
      "currency": "USD",
      "unit": "per_square_foot",
      "newConstruction": {
        "hardCostAvg": 193,
        "planningLow": 185,
        "planningHigh": 320,
        "suggestedMidWithContractorOHProfit": 232
      },
      "locationFactorVsNational195": 1.19,
      "confidence": "medium",
      "notes": "50-state benchmark blended from public state average and published low/high planning range. Excludes land. Verify with local bid data."
    },
    {
      "code": "WV",
      "name": "West Virginia",
      "region": "South Central",
      "currency": "USD",
      "unit": "per_square_foot",
      "newConstruction": {
        "hardCostAvg": 157,
        "planningLow": 170,
        "planningHigh": 260,
        "suggestedMidWithContractorOHProfit": 188
      },
      "locationFactorVsNational195": 0.964,
      "confidence": "medium",
      "notes": "50-state benchmark blended from public state average and published low/high planning range. Excludes land. Verify with local bid data."
    },
    {
      "code": "WI",
      "name": "Wisconsin",
      "region": "Midwest",
      "currency": "USD",
      "unit": "per_square_foot",
      "newConstruction": {
        "hardCostAvg": 175,
        "planningLow": 180,
        "planningHigh": 310,
        "suggestedMidWithContractorOHProfit": 210
      },
      "locationFactorVsNational195": 1.077,
      "confidence": "medium",
      "notes": "50-state benchmark blended from public state average and published low/high planning range. Excludes land. Verify with local bid data."
    },
    {
      "code": "WY",
      "name": "Wyoming",
      "region": "Mountain West",
      "currency": "USD",
      "unit": "per_square_foot",
      "newConstruction": {
        "hardCostAvg": 162,
        "planningLow": 160,
        "planningHigh": 270,
        "suggestedMidWithContractorOHProfit": 194
      },
      "locationFactorVsNational195": 0.995,
      "confidence": "medium",
      "notes": "50-state benchmark blended from public state average and published low/high planning range. Excludes land. Verify with local bid data."
    },
    {
      "code": "DC",
      "name": "District of Columbia",
      "region": "District",
      "currency": "USD",
      "unit": "per_square_foot",
      "newConstruction": {
        "hardCostAvg": 200,
        "planningLow": 125,
        "planningHigh": 650,
        "suggestedMidWithContractorOHProfit": 240
      },
      "locationFactorVsNational195": 1.231,
      "confidence": "medium",
      "notes": "Public custom-home range; wide because urban infill and luxury work distort averages."
    },
    {
      "code": "PR",
      "name": "Puerto Rico",
      "region": "U.S. Territory - Caribbean",
      "currency": "USD",
      "unit": "per_square_foot",
      "newConstruction": {
        "hardCostAvg": 200,
        "planningLow": 140,
        "planningHigh": 300,
        "suggestedMidWithContractorOHProfit": 240
      },
      "locationFactorVsNational195": 1.231,
      "confidence": "low",
      "notes": "Sparse public data; use as a starting benchmark only and verify locally."
    },
    {
      "code": "GU",
      "name": "Guam",
      "region": "U.S. Territory - Pacific",
      "currency": "USD",
      "unit": "per_square_foot",
      "newConstruction": {
        "hardCostAvg": 245,
        "planningLow": 195,
        "planningHigh": 350,
        "suggestedMidWithContractorOHProfit": 294
      },
      "locationFactorVsNational195": 1.508,
      "confidence": "medium",
      "notes": "Guam sources show recent construction ranges around $195-$295/SF and broader $180-$400/SF depending on design/location."
    },
    {
      "code": "VI",
      "name": "U.S. Virgin Islands",
      "region": "U.S. Territory - Caribbean",
      "currency": "USD",
      "unit": "per_square_foot",
      "newConstruction": {
        "hardCostAvg": 500,
        "planningLow": 350,
        "planningHigh": 700,
        "suggestedMidWithContractorOHProfit": 600
      },
      "locationFactorVsNational195": 3.077,
      "confidence": "medium",
      "notes": "Island market; public sources cite roughly $300-$500/SF for public housing constraints and $400-$700+/SF for custom homes."
    },
    {
      "code": "AS",
      "name": "American Samoa",
      "region": "U.S. Territory - Pacific",
      "currency": "USD",
      "unit": "per_square_foot",
      "newConstruction": {
        "hardCostAvg": 280,
        "planningLow": 220,
        "planningHigh": 380,
        "suggestedMidWithContractorOHProfit": 336
      },
      "locationFactorVsNational195": 1.723,
      "confidence": "very_low",
      "notes": "No strong public residential SF benchmark found; modeled from remote Pacific logistics. Must verify locally."
    },
    {
      "code": "MP",
      "name": "Northern Mariana Islands",
      "region": "U.S. Territory - Pacific",
      "currency": "USD",
      "unit": "per_square_foot",
      "newConstruction": {
        "hardCostAvg": 275,
        "planningLow": 220,
        "planningHigh": 360,
        "suggestedMidWithContractorOHProfit": 330
      },
      "locationFactorVsNational195": 1.692,
      "confidence": "very_low",
      "notes": "Sparse public data; modeled from Guam/Hawaii/CNMI anecdotal market data. Must verify locally."
    }
  ],
  "calculationFormula": "adjustedSfRate = location.suggestedMidWithContractorOHProfit * projectTypeFactor * finishFactor * complexityFactor * siteConditionFactor"
} as const;

export type SquareFootPricingDataset = typeof squareFootPricingData;
export type SquareFootPricingLocation = SquareFootPricingDataset['locations'][number];
export type SquareFootPricingProjectTypeKey = keyof SquareFootPricingDataset['projectTypeMultipliers'];
export type SquareFootPricingFinishKey = keyof SquareFootPricingDataset['finishMultipliers'];
export type SquareFootPricingComplexityKey = keyof SquareFootPricingDataset['complexityMultipliers'];
export type SquareFootPricingSiteConditionKey = keyof SquareFootPricingDataset['siteConditionMultipliers'];

export const SQUARE_FOOT_PRICING_NATIONAL_BASELINE = 195;

export const SQUARE_FOOT_PRICING_TERRITORY_CODES = new Set(['GU', 'VI', 'PR', 'AS', 'MP']);
