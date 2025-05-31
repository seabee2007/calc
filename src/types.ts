import { LengthUnit, VolumeUnit } from './types';

// Project types
export interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  calculations: Calculation[];
  wasteFactor?: number;
  pourDate?: string;
}

export interface Calculation {
  id: string;
  type: 'slab' | 'footer' | 'column' | 'sidewalk' | 'thickened_edge_slab';
  dimensions: Record<string, number>;
  result: {
    volume: number; // cubic yards
    bags: number; // 80lb bags
    recommendations: string[];
  };
  weather?: Weather;
  createdAt: string;
  mixDesign?: ConcreteMixDesign;
}

// Weather related types
export interface Weather {
  temperature: number;
  humidity: number;
  conditions: string;
  windSpeed: number;
  precipitation: number;
  location: {
    city: string;
    country: string;
  };
  forecast: ForecastDay[];
}

export interface ForecastDay {
  date: string;
  maxTemp: number;
  minTemp: number;
  avgTemp: number;
  maxWindSpeed: number;
  chanceOfRain: number;
  totalPrecipitation: number;
  conditions: string;
}

// Units
export type Unit = 'imperial' | 'metric';
export type LengthUnit = 'feet' | 'inches' | 'meters' | 'centimeters';
export type VolumeUnit = 'cubic_yards' | 'cubic_feet' | 'cubic_meters';

// User preferences
export interface UserPreferences {
  units: Unit;
  lengthUnit: LengthUnit;
  volumeUnit: VolumeUnit;
}

// Concrete Mix Design types
export interface ConcreteMixDesign {
  psi: number;
  ratio: {
    cement: number;
    sand: number;
    aggregate: number;
  };
  waterCementRatio: number;
  slump: {
    min: number;
    max: number;
  };
  materials: {
    cement: number; // in lbs
    sand: number; // in lbs
    aggregate: number; // in lbs
    water: number; // in gallons
  };
}

export const CONCRETE_MIX_DESIGNS: Record<string, Omit<ConcreteMixDesign, 'materials'>> = {
  '2500': {
    psi: 2500,
    ratio: { cement: 1, sand: 3, aggregate: 6 },
    waterCementRatio: 0.60,
    slump: { min: 2, max: 3 }
  },
  '3000': {
    psi: 3000,
    ratio: { cement: 1, sand: 2, aggregate: 4 },
    waterCementRatio: 0.55,
    slump: { min: 3, max: 4 }
  },
  '4000': {
    psi: 4000,
    ratio: { cement: 1, sand: 1.75, aggregate: 3.5 },
    waterCementRatio: 0.50,
    slump: { min: 3, max: 4 }
  },
  '5000': {
    psi: 5000,
    ratio: { cement: 1, sand: 1.5, aggregate: 3 },
    waterCementRatio: 0.45,
    slump: { min: 2, max: 3 }
  }
};

// Concrete pricing types
export interface ConcretePricing {
  basePrice: number; // Price per cubic yard for standard 3000 PSI
  psiPriceAdjustments: Record<string, number>; // Additional cost per cubic yard for different PSI
  deliveryFees: {
    baseDeliveryFee: number; // Base delivery fee
    minimumOrder: number; // Minimum order in cubic yards
    smallLoadFee: number; // Additional fee for orders below minimum
    distanceFee: number; // Per mile fee for delivery beyond base distance
    baseDistance: number; // Base distance included in delivery (miles)
  };
  additionalServices: {
    pumpTruckFees: Record<string, number>; // Location-based pump truck fees
    saturdayDeliveryFee: number; // Additional fee for Saturday delivery
    afterHoursFee: number; // Additional fee for after-hours delivery
  };
}

// Location-specific pricing data
export interface LocationPricing {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  pricing: ConcretePricing;
}

