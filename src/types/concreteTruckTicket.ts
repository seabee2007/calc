/** Field QC record for one ready-mix truck delivery. */
export interface ConcreteTruckTicket {
  ticketNumber: string;
  truckNumber: string;
  mixCode: string;

  batchPlant: string;

  batchTime: string;
  departTime: string;
  arrivalTime: string;
  dischargeStart: string;
  dischargeEnd: string;

  orderedYards: number;
  deliveredYards: number;

  slump: number;
  airContent: number;
  concreteTemp: number;

  waterAddedPlant: number;
  waterAddedSite: number;

  drumRevolutions: number;

  accepted: boolean;
}

/** Extra QC fields stored with the ticket but not on the delivery ticket itself. */
export interface TruckTicketExtras {
  recordDate: string;
  slumpAfterAdjustment: number;
  admixtureAddedOnSite: string;
  inspectorInitials: string;
}

export interface TruckTicketFormState {
  recordDate: string;
  ticketNumber: string;
  truckNumber: string;
  mixCode: string;
  batchPlant: string;
  batchTime: string;
  departTime: string;
  arrivalTime: string;
  dischargeStart: string;
  dischargeEnd: string;
  orderedYards: string;
  deliveredYards: string;
  slump: string;
  slumpAfterAdjustment: string;
  airContent: string;
  concreteTemp: string;
  waterAddedPlant: string;
  waterAddedSite: string;
  drumRevolutions: string;
  ticketAccepted: boolean;
  admixtureAddedOnSite: string;
  inspectorInitials: string;
}

export interface StoredTruckTicketRecord {
  id: string;
  projectId: string;
  createdAt: string;
  updatedAt: string;
  form: TruckTicketFormState;
  ticket: ConcreteTruckTicket;
}

export const TRUCK_TICKET_NOTE_PREFIX = '__TRUCK_TICKET__';

export const DEFAULT_TRUCK_TICKET_FORM: TruckTicketFormState = {
  recordDate: new Date().toISOString().split('T')[0],
  ticketNumber: '',
  truckNumber: '',
  mixCode: '',
  batchPlant: '',
  batchTime: '',
  departTime: '',
  arrivalTime: '',
  dischargeStart: '',
  dischargeEnd: '',
  orderedYards: '',
  deliveredYards: '',
  slump: '',
  slumpAfterAdjustment: '',
  airContent: '',
  concreteTemp: '',
  waterAddedPlant: '',
  waterAddedSite: '',
  drumRevolutions: '',
  ticketAccepted: false,
  admixtureAddedOnSite: '',
  inspectorInitials: '',
};

export const EMPTY_CONCRETE_TRUCK_TICKET: ConcreteTruckTicket = {
  ticketNumber: '',
  truckNumber: '',
  mixCode: '',
  batchPlant: '',
  batchTime: '',
  departTime: '',
  arrivalTime: '',
  dischargeStart: '',
  dischargeEnd: '',
  orderedYards: 0,
  deliveredYards: 0,
  slump: 0,
  airContent: 0,
  concreteTemp: 0,
  waterAddedPlant: 0,
  waterAddedSite: 0,
  drumRevolutions: 0,
  accepted: false,
};
