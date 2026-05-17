export type RentalModule = "vehicles" | "properties";
export type AssetStatus = "available" | "reserved" | "rented" | "maintenance" | "inspection";
export type RentalStatus = "draft" | "confirmed" | "active" | "returned" | "late";
export type InspectionType = "pre" | "post" | "routine";
export type CheckResult = "pass" | "watch" | "fail";
export type SubscriptionTier = "starter" | "scale" | "enterprise";

export interface Subscription {
  module: RentalModule;
  tier: SubscriptionTier;
  active: boolean;
  seats: number;
  renewalDate: string;
  monthlyPrice: number;
}

export interface Vehicle {
  id: string;
  make: string;
  model: string;
  year: number;
  plate: string;
  vin: string;
  status: AssetStatus;
  location: string;
  className: string;
  dayRate: number;
  odometer: number;
  fuel: number;
  insuranceProvider: string;
  insurancePolicy: string;
  insuranceExpires: string;
  registrationExpires: string;
  inspectionDue: string;
  serviceDue: string;
  conditionScore: number;
  utilization: number;
  revenueMonth: number;
  features: string[];
  photos: string[];
  documents: DocumentRecord[];
  notes: string;
}

export interface Property {
  id: string;
  name: string;
  type: string;
  address: string;
  status: AssetStatus;
  monthlyRent: number;
  deposit: number;
  bedrooms: number;
  bathrooms: number;
  squareMeters: number;
  occupancy: number;
  inspectionDue: string;
  insuranceExpires: string;
  permitExpires: string;
  conditionScore: number;
  revenueMonth: number;
  amenities: string[];
  photos: string[];
  documents: DocumentRecord[];
  notes: string;
}

export interface DocumentRecord {
  id: string;
  title: string;
  status: "valid" | "review" | "expired";
  expires?: string;
}

export interface Renter {
  id: string;
  name: string;
  company?: string;
  email: string;
  phone: string;
  verified: boolean;
  riskScore: number;
  licenseId?: string;
  paymentMethod: string;
}

export interface Rental {
  id: string;
  module: RentalModule;
  assetId: string;
  renterId: string;
  startDate: string;
  endDate: string;
  status: RentalStatus;
  price: number;
  deposit: number;
  balanceDue: number;
  pickupLocation: string;
  returnLocation: string;
  contractStatus: "missing" | "drafted" | "sent" | "signed";
  channel: string;
  checkInInspectionId?: string;
  checkOutInspectionId?: string;
}

export interface InspectionCheck {
  id: string;
  label: string;
  result: CheckResult;
  notes: string;
}

export interface Inspection {
  id: string;
  module: RentalModule;
  assetId: string;
  rentalId?: string;
  type: InspectionType;
  date: string;
  inspector: string;
  status: "complete" | "needs-action";
  odometer?: number;
  fuel?: number;
  meterReading?: string;
  photos: string[];
  signature: string;
  checks: InspectionCheck[];
  followUps: string[];
}

export interface ChatMessage {
  id: string;
  rentalId: string;
  sender: string;
  role: "renter" | "operator" | "system";
  body: string;
  timestamp: string;
}
