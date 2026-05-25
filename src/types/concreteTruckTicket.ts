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