export const LOCATION_PRICING: LocationPricing[] = [
  {
    id: "portland",
    name: "Portland Ready Mix",
    address: "123 Industrial Way, Portland, OR",
    latitude: 45.5155,
    longitude: -122.6789,
    pricing: {
      basePrice: 125.00,
      psiPriceAdjustments: {
        '2500': -10.00,
        '3000': 0.00,
        '4000': 15.00,
        '5000': 30.00
      },
      deliveryFees: {
        baseDeliveryFee: 150.00,
        minimumOrder: 5,
        smallLoadFee: 75.00,
        distanceFee: 3.50,
        baseDistance: 15
      },
      additionalServices: {
        pumpTruckFees: {
          "portland": 1200.00,
          "vancouver": 1500.00,
          "salem": 1800.00
        },
        saturdayDeliveryFee: 100.00,
        afterHoursFee: 150.00
      }
    }
  },
  {
    id: "seattle",
    name: "Seattle Concrete Supply",
    address: "456 Commerce St, Seattle, WA",
    latitude: 47.6062,
    longitude: -122.3321,
    pricing: {
      basePrice: 130.00,
      psiPriceAdjustments: {
        '2500': -10.00,
        '3000': 0.00,
        '4000': 18.00,
        '5000': 35.00
      },
      deliveryFees: {
        baseDeliveryFee: 175.00,
        minimumOrder: 5,
        smallLoadFee: 85.00,
        distanceFee: 4.00,
        baseDistance: 12
      },
      additionalServices: {
        pumpTruckFees: {
          "seattle": 1400.00,
          "bellevue": 1600.00,
          "tacoma": 1900.00
        },
        saturdayDeliveryFee: 125.00,
        afterHoursFee: 175.00
      }
    }
  },
  {
    id: "guam",
    name: "Guam Concrete Supply",
    address: "789 Marine Corps Dr, Tamuning, GU",
    latitude: 13.4443,
    longitude: 144.7937,
    pricing: {
      basePrice: 190.00,
      psiPriceAdjustments: {
        '2500': -15.00,
        '3000': 0.00,
        '4000': 25.00,
        '5000': 45.00
      },
      deliveryFees: {
        baseDeliveryFee: 200.00,
        minimumOrder: 5,
        smallLoadFee: 95.00,
        distanceFee: 5.00,
        baseDistance: 10
      },
      additionalServices: {
        pumpTruckFees: {
          "tamuning": 1200.00,
          "dededo": 1400.00,
          "yigo": 1600.00
        },
        saturdayDeliveryFee: 150.00,
        afterHoursFee: 200.00
      }
    }
  },
  {
    id: "alabama",
    name: "Alabama Ready Mix",
    address: "Montgomery, AL",
    latitude: 32.3770,
    longitude: -86.3000,
    pricing: {
      basePrice: 135.00,
      psiPriceAdjustments: { '2500': -10, '3000': 0, '4000': 15, '5000': 30 },
      deliveryFees: { baseDeliveryFee: 150, minimumOrder: 5, smallLoadFee: 75, distanceFee: 3.5, baseDistance: 15 },
      additionalServices: { pumpTruckFees: { alabama: 800 }, saturdayDeliveryFee: 100, afterHoursFee: 150 }
    }
  },
  {
    id: "alaska",
    name: "Alaska Ready Mix",
    address: "Juneau, AK",
    latitude: 58.3019,
    longitude: -134.4197,
    pricing: {
      basePrice: 168.00,
      psiPriceAdjustments: { '2500': -10, '3000': 0, '4000': 15, '5000': 30 },
      deliveryFees: { baseDeliveryFee: 200, minimumOrder: 5, smallLoadFee: 100, distanceFee: 4, baseDistance: 15 },
      additionalServices: { pumpTruckFees: { alaska: 1200 }, saturdayDeliveryFee: 150, afterHoursFee: 200 }
    }
  },
  {
    id: "arizona",
    name: "Arizona Ready Mix",
    address: "Phoenix, AZ",
    latitude: 33.4484,
    longitude: -112.0740,
    pricing: {
      basePrice: 135.00,
      psiPriceAdjustments: { '2500': -10, '3000': 0, '4000': 15, '5000': 30 },
      deliveryFees: { baseDeliveryFee: 150, minimumOrder: 5, smallLoadFee: 75, distanceFee: 3.5, baseDistance: 15 },
      additionalServices: { pumpTruckFees: { arizona: 1000 }, saturdayDeliveryFee: 100, afterHoursFee: 150 }
    }
  },
  {
    id: "arkansas",
    name: "Arkansas Ready Mix",
    address: "Little Rock, AR",
    latitude: 34.7465,
    longitude: -92.2896,
    pricing: {
      basePrice: 140.00,
      psiPriceAdjustments: { '2500': -10, '3000': 0, '4000': 15, '5000': 30 },
      deliveryFees: { baseDeliveryFee: 150, minimumOrder: 5, smallLoadFee: 75, distanceFee: 3.5, baseDistance: 15 },
      additionalServices: { pumpTruckFees: { arkansas: 800 }, saturdayDeliveryFee: 100, afterHoursFee: 150 }
    }
  },
  {
    id: "california",
    name: "California Ready Mix",
    address: "Sacramento, CA",
    latitude: 38.5816,
    longitude: -121.4944,
    pricing: {
      basePrice: 176.00,
      psiPriceAdjustments: { '2500': -10, '3000': 0, '4000': 15, '5000': 30 },
      deliveryFees: { baseDeliveryFee: 150, minimumOrder: 5, smallLoadFee: 75, distanceFee: 3.5, baseDistance: 15 },
      additionalServices: { pumpTruckFees: { california: 1000 }, saturdayDeliveryFee: 100, afterHoursFee: 150 }
    }
  },
  {
    id: "colorado",
    name: "Colorado Ready Mix",
    address: "Denver, CO",
    latitude: 39.7392,
    longitude: -104.9903,
    pricing: {
      basePrice: 156.00,
      psiPriceAdjustments: { '2500': -10, '3000': 0, '4000': 15, '5000': 30 },
      deliveryFees: { baseDeliveryFee: 150, minimumOrder: 5, smallLoadFee: 75, distanceFee: 3.5, baseDistance: 15 },
      additionalServices: { pumpTruckFees: { colorado: 1200 }, saturdayDeliveryFee: 100, afterHoursFee: 150 }
    }
  },
  {
    id: "connecticut",
    name: "Connecticut Ready Mix",
    address: "Hartford, CT",
    latitude: 41.7658,
    longitude: -72.6734,
    pricing: {
      basePrice: 165.00,
      psiPriceAdjustments: { '2500': -10, '3000': 0, '4000': 15, '5000': 30 },
      deliveryFees: { baseDeliveryFee: 150, minimumOrder: 5, smallLoadFee: 75, distanceFee: 3.5, baseDistance: 15 },
      additionalServices: { pumpTruckFees: { connecticut: 1200 }, saturdayDeliveryFee: 100, afterHoursFee: 150 }
    }
  },
  {
    id: "delaware",
    name: "Delaware Ready Mix",
    address: "Dover, DE",
    latitude: 39.1582,
    longitude: -75.5244,
    pricing: {
      basePrice: 150.00,
      psiPriceAdjustments: { '2500': -10, '3000': 0, '4000': 15, '5000': 30 },
      deliveryFees: { baseDeliveryFee: 150, minimumOrder: 5, smallLoadFee: 75, distanceFee: 3.5, baseDistance: 15 },
      additionalServices: { pumpTruckFees: { delaware: 1000 }, saturdayDeliveryFee: 100, afterHoursFee: 150 }
    }
  },
  {
    id: "florida",
    name: "Florida Ready Mix",
    address: "Tallahassee, FL",
    latitude: 30.4383,
    longitude: -84.2807,
    pricing: {
      basePrice: 155.00,
      psiPriceAdjustments: { '2500': -10, '3000': 0, '4000': 15, '5000': 30 },
      deliveryFees: { baseDeliveryFee: 150, minimumOrder: 5, smallLoadFee: 75, distanceFee: 3.5, baseDistance: 15 },
      additionalServices: { pumpTruckFees: { florida: 1000 }, saturdayDeliveryFee: 100, afterHoursFee: 150 }
    }
  },
  {
    id: "georgia",
    name: "Georgia Ready Mix",
    address: "Atlanta, GA",
    latitude: 33.7490,
    longitude: -84.3880,
    pricing: {
      basePrice: 148.00,
      psiPriceAdjustments: { '2500': -10, '3000': 0, '4000': 15, '5000': 30 },
      deliveryFees: { baseDeliveryFee: 150, minimumOrder: 5, smallLoadFee: 75, distanceFee: 3.5, baseDistance: 15 },
      additionalServices: { pumpTruckFees: { georgia: 800 }, saturdayDeliveryFee: 100, afterHoursFee: 150 }
    }
  },
  {
    id: "hawaii",
    name: "Hawaii Ready Mix",
    address: "Honolulu, HI",
    latitude: 21.3069,
    longitude: -157.8583,
    pricing: {
      basePrice: 187.00,
      psiPriceAdjustments: { '2500': -10, '3000': 0, '4000': 20, '5000': 40 },
      deliveryFees: { baseDeliveryFee: 200, minimumOrder: 5, smallLoadFee: 95, distanceFee: 5, baseDistance: 10 },
      additionalServices: { pumpTruckFees: { hawaii: 1200 }, saturdayDeliveryFee: 150, afterHoursFee: 200 }
    }
  },
  {
    id: "idaho",
    name: "Idaho Ready Mix",
    address: "Boise, ID",
    latitude: 43.6150,
    longitude: -116.2023,
    pricing: {
      basePrice: 130.00,
      psiPriceAdjustments: { '2500': -10, '3000': 0, '4000': 15, '5000': 30 },
      deliveryFees: { baseDeliveryFee: 150, minimumOrder: 5, smallLoadFee: 75, distanceFee: 3.5, baseDistance: 15 },
      additionalServices: { pumpTruckFees: { idaho: 1000 }, saturdayDeliveryFee: 100, afterHoursFee: 150 }
    }
  },
  {
    id: "illinois",
    name: "Illinois Ready Mix",
    address: "Springfield, IL",
    latitude: 39.7817,
    longitude: -89.6501,
    pricing: {
      basePrice: 180.00,
      psiPriceAdjustments: { '2500': -10, '3000': 0, '4000': 15, '5000': 30 },
      deliveryFees: { baseDeliveryFee: 150, minimumOrder: 5, smallLoadFee: 75, distanceFee: 3.5, baseDistance: 15 },
      additionalServices: { pumpTruckFees: { illinois: 1200 }, saturdayDeliveryFee: 100, afterHoursFee: 150 }
    }
  },
  {
    id: "indiana",
    name: "Indiana Ready Mix",
    address: "Indianapolis, IN",
    latitude: 39.7684,
    longitude: -86.1581,
    pricing: {
      basePrice: 150.00,
      psiPriceAdjustments: { '2500': -10, '3000': 0, '4000': 15, '5000': 30 },
      deliveryFees: { baseDeliveryFee: 150, minimumOrder: 5, smallLoadFee: 75, distanceFee: 3.5, baseDistance: 15 },
      additionalServices: { pumpTruckFees: { indiana: 1000 }, saturdayDeliveryFee: 100, afterHoursFee: 150 }
    }
  },
  {
    id: "iowa",
    name: "Iowa Ready Mix",
    address: "Des Moines, IA",
    latitude: 41.5868,
    longitude: -93.6250,
    pricing: {
      basePrice: 130.00,
      psiPriceAdjustments: { '2500': -10, '3000': 0, '4000': 15, '5000': 30 },
      deliveryFees: { baseDeliveryFee: 150, minimumOrder: 5, smallLoadFee: 75, distanceFee: 3.5, baseDistance: 15 },
      additionalServices: { pumpTruckFees: { iowa: 800 }, saturdayDeliveryFee: 100, afterHoursFee: 150 }
    }
  },
  {
    id: "tokyo",
    name: "Tokyo Concrete Co.",
    address: "1-1 Marunouchi, Chiyoda-ku, Tokyo",
    latitude: 35.6762,
    longitude: 139.6503,
    pricing: {
      basePrice: 104.00,
      psiPriceAdjustments: { '2500': -8.00, '3000': 0.00, '4000': 12.00, '5000': 25.00 },
      deliveryFees: { baseDeliveryFee: 180.00, minimumOrder: 4, smallLoadFee: 90.00, distanceFee: 4.50, baseDistance: 10 },
      additionalServices: {
        pumpTruckFees: {
          tokyo: 1600.00,
          yokohama: 1800.00,
          chiba: 1900.00
        },
        saturdayDeliveryFee: 160.00,
        afterHoursFee: 220.00
      }
    }
  },
  {
    id: "osaka",
    name: "Osaka Concrete Supply",
    address: "1-1 Umeda, Kita-ku, Osaka",
    latitude: 34.6937,
    longitude: 135.5023,
    pricing: {
      basePrice: 139.00,
      psiPriceAdjustments: { '2500': -8.00, '3000': 0.00, '4000': 12.00, '5000': 25.00 },
      deliveryFees: { baseDeliveryFee: 180.00, minimumOrder: 4, smallLoadFee: 90.00, distanceFee: 4.50, baseDistance: 10 },
      additionalServices: {
        pumpTruckFees: {
          osaka: 1600.00,
          kobe: 1800.00,
          kyoto: 1900.00
        },
        saturdayDeliveryFee: 160.00,
        afterHoursFee: 220.00
      }
    }
  },
  {
    id: "hokkaido",
    name: "Hokkaidō Concrete Co.",
    address: "Sapporo, Hokkaidō",
    latitude: 43.0621,
    longitude: 141.3544,
    pricing: {
      basePrice: 146.00,
      psiPriceAdjustments: { '2500': -8.00, '3000': 0.00, '4000': 12.00, '5000': 25.00 },
      deliveryFees: { baseDeliveryFee: 180.00, minimumOrder: 4, smallLoadFee: 90.00, distanceFee: 4.50, baseDistance: 10 },
      additionalServices: {
        pumpTruckFees: {
          sapporo: 1700.00,
          asahikawa: 1800.00,
          hakodate: 1900.00
        },
        saturdayDeliveryFee: 160.00,
        afterHoursFee: 220.00
      }
    }
  },
  {
    id: "metro_manila",
    name: "Metro Manila Ready Mix",
    address: "EDSA Corner Makati Ave, Makati City, Metro Manila",
    latitude: 14.5547,
    longitude: 121.0244,
    pricing: {
      basePrice: 68.00,
      psiPriceAdjustments: { '2500': -5.00, '3000': 0.00, '4000': 8.00, '5000': 15.00 },
      deliveryFees: { baseDeliveryFee: 100.00, minimumOrder: 4, smallLoadFee: 50.00, distanceFee: 3.00, baseDistance: 10 },
      additionalServices: {
        pumpTruckFees: {
          makati: 800.00,
          quezon_city: 900.00,
          taguig: 850.00
        },
        saturdayDeliveryFee: 70.00,
        afterHoursFee: 100.00
      }
    }
  },
  {
    id: "luzon",
    name: "Luzon (Outside NCR) Ready Mix",
    address: "Provincial Plant, Laguna",
    latitude: 14.1159,
    longitude: 121.0206,
    pricing: {
      basePrice: 66.00,
      psiPriceAdjustments: { '2500': -5.00, '3000': 0.00, '4000': 8.00, '5000': 15.00 },
      deliveryFees: { baseDeliveryFee: 100.00, minimumOrder: 4, smallLoadFee: 50.00, distanceFee: 3.00, baseDistance: 10 },
      additionalServices: {
        pumpTruckFees: {
          laguna: 850.00,
          rizal: 900.00,
          cavite: 950.00
        },
        saturdayDeliveryFee: 70.00,
        afterHoursFee: 100.00
      }
    }
  },
  {
    id: "visayas",
    name: "Visayas Ready Mix",
    address: "Cebu City Supply Depot, Cebu",
    latitude: 10.3157,
    longitude: 123.8854,
    pricing: {
      basePrice: 70.00,
      psiPriceAdjustments: { '2500': -5.00, '3000': 0.00, '4000': 8.00, '5000': 15.00 },
      deliveryFees: { baseDeliveryFee: 120.00, minimumOrder: 4, smallLoadFee: 60.00, distanceFee: 3.00, baseDistance: 10 },
      additionalServices: {
        pumpTruckFees: {
          cebu: 900.00,
          iloilo: 950.00,
          bacolod: 1000.00
        },
        saturdayDeliveryFee: 80.00,
        afterHoursFee: 110.00
      }
    }
  },
  {
    id: "mindanao",
    name: "Mindanao Ready Mix",
    address: "Davao City Plant, Davao del Sur",
    latitude: 7.1907,
    longitude: 125.4553,
    pricing: {
      basePrice: 74.00,
      psiPriceAdjustments: { '2500': -5.00, '3000': 0.00, '4000': 8.00, '5000': 15.00 },
      deliveryFees: { baseDeliveryFee: 120.00, minimumOrder: 4, smallLoadFee: 60.00, distanceFee: 3.00, baseDistance: 10 },
      additionalServices: {
        pumpTruckFees: {
          davao: 950.00,
          cagayan_de_oro: 1000.00,
          zamboanga: 1050.00
        },
        saturdayDeliveryFee: 80.00,
        afterHoursFee: 110.00
      }
    }
  },
  {
    id: "seoul",
    name: "Seoul Concrete Supply",
    address: "123 Gangnam-daero, Gangnam-gu, Seoul",
    latitude: 37.5665,
    longitude: 126.9780,
    pricing: {
      basePrice: 54.00,
      psiPriceAdjustments: { '2500': -5.00, '3000': 0.00, '4000': 8.00, '5000': 15.00 },
      deliveryFees: { baseDeliveryFee: 150.00, minimumOrder: 4, smallLoadFee: 75.00, distanceFee: 3.50, baseDistance: 12 },
      additionalServices: {
        pumpTruckFees: {
          seoul: 690.00,
          incheon: 810.00,
          suwon: 870.00
        },
        saturdayDeliveryFee: 100.00,
        afterHoursFee: 150.00
      }
    }
  },
  {
    id: "busan",
    name: "Busan Concrete Supply",
    address: "456 Haeundaehaebyeon-ro, Haeundae-gu, Busan",
    latitude: 35.1796,
    longitude: 129.0756,
    pricing: {
      basePrice: 59.00,
      psiPriceAdjustments: { '2500': -5.00, '3000': 0.00, '4000': 8.00, '5000': 15.00 },
      deliveryFees: { baseDeliveryFee: 150.00, minimumOrder: 4, smallLoadFee: 75.00, distanceFee: 3.50, baseDistance: 12 },
      additionalServices: {
        pumpTruckFees: {
          busan: 1080.00,
          gyeongju: 900.00,
          ulsan: 1020.00
        },
        saturdayDeliveryFee: 100.00,
        afterHoursFee: 150.00
      }
    }
  },
  {
    id: "bangkok",
    name: "Bangkok Concrete Co.",
    address: "123 Sukhumvit Road, Khlong Toei, Bangkok",
    latitude: 13.7563,
    longitude: 100.5018,
    pricing: {
      basePrice: 51.00,
      psiPriceAdjustments: { '2500': -5.00, '3000': 0.00, '4000': 8.00, '5000': 15.00 },
      deliveryFees: { baseDeliveryFee: 120.00, minimumOrder: 4, smallLoadFee: 60.00, distanceFee: 3.00, baseDistance: 10 },
      additionalServices: {
        pumpTruckFees: {
          bangkok: 900.00,
          nonthaburi: 1000.00,
          pathum_thani: 1100.00
        },
        saturdayDeliveryFee: 80.00,
        afterHoursFee: 120.00
      }
    }
  },
  {
    id: "phuket",
    name: "Phuket Concrete Supply",
    address: "456 Patong Beach Road, Kathu, Phuket",
    latitude: 7.8969,
    longitude: 98.3883,
    pricing: {
      basePrice: 55.00,
      psiPriceAdjustments: { '2500': -5.00, '3000': 0.00, '4000': 8.00, '5000': 15.00 },
      deliveryFees: { baseDeliveryFee: 140.00, minimumOrder: 4, smallLoadFee: 70.00, distanceFee: 4.00, baseDistance: 10  },
      additionalServices: {
        pumpTruckFees: {
          phuket: 1200.00,
          phuket_town: 1250.00,
          patong: 1300.00
        },
        saturdayDeliveryFee: 90.00,
        afterHoursFee: 130.00
      }
    }
  }
];