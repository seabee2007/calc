export type CsiGroup =
  | 'Procurement and Contracting Requirements Group'
  | 'Specifications Group';

export type CsiSubgroup =
  | 'General Requirements Subgroup'
  | 'Facility Construction Subgroup'
  | 'Facility Services Subgroup'
  | 'Site and Infrastructure Subgroup'
  | 'Process Equipment Subgroup';

export type CsiDivision = {
  divisionCode: string;
  divisionNumber: number;
  title: string;
  group: CsiGroup;
  subgroup?: CsiSubgroup;
  reserved: boolean;
};

export type CsiSection = {
  sectionCode: string;
  divisionCode: string;
  title: string;
  level: 2 | 3 | 4 | 5;
  explanation?: string;
  reserved?: boolean;
  alternateTerms?: string[];
  seeAlso?: string[];
};

export type CsiMasterFormatData = {
  divisions: CsiDivision[];
  sections: CsiSection[];
};

export type CsiMasterFormatValidationResult = {
  valid: boolean;
  errors: string[];
};

export type CsiMasterFormatSearchResult = {
  divisions: CsiDivision[];
  sections: CsiSection[];
};
