/**
 * Curated core MasterFormat 2018 reference subset for app use.
 * Do not manually paste the full PDF into this file.
 * Expand by adding validated sections as the app supports more trades.
 */

import type { CsiDivision, CsiMasterFormatData, CsiSection, CsiSubgroup } from './csiTypes';

const RESERVED_DIVISIONS = new Set([
  15, 16, 17, 18, 19, 20, 24, 29, 30, 36, 37, 38, 39, 47, 49,
]);

const DIVISION_TITLES: Record<number, string> = {
  0: 'Procurement and Contracting Requirements',
  1: 'General Requirements',
  2: 'Existing Conditions',
  3: 'Concrete',
  4: 'Masonry',
  5: 'Metals',
  6: 'Wood, Plastics, and Composites',
  7: 'Thermal and Moisture Protection',
  8: 'Openings',
  9: 'Finishes',
  10: 'Specialties',
  11: 'Equipment',
  12: 'Furnishings',
  13: 'Special Construction',
  14: 'Conveying Equipment',
  15: 'Reserved for Future Expansion',
  16: 'Reserved for Future Expansion',
  17: 'Reserved for Future Expansion',
  18: 'Reserved for Future Expansion',
  19: 'Reserved for Future Expansion',
  20: 'Reserved for Future Expansion',
  21: 'Fire Suppression',
  22: 'Plumbing',
  23: 'Heating, Ventilating, and Air Conditioning',
  24: 'Reserved for Future Expansion',
  25: 'Integrated Automation',
  26: 'Electrical',
  27: 'Communications',
  28: 'Electronic Safety and Security',
  29: 'Reserved for Future Expansion',
  30: 'Reserved for Future Expansion',
  31: 'Earthwork',
  32: 'Exterior Improvements',
  33: 'Utilities',
  34: 'Transportation',
  35: 'Waterway and Marine Construction',
  36: 'Reserved for Future Expansion',
  37: 'Reserved for Future Expansion',
  38: 'Reserved for Future Expansion',
  39: 'Reserved for Future Expansion',
  40: 'Process Interconnections',
  41: 'Material Processing and Handling Equipment',
  42: 'Process Heating, Cooling, and Drying Equipment',
  43: 'Process Gas and Liquid Handling, Purification, and Storage Equipment',
  44: 'Pollution and Waste Control Equipment',
  45: 'Industry-Specific Manufacturing Equipment',
  46: 'Water and Wastewater Equipment',
  47: 'Reserved for Future Expansion',
  48: 'Electrical Power Generation',
  49: 'Reserved for Future Expansion',
};

function subgroupForDivisionNumber(divisionNumber: number): CsiSubgroup | undefined {
  if (divisionNumber === 0) return undefined;
  if (divisionNumber === 1) return 'General Requirements Subgroup';
  if (divisionNumber >= 2 && divisionNumber <= 19) return 'Facility Construction Subgroup';
  if (divisionNumber >= 20 && divisionNumber <= 29) return 'Facility Services Subgroup';
  if (divisionNumber >= 30 && divisionNumber <= 39) return 'Site and Infrastructure Subgroup';
  if (divisionNumber >= 40 && divisionNumber <= 49) return 'Process Equipment Subgroup';
  return undefined;
}

function buildDivision(divisionNumber: number): CsiDivision {
  const divisionCode = divisionNumber.toString().padStart(2, '0');
  const reserved = RESERVED_DIVISIONS.has(divisionNumber);
  return {
    divisionCode,
    divisionNumber,
    title: DIVISION_TITLES[divisionNumber] ?? 'Unknown Division',
    group:
      divisionNumber === 0
        ? 'Procurement and Contracting Requirements Group'
        : 'Specifications Group',
    subgroup: subgroupForDivisionNumber(divisionNumber),
    reserved,
  };
}

function section(
  sectionCode: string,
  title: string,
  options: Partial<Omit<CsiSection, 'sectionCode' | 'title' | 'divisionCode' | 'level'>> & {
    level?: CsiSection['level'];
  } = {},
): CsiSection {
  const divisionCode = sectionCode.slice(0, 2);
  const parts = sectionCode.split(' ');
  let level: CsiSection['level'] = options.level ?? 2;
  if (!options.level) {
    if (sectionCode.includes('.')) {
      level = 3;
    } else if (parts.length >= 3 && parts[2] !== '00') {
      level = 3;
    } else if (parts.length >= 2 && parts[1] !== '00') {
      level = 2;
    }
  }

  return {
    sectionCode,
    divisionCode,
    title,
    level,
    explanation: options.explanation,
    reserved: options.reserved,
    alternateTerms: options.alternateTerms,
    seeAlso: options.seeAlso,
  };
}

const DIVISIONS: CsiDivision[] = Array.from({ length: 50 }, (_, index) => buildDivision(index));

const SECTIONS: CsiSection[] = [
  section('00 00 00', 'Procurement and Contracting Requirements'),

  section('01 00 00', 'General Requirements'),
  section('01 10 00', 'Summary'),
  section('01 31 00', 'Project Management and Coordination'),
  section('01 32 00', 'Construction Progress Documentation'),
  section('01 33 00', 'Submittal Procedures'),
  section('01 40 00', 'Quality Requirements'),
  section('01 42 00', 'References'),
  section('01 45 00', 'Quality Control'),
  section('01 50 00', 'Temporary Facilities and Controls'),
  section('01 71 13', 'Mobilization'),
  section('01 74 23', 'Final Cleaning'),
  section('01 77 00', 'Closeout Procedures'),
  section('01 78 00', 'Closeout Submittals'),

  section('02 00 00', 'Existing Conditions'),
  section('02 20 00', 'Assessment'),
  section('02 21 00', 'Surveys'),
  section('02 22 00', 'Existing Conditions Assessment'),
  section('02 40 00', 'Demolition and Structure Moving'),
  section('02 41 00', 'Demolition'),
  section('02 41 13', 'Selective Site Demolition'),
  section('02 41 19', 'Selective Demolition'),

  section('03 00 00', 'Concrete'),
  section('03 10 00', 'Concrete Forming and Accessories'),
  section('03 20 00', 'Concrete Reinforcing'),
  section('03 30 00', 'Cast-in-Place Concrete'),
  section('03 35 00', 'Concrete Finishing'),
  section('03 39 00', 'Concrete Curing'),

  section('04 00 00', 'Masonry'),
  section('04 20 00', 'Unit Masonry'),
  section('04 21 00', 'Clay Unit Masonry'),
  section('04 22 00', 'Concrete Unit Masonry'),

  section('05 00 00', 'Metals'),
  section('05 10 00', 'Structural Metal Framing'),
  section('05 50 00', 'Metal Fabrications'),

  section('06 00 00', 'Wood, Plastics, and Composites'),
  section('06 10 00', 'Rough Carpentry'),
  section('06 16 00', 'Sheathing'),
  section('06 20 00', 'Finish Carpentry'),
  section('06 40 00', 'Architectural Woodwork'),

  section('07 00 00', 'Thermal and Moisture Protection'),
  section('07 10 00', 'Dampproofing and Waterproofing'),
  section('07 20 00', 'Thermal Protection'),
  section('07 25 00', 'Weather Barriers'),
  section('07 30 00', 'Steep Slope Roofing'),
  section('07 60 00', 'Flashing and Sheet Metal'),
  section('07 90 00', 'Joint Protection'),

  section('08 00 00', 'Openings'),
  section('08 10 00', 'Doors and Frames'),
  section('08 30 00', 'Specialty Doors and Frames'),
  section('08 50 00', 'Windows'),
  section('08 70 00', 'Hardware'),
  section('08 80 00', 'Glazing'),

  section('09 00 00', 'Finishes'),
  section('09 20 00', 'Plaster and Gypsum Board'),
  section('09 30 00', 'Tiling'),
  section('09 60 00', 'Flooring'),
  section('09 65 00', 'Resilient Flooring'),
  section('09 68 00', 'Carpeting'),
  section('09 90 00', 'Painting and Coating'),

  section('10 00 00', 'Specialties'),
  section('10 14 00', 'Signage'),
  section('10 28 00', 'Toilet, Bath, and Laundry Accessories'),
  section('10 44 00', 'Fire Protection Specialties'),

  section('11 00 00', 'Equipment'),
  section('11 30 00', 'Residential Equipment'),

  section('12 00 00', 'Furnishings'),
  section('12 30 00', 'Casework'),
  section('12 36 00', 'Countertops'),
  section('12 90 00', 'Other Furnishings'),

  section('21 00 00', 'Fire Suppression'),
  section('21 10 00', 'Water-Based Fire-Suppression Systems'),

  section('22 00 00', 'Plumbing'),
  section('22 10 00', 'Plumbing Piping'),
  section('22 30 00', 'Plumbing Equipment'),
  section('22 40 00', 'Plumbing Fixtures'),

  section('23 00 00', 'Heating, Ventilating, and Air Conditioning'),
  section('23 05 00', 'Common Work Results for HVAC'),
  section('23 30 00', 'HVAC Air Distribution'),
  section('23 50 00', 'Central Heating Equipment'),
  section('23 80 00', 'Decentralized HVAC Equipment'),

  section('25 00 00', 'Integrated Automation'),
  section('25 10 00', 'Integrated Automation Network Equipment'),

  section('26 00 00', 'Electrical'),
  section('26 05 00', 'Common Work Results for Electrical'),
  section('26 20 00', 'Low-Voltage Electrical Distribution'),
  section('26 24 00', 'Switchboards and Panelboards'),
  section('26 27 00', 'Low-Voltage Distribution Equipment'),
  section('26 50 00', 'Lighting'),

  section('27 00 00', 'Communications'),
  section('27 10 00', 'Structured Cabling'),
  section('27 40 00', 'Audio-Video Communications'),
  section('27 50 00', 'Distributed Communications and Monitoring Systems'),

  section('28 00 00', 'Electronic Safety and Security'),
  section('28 10 00', 'Electronic Access Control and Intrusion Detection'),
  section('28 20 00', 'Electronic Surveillance'),
  section('28 30 00', 'Electronic Detection and Alarm'),

  section('31 00 00', 'Earthwork'),
  section('31 10 00', 'Site Clearing'),
  section('31 20 00', 'Earth Moving'),
  section('31 23 00', 'Excavation and Fill'),
  section('31 25 00', 'Erosion and Sedimentation Controls'),

  section('32 00 00', 'Exterior Improvements'),
  section('32 10 00', 'Bases, Ballasts, and Paving'),
  section('32 13 00', 'Rigid Paving'),
  section('32 30 00', 'Site Improvements'),
  section('32 90 00', 'Planting'),

  section('33 00 00', 'Utilities'),
  section('33 10 00', 'Water Utilities'),
  section('33 30 00', 'Sanitary Sewerage Utilities'),
  section('33 40 00', 'Storm Drainage Utilities'),
  section('33 70 00', 'Electrical Utilities'),

  section('48 00 00', 'Electrical Power Generation'),
  section('48 14 00', 'Solar Energy Electrical Power Generation Equipment'),
  section('48 15 00', 'Wind Energy Electrical Power Generation Equipment'),
  section('48 30 00', 'Electrical Power Generation Equipment'),
];

export const CSI_MASTER_FORMAT: CsiMasterFormatData = {
  divisions: DIVISIONS,
  sections: SECTIONS,
};
