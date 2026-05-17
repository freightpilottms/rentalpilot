import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Building2,
  CalendarClock,
  Camera,
  Car,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Download,
  FileSignature,
  Filter,
  Gauge,
  Home,
  ImagePlus,
  KeyRound,
  LayoutDashboard,
  Lock,
  MessageSquareText,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  UserCheck,
  WalletCards,
  Wrench,
} from "lucide-react";
import {
  propertyChecklist,
  seedInspections,
  seedMessages,
  seedProperties,
  seedRentals,
  seedRenters,
  seedSubscriptions,
  seedVehicles,
  vehicleChecklist,
} from "./data";
import { usePersistentState } from "./storage";
import type {
  ChatMessage,
  CheckResult,
  InspectionCheck,
  InspectionType,
  Inspection,
  Property,
  Rental,
  RentalModule,
  Renter,
  Subscription,
  Vehicle,
} from "./types";
import {
  buildChecks,
  daysBetween,
  dueLabel,
  formatCurrency,
  formatDate,
  healthClass,
  moduleLabel,
  resultClass,
  today,
  uid,
} from "./utils";

type ViewKey =
  | "command"
  | "vehicles"
  | "properties"
  | "rentals"
  | "inspections"
  | "contracts"
  | "chat"
  | "subscriptions";

const navItems: Array<{ key: ViewKey; label: string; icon: typeof LayoutDashboard }> = [
  { key: "command", label: "Command", icon: LayoutDashboard },
  { key: "vehicles", label: "Vehicles", icon: Car },
  { key: "properties", label: "Properties", icon: Building2 },
  { key: "rentals", label: "Rentals", icon: KeyRound },
  { key: "inspections", label: "Inspections", icon: ClipboardCheck },
  { key: "contracts", label: "Contracts", icon: FileSignature },
  { key: "chat", label: "Chat", icon: MessageSquareText },
  { key: "subscriptions", label: "Plans", icon: WalletCards },
];

const plans = {
  vehicles: [
    { tier: "starter", name: "Vehicle Starter", price: 79, seats: 2, detail: "15 vehicles, inspections, contracts" },
    { tier: "scale", name: "Vehicle Scale", price: 149, seats: 8, detail: "Unlimited vehicles, fleet chat, API-ready exports" },
    { tier: "enterprise", name: "Vehicle Enterprise", price: 349, seats: 25, detail: "Multi-branch controls, approvals, audit logs" },
  ],
  properties: [
    { tier: "starter", name: "Property Starter", price: 129, seats: 4, detail: "20 units, leases, move-in forms" },
    { tier: "scale", name: "Property Scale", price: 239, seats: 12, detail: "Portfolios, maintenance, owner reporting" },
    { tier: "enterprise", name: "Property Enterprise", price: 499, seats: 35, detail: "Commercial controls, SLA workflows, roles" },
  ],
} as const;

type InspectionDraft = {
  module: RentalModule;
  assetId: string;
  rentalId: string;
  type: InspectionType;
  date: string;
  inspector: string;
  odometer: string;
  fuel: string;
  meterReading: string;
  signature: string;
  photos: string;
  checks: InspectionCheck[];
};

function App() {
  const [vehicles, setVehicles] = usePersistentState<Vehicle[]>("rentpilot:v4:vehicles", seedVehicles);
  const [properties, setProperties] = usePersistentState<Property[]>("rentpilot:v4:properties", seedProperties);
  const [renters, setRenters] = usePersistentState<Renter[]>("rentpilot:v4:renters", seedRenters);
  const [rentals, setRentals] = usePersistentState<Rental[]>("rentpilot:v4:rentals", seedRentals);
  const [inspections, setInspections] = usePersistentState<Inspection[]>("rentpilot:v4:inspections", seedInspections);
  const [messages, setMessages] = usePersistentState<ChatMessage[]>("rentpilot:v4:messages", seedMessages);
  const [subscriptions, setSubscriptions] = usePersistentState<Subscription[]>(
    "rentpilot:v4:subscriptions",
    seedSubscriptions,
  );

  const [activeView, setActiveView] = useState<ViewKey>("command");
  const [selectedModule, setSelectedModule] = useState<RentalModule>("vehicles");
  const [selectedVehicleId, setSelectedVehicleId] = useState(seedVehicles[0].id);
  const [selectedPropertyId, setSelectedPropertyId] = useState(seedProperties[0].id);
  const [selectedRentalId, setSelectedRentalId] = useState(seedRentals[0].id);
  const [search, setSearch] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [contractNotes, setContractNotes] = useState("Standard terms, verified identity, deposit held until return closeout.");

  const [vehicleForm, setVehicleForm] = useState({
    make: "",
    model: "",
    plate: "",
    vin: "",
    dayRate: "120",
    location: "",
  });
  const [propertyForm, setPropertyForm] = useState({
    name: "",
    type: "Apartment",
    address: "",
    monthlyRent: "1200",
    bedrooms: "1",
    bathrooms: "1",
  });
  const [rentalForm, setRentalForm] = useState({
    module: "vehicles" as RentalModule,
    assetId: seedVehicles[1].id,
    renterId: seedRenters[0].id,
    startDate: "2026-05-24",
    endDate: "2026-05-28",
    deposit: "500",
    channel: "Direct",
  });
  const [inspectionDraft, setInspectionDraft] = useState(() => createInspectionDraft("vehicles", seedVehicles[0].id));

  const selectedVehicle = vehicles.find((vehicle) => vehicle.id === selectedVehicleId) ?? vehicles[0];
  const selectedProperty = properties.find((property) => property.id === selectedPropertyId) ?? properties[0];
  const selectedRental = rentals.find((rental) => rental.id === selectedRentalId) ?? rentals[0];
  const selectedRenter = renters.find((renter) => renter.id === selectedRental?.renterId);

  const activeSubscriptions = useMemo(
    () => ({
      vehicles: subscriptions.some((subscription) => subscription.module === "vehicles" && subscription.active),
      properties: subscriptions.some((subscription) => subscription.module === "properties" && subscription.active),
    }),
    [subscriptions],
  );

  const portfolioStats = useMemo(() => {
    const vehicleRevenue = vehicles.reduce((sum, vehicle) => sum + vehicle.revenueMonth, 0);
    const propertyRevenue = properties.reduce((sum, property) => sum + property.revenueMonth, 0);
    const activeRentals = rentals.filter((rental) => rental.status === "active").length;
    const dueInspections = [...vehicles.map((vehicle) => vehicle.inspectionDue), ...properties.map((property) => property.inspectionDue)]
      .filter((date) => new Date(`${date}T12:00:00`) <= new Date("2026-06-01T12:00:00")).length;
    const signedContracts = rentals.filter((rental) => rental.contractStatus === "signed").length;
    const contractCoverage = Math.round((signedContracts / Math.max(1, rentals.length)) * 100);

    return {
      revenue: vehicleRevenue + propertyRevenue,
      assets: vehicles.length + properties.length,
      activeRentals,
      dueInspections,
      contractCoverage,
      utilization: Math.round(
        (vehicles.reduce((sum, vehicle) => sum + vehicle.utilization, 0) +
          properties.reduce((sum, property) => sum + property.occupancy, 0)) /
          Math.max(1, vehicles.length + properties.length),
      ),
    };
  }, [vehicles, properties, rentals]);

  const filteredVehicles = useMemo(() => {
    const query = search.toLowerCase();
    return vehicles.filter((vehicle) =>
      [vehicle.make, vehicle.model, vehicle.plate, vehicle.location, vehicle.className].some((value) =>
        value.toLowerCase().includes(query),
      ),
    );
  }, [vehicles, search]);

  const filteredProperties = useMemo(() => {
    const query = search.toLowerCase();
    return properties.filter((property) =>
      [property.name, property.type, property.address].some((value) => value.toLowerCase().includes(query)),
    );
  }, [properties, search]);

  const selectedRentalMessages = messages.filter((message) => message.rentalId === selectedRental?.id);
  const selectedAssetName = selectedRental ? getAssetName(selectedRental, vehicles, properties) : "";

  useEffect(() => {
    setVehicles((current) => {
      let changed = false;
      const next = current.map((vehicle) => {
        if (vehicle.id === "veh-001" && vehicle.photos[0]?.includes("1549924231")) {
          changed = true;
          return { ...vehicle, photos: seedVehicles[0].photos };
        }
        return vehicle;
      });
      return changed ? next : current;
    });
  }, [setVehicles]);

  function createInspectionDraft(module: RentalModule, assetId: string, rentalId?: string): InspectionDraft {
    const checklist = module === "vehicles" ? vehicleChecklist : propertyChecklist;
    return {
      module,
      assetId,
      rentalId: rentalId ?? "",
      type: "pre",
      date: today,
      inspector: "RentPilot Ops",
      odometer: "",
      fuel: "80",
      meterReading: "",
      signature: "",
      photos: "",
      checks: buildChecks(checklist),
    };
  }

  function resetInspectionDraft(module: RentalModule, assetId: string, rentalId?: string) {
    setInspectionDraft(createInspectionDraft(module, assetId, rentalId));
  }

  function activatePlan(module: RentalModule, tier: Subscription["tier"], monthlyPrice: number, seats: number) {
    setSubscriptions((current) => {
      const withoutModule = current.filter((subscription) => subscription.module !== module);
      return [
        ...withoutModule,
        {
          module,
          tier,
          active: true,
          seats,
          renewalDate: "2026-06-17",
          monthlyPrice,
        },
      ];
    });
  }

  function addVehicle(event: FormEvent) {
    event.preventDefault();
    if (!vehicleForm.make || !vehicleForm.model || !vehicleForm.plate) return;
    const vehicle: Vehicle = {
      id: uid("veh"),
      make: vehicleForm.make,
      model: vehicleForm.model,
      year: 2026,
      plate: vehicleForm.plate,
      vin: vehicleForm.vin || "VIN-PENDING",
      status: "available",
      location: vehicleForm.location || "Main depot",
      className: "Custom fleet unit",
      dayRate: Number(vehicleForm.dayRate) || 120,
      odometer: 0,
      fuel: 100,
      insuranceProvider: "Pending",
      insurancePolicy: "Pending",
      insuranceExpires: "2026-12-31",
      registrationExpires: "2026-12-31",
      inspectionDue: "2026-05-31",
      serviceDue: "2026-08-01",
      conditionScore: 100,
      utilization: 0,
      revenueMonth: 0,
      features: ["New record", "Needs document upload"],
      photos: ["https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1100&q=80"],
      documents: [
        { id: uid("doc"), title: "Insurance policy", status: "review", expires: "2026-12-31" },
        { id: uid("doc"), title: "Registration", status: "review", expires: "2026-12-31" },
      ],
      notes: "New vehicle record. Complete insurance, registration, service, and inspection data.",
    };
    setVehicles((current) => [vehicle, ...current]);
    setSelectedVehicleId(vehicle.id);
    setVehicleForm({ make: "", model: "", plate: "", vin: "", dayRate: "120", location: "" });
  }

  function addProperty(event: FormEvent) {
    event.preventDefault();
    if (!propertyForm.name || !propertyForm.address) return;
    const property: Property = {
      id: uid("prop"),
      name: propertyForm.name,
      type: propertyForm.type,
      address: propertyForm.address,
      status: "available",
      monthlyRent: Number(propertyForm.monthlyRent) || 1200,
      deposit: Math.round((Number(propertyForm.monthlyRent) || 1200) * 1.5),
      bedrooms: Number(propertyForm.bedrooms) || 1,
      bathrooms: Number(propertyForm.bathrooms) || 1,
      squareMeters: 50,
      occupancy: 0,
      inspectionDue: "2026-05-31",
      insuranceExpires: "2026-12-31",
      permitExpires: "2026-12-31",
      conditionScore: 100,
      revenueMonth: 0,
      amenities: ["New record", "Document review"],
      photos: ["https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1100&q=80"],
      documents: [
        { id: uid("doc"), title: "Property insurance", status: "review", expires: "2026-12-31" },
        { id: uid("doc"), title: "Occupancy permit", status: "review", expires: "2026-12-31" },
      ],
      notes: "New property record. Complete amenities, photos, inspection, insurance, and permits.",
    };
    setProperties((current) => [property, ...current]);
    setSelectedPropertyId(property.id);
    setPropertyForm({ name: "", type: "Apartment", address: "", monthlyRent: "1200", bedrooms: "1", bathrooms: "1" });
  }

  function addRental(event: FormEvent) {
    event.preventDefault();
    const module = rentalForm.module;
    const asset =
      module === "vehicles"
        ? vehicles.find((vehicle) => vehicle.id === rentalForm.assetId)
        : properties.find((property) => property.id === rentalForm.assetId);
    if (!asset) return;
    const days = daysBetween(rentalForm.startDate, rentalForm.endDate);
    const price =
      module === "vehicles"
        ? Math.round((asset as Vehicle).dayRate * days)
        : Math.round(((asset as Property).monthlyRent / 30) * days);
    const rental: Rental = {
      id: uid("rent"),
      module,
      assetId: rentalForm.assetId,
      renterId: rentalForm.renterId,
      startDate: rentalForm.startDate,
      endDate: rentalForm.endDate,
      status: "confirmed",
      price,
      deposit: Number(rentalForm.deposit) || 0,
      balanceDue: price,
      pickupLocation: module === "vehicles" ? (asset as Vehicle).location : "Digital check-in",
      returnLocation: module === "vehicles" ? (asset as Vehicle).location : "Digital check-out",
      contractStatus: "drafted",
      channel: rentalForm.channel,
    };
    setRentals((current) => [rental, ...current]);
    if (module === "vehicles") {
      setVehicles((current) =>
        current.map((vehicle) => (vehicle.id === rental.assetId ? { ...vehicle, status: "reserved" } : vehicle)),
      );
    } else {
      setProperties((current) =>
        current.map((property) => (property.id === rental.assetId ? { ...property, status: "reserved" } : property)),
      );
    }
    setSelectedRentalId(rental.id);
    setActiveView("rentals");
  }

  function submitInspection(event: FormEvent) {
    event.preventDefault();
    const failed = inspectionDraft.checks.some((check) => check.result === "fail");
    const watched = inspectionDraft.checks.filter((check) => check.result !== "pass");
    const inspection: Inspection = {
      id: uid("ins"),
      module: inspectionDraft.module,
      assetId: inspectionDraft.assetId,
      rentalId: inspectionDraft.rentalId || undefined,
      type: inspectionDraft.type,
      date: inspectionDraft.date,
      inspector: inspectionDraft.inspector,
      status: failed ? "needs-action" : "complete",
      odometer: inspectionDraft.module === "vehicles" ? Number(inspectionDraft.odometer) || undefined : undefined,
      fuel: inspectionDraft.module === "vehicles" ? Number(inspectionDraft.fuel) || undefined : undefined,
      meterReading: inspectionDraft.module === "properties" ? inspectionDraft.meterReading : undefined,
      photos: inspectionDraft.photos
        .split("\n")
        .map((photo) => photo.trim())
        .filter(Boolean),
      signature: inspectionDraft.signature,
      checks: inspectionDraft.checks,
      followUps: watched.map((check) => `${check.label}: ${check.notes || check.result}`),
    };
    setInspections((current) => [inspection, ...current]);
    setRentals((current) =>
      current.map((rental) => {
        if (rental.id !== inspection.rentalId) return rental;
        return inspection.type === "pre"
          ? { ...rental, checkInInspectionId: inspection.id }
          : { ...rental, checkOutInspectionId: inspection.id, status: "returned" };
      }),
    );
    if (inspection.module === "vehicles") {
      setVehicles((current) =>
        current.map((vehicle) =>
          vehicle.id === inspection.assetId
            ? {
                ...vehicle,
                odometer: inspection.odometer ?? vehicle.odometer,
                fuel: inspection.fuel ?? vehicle.fuel,
                status: failed ? "maintenance" : vehicle.status,
                conditionScore: failed ? Math.max(70, vehicle.conditionScore - 8) : vehicle.conditionScore,
              }
            : vehicle,
        ),
      );
    } else {
      setProperties((current) =>
        current.map((property) =>
          property.id === inspection.assetId
            ? {
                ...property,
                status: failed ? "maintenance" : property.status,
                conditionScore: failed ? Math.max(70, property.conditionScore - 8) : property.conditionScore,
              }
            : property,
        ),
      );
    }
    resetInspectionDraft(inspection.module, inspection.assetId, inspection.rentalId);
    setActiveView("inspections");
  }

  function updateDraftCheck(id: string, field: "result" | "notes", value: CheckResult | string) {
    setInspectionDraft((current) => ({
      ...current,
      checks: current.checks.map((check) => (check.id === id ? { ...check, [field]: value } : check)),
    }));
  }

  function sendMessage(body = chatInput) {
    if (!selectedRental || !body.trim()) return;
    const message: ChatMessage = {
      id: uid("msg"),
      rentalId: selectedRental.id,
      sender: "RentPilot Ops",
      role: "operator",
      body: body.trim(),
      timestamp: new Date().toISOString(),
    };
    setMessages((current) => [...current, message]);
    setChatInput("");
  }

  function addMedia() {
    if (!mediaUrl.trim()) return;
    const url = mediaUrl.trim();
    if (selectedModule === "vehicles") {
      setVehicles((current) =>
        current.map((vehicle) => (vehicle.id === selectedVehicle.id ? { ...vehicle, photos: [url, ...vehicle.photos] } : vehicle)),
      );
    } else {
      setProperties((current) =>
        current.map((property) =>
          property.id === selectedProperty.id ? { ...property, photos: [url, ...property.photos] } : property,
        ),
      );
    }
    setMediaUrl("");
  }

  function contractText(rental: Rental) {
    const asset = getAssetName(rental, vehicles, properties);
    const renter = renters.find((item) => item.id === rental.renterId);
    const preInspection = inspections.find((inspection) => inspection.id === rental.checkInInspectionId);
    const postInspection = inspections.find((inspection) => inspection.id === rental.checkOutInspectionId);
    return [
      "RENTAL AGREEMENT",
      "",
      `Agreement date: ${formatDate(today)}`,
      `Rental ID: ${rental.id}`,
      `Rental module: ${moduleLabel(rental.module)}`,
      `Asset: ${asset}`,
      `Renter: ${renter?.name ?? "Unknown renter"}`,
      `Contact: ${renter?.email ?? ""} ${renter?.phone ?? ""}`,
      `Term: ${formatDate(rental.startDate)} to ${formatDate(rental.endDate)}`,
      `Price: ${formatCurrency(rental.price)}`,
      `Deposit: ${formatCurrency(rental.deposit)}`,
      `Balance due: ${formatCurrency(rental.balanceDue)}`,
      "",
      "Operational conditions",
      `Pickup/check-in: ${rental.pickupLocation}`,
      `Return/check-out: ${rental.returnLocation}`,
      `Pre-rental inspection: ${preInspection ? `${preInspection.id}, ${formatDate(preInspection.date)}` : "Required before handoff"}`,
      `Post-rental inspection: ${postInspection ? `${postInspection.id}, ${formatDate(postInspection.date)}` : "Required at return"}`,
      "",
      "Terms",
      "1. The renter accepts responsibility for the asset during the rental term.",
      "2. Damage, missing inventory, fines, cleaning fees, utilities, tolls, charging, fuel, and late return costs may be deducted from the deposit.",
      "3. The asset must be returned in the same condition documented in the pre-rental inspection, allowing for normal use.",
      "4. Insurance, registration, permits, keys, access devices, and safety equipment remain part of the asset record.",
      "5. Messages in the rental chat are part of the operational file.",
      "",
      `Additional clauses: ${contractNotes}`,
      "",
      "Signatures",
      "Operator: ______________________________",
      "Renter: ________________________________",
    ].join("\n");
  }

  function downloadContract() {
    if (!selectedRental) return;
    const text = contractText(selectedRental);
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${selectedRental.id}-contract.txt`;
    link.click();
    URL.revokeObjectURL(url);
    setRentals((current) =>
      current.map((rental) => (rental.id === selectedRental.id ? { ...rental, contractStatus: "sent" } : rental)),
    );
  }

  function printContract() {
    if (!selectedRental) return;
    const printWindow = window.open("", "_blank", "width=900,height=1100");
    if (!printWindow) return;
    const escaped = contractText(selectedRental).replace(/[&<>]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[char]!);
    printWindow.document.write(`
      <html>
        <head>
          <title>${selectedRental.id} contract</title>
          <style>
            body { font-family: Arial, sans-serif; color: #16201d; padding: 40px; line-height: 1.55; }
            pre { white-space: pre-wrap; font: inherit; }
          </style>
        </head>
        <body><pre>${escaped}</pre><script>window.print();</script></body>
      </html>
    `);
    printWindow.document.close();
  }

  function markContractSigned() {
    if (!selectedRental) return;
    setRentals((current) =>
      current.map((rental) => (rental.id === selectedRental.id ? { ...rental, contractStatus: "signed" } : rental)),
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => setActiveView("command")} title="RentPilot command center">
          <span className="brand-mark">
            <Sparkles size={19} />
          </span>
          <span>
            <strong>RentPilot</strong>
            <small>Rental OS</small>
          </span>
        </button>
        <nav className="nav-list">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                className={activeView === item.key ? "active" : ""}
                onClick={() => setActiveView(item.key)}
                title={item.label}
              >
                <Icon size={19} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="subscription-strip">
          <div>
            <span className={activeSubscriptions.vehicles ? "dot on" : "dot"} />
            Vehicle plan
          </div>
          <div>
            <span className={activeSubscriptions.properties ? "dot on" : "dot"} />
            Property plan
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <p className="eyebrow">Today, {formatDate(today)}</p>
            <h1>{titleFor(activeView)}</h1>
          </div>
          <div className="topbar-actions">
            <label className="search-box">
              <Search size={17} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search assets, renters, plates" />
            </label>
            <button className="icon-button" onClick={() => setSearch("")} title="Clear search">
              <RefreshCw size={18} />
            </button>
          </div>
        </header>

        {activeView === "command" && (
          <section className="view-stack">
            <div className="metrics-grid">
              <Metric icon={WalletCards} label="Monthly revenue" value={formatCurrency(portfolioStats.revenue)} accent="green" />
              <Metric icon={KeyRound} label="Active rentals" value={portfolioStats.activeRentals.toString()} accent="blue" />
              <Metric icon={Gauge} label="Utilization" value={`${portfolioStats.utilization}%`} accent="orange" />
              <Metric icon={ClipboardCheck} label="Due inspections" value={portfolioStats.dueInspections.toString()} accent="red" />
              <Metric icon={FileSignature} label="Contract coverage" value={`${portfolioStats.contractCoverage}%`} accent="teal" />
            </div>

            <div className="command-layout">
              <section className="panel wide-panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">Live operations</p>
                    <h2>Reservations, risk and handoff readiness</h2>
                  </div>
                  <button className="soft-button" onClick={() => setActiveView("rentals")} title="Open rentals">
                    <KeyRound size={17} />
                    Rentals
                  </button>
                </div>
                <div className="rental-table">
                  {rentals.map((rental) => (
                    <button
                      key={rental.id}
                      className="rental-row"
                      onClick={() => {
                        setSelectedRentalId(rental.id);
                        setActiveView("rentals");
                      }}
                    >
                      <span>
                        <strong>{getAssetName(rental, vehicles, properties)}</strong>
                        <small>{renters.find((renter) => renter.id === rental.renterId)?.name}</small>
                      </span>
                      <span>{formatDate(rental.startDate)}</span>
                      <span>{formatCurrency(rental.price)}</span>
                      <StatusPill label={rental.status} />
                      <StatusPill label={rental.contractStatus} tone={rental.contractStatus === "signed" ? "good" : "watch"} />
                    </button>
                  ))}
                </div>
              </section>

              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">Attention queue</p>
                    <h2>Next actions</h2>
                  </div>
                  <AlertTriangle size={20} />
                </div>
                <div className="action-list">
                  {[...vehicles, ...properties]
                    .sort((a, b) => daysUntilAsset(a) - daysUntilAsset(b))
                    .slice(0, 5)
                    .map((asset) => (
                      <button
                        key={asset.id}
                        onClick={() => {
                          if ("plate" in asset) {
                            setSelectedVehicleId(asset.id);
                            setSelectedModule("vehicles");
                            setActiveView("vehicles");
                          } else {
                            setSelectedPropertyId(asset.id);
                            setSelectedModule("properties");
                            setActiveView("properties");
                          }
                        }}
                      >
                        <span>
                          <strong>{"plate" in asset ? `${asset.make} ${asset.model}` : asset.name}</strong>
                          <small>{dueLabel(asset.inspectionDue)} inspection</small>
                        </span>
                        <StatusPill label={asset.status} tone={asset.status === "maintenance" ? "bad" : "neutral"} />
                      </button>
                    ))}
                </div>
              </section>
            </div>

            <div className="asset-split">
              <MiniAssetRail title="Vehicle fleet" items={vehicles} onOpen={(id) => {
                setSelectedVehicleId(id);
                setSelectedModule("vehicles");
                setActiveView("vehicles");
              }} />
              <MiniAssetRail title="Property portfolio" items={properties} onOpen={(id) => {
                setSelectedPropertyId(id);
                setSelectedModule("properties");
                setActiveView("properties");
              }} />
            </div>
          </section>
        )}

        {activeView === "vehicles" && (
          <section className="view-stack">
            <ModuleGate active={activeSubscriptions.vehicles} module="vehicles" onOpenPlans={() => setActiveView("subscriptions")} />
            <div className="asset-workspace">
              <section className="panel list-panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">Fleet database</p>
                    <h2>{filteredVehicles.length} vehicles</h2>
                  </div>
                  <Filter size={18} />
                </div>
                <div className="asset-list">
                  {filteredVehicles.map((vehicle) => (
                    <button
                      key={vehicle.id}
                      className={selectedVehicle.id === vehicle.id ? "asset-row selected" : "asset-row"}
                      onClick={() => {
                        setSelectedVehicleId(vehicle.id);
                        setSelectedModule("vehicles");
                      }}
                    >
                      <img src={vehicle.photos[0]} alt="" />
                      <span>
                        <strong>
                          {vehicle.make} {vehicle.model}
                        </strong>
                        <small>{vehicle.plate} · {vehicle.location}</small>
                      </span>
                      <StatusPill label={vehicle.status} tone={vehicle.status === "maintenance" ? "bad" : "neutral"} />
                    </button>
                  ))}
                </div>
                <form className="quick-form" onSubmit={addVehicle}>
                  <h3>Add vehicle</h3>
                  <div className="form-grid two">
                    <input value={vehicleForm.make} onChange={(event) => setVehicleForm({ ...vehicleForm, make: event.target.value })} placeholder="Make" />
                    <input value={vehicleForm.model} onChange={(event) => setVehicleForm({ ...vehicleForm, model: event.target.value })} placeholder="Model" />
                    <input value={vehicleForm.plate} onChange={(event) => setVehicleForm({ ...vehicleForm, plate: event.target.value })} placeholder="Plate" />
                    <input value={vehicleForm.vin} onChange={(event) => setVehicleForm({ ...vehicleForm, vin: event.target.value })} placeholder="VIN" />
                    <input value={vehicleForm.dayRate} onChange={(event) => setVehicleForm({ ...vehicleForm, dayRate: event.target.value })} placeholder="Daily rate" />
                    <input value={vehicleForm.location} onChange={(event) => setVehicleForm({ ...vehicleForm, location: event.target.value })} placeholder="Location" />
                  </div>
                  <button className="primary-button" type="submit">
                    <Plus size={17} />
                    Add vehicle
                  </button>
                </form>
              </section>

              <AssetDetail
                module="vehicles"
                asset={selectedVehicle}
                inspections={inspections.filter((inspection) => inspection.assetId === selectedVehicle.id)}
                rentals={rentals.filter((rental) => rental.assetId === selectedVehicle.id)}
                renters={renters}
                mediaUrl={mediaUrl}
                setMediaUrl={setMediaUrl}
                addMedia={addMedia}
                onInspect={() => {
                  resetInspectionDraft("vehicles", selectedVehicle.id);
                  setActiveView("inspections");
                }}
              />
            </div>
          </section>
        )}

        {activeView === "properties" && (
          <section className="view-stack">
            <ModuleGate active={activeSubscriptions.properties} module="properties" onOpenPlans={() => setActiveView("subscriptions")} />
            <div className="asset-workspace">
              <section className="panel list-panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">Property database</p>
                    <h2>{filteredProperties.length} properties</h2>
                  </div>
                  <Home size={18} />
                </div>
                <div className="asset-list">
                  {filteredProperties.map((property) => (
                    <button
                      key={property.id}
                      className={selectedProperty.id === property.id ? "asset-row selected" : "asset-row"}
                      onClick={() => {
                        setSelectedPropertyId(property.id);
                        setSelectedModule("properties");
                      }}
                    >
                      <img src={property.photos[0]} alt="" />
                      <span>
                        <strong>{property.name}</strong>
                        <small>{property.type} · {property.address}</small>
                      </span>
                      <StatusPill label={property.status} tone={property.status === "maintenance" ? "bad" : "neutral"} />
                    </button>
                  ))}
                </div>
                <form className="quick-form" onSubmit={addProperty}>
                  <h3>Add property</h3>
                  <div className="form-grid two">
                    <input value={propertyForm.name} onChange={(event) => setPropertyForm({ ...propertyForm, name: event.target.value })} placeholder="Name" />
                    <select value={propertyForm.type} onChange={(event) => setPropertyForm({ ...propertyForm, type: event.target.value })}>
                      <option>Apartment</option>
                      <option>House</option>
                      <option>Commercial</option>
                      <option>Storage</option>
                    </select>
                    <input className="span-two" value={propertyForm.address} onChange={(event) => setPropertyForm({ ...propertyForm, address: event.target.value })} placeholder="Address" />
                    <input value={propertyForm.monthlyRent} onChange={(event) => setPropertyForm({ ...propertyForm, monthlyRent: event.target.value })} placeholder="Monthly rent" />
                    <input value={propertyForm.bedrooms} onChange={(event) => setPropertyForm({ ...propertyForm, bedrooms: event.target.value })} placeholder="Bedrooms" />
                    <input value={propertyForm.bathrooms} onChange={(event) => setPropertyForm({ ...propertyForm, bathrooms: event.target.value })} placeholder="Bathrooms" />
                  </div>
                  <button className="primary-button" type="submit">
                    <Plus size={17} />
                    Add property
                  </button>
                </form>
              </section>

              <AssetDetail
                module="properties"
                asset={selectedProperty}
                inspections={inspections.filter((inspection) => inspection.assetId === selectedProperty.id)}
                rentals={rentals.filter((rental) => rental.assetId === selectedProperty.id)}
                renters={renters}
                mediaUrl={mediaUrl}
                setMediaUrl={setMediaUrl}
                addMedia={addMedia}
                onInspect={() => {
                  resetInspectionDraft("properties", selectedProperty.id);
                  setActiveView("inspections");
                }}
              />
            </div>
          </section>
        )}

        {activeView === "rentals" && (
          <section className="view-stack">
            <div className="rental-workspace">
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">Reservations</p>
                    <h2>Rental pipeline</h2>
                  </div>
                  <KeyRound size={20} />
                </div>
                <div className="rental-table detailed">
                  {rentals.map((rental) => (
                    <button
                      key={rental.id}
                      className={selectedRental?.id === rental.id ? "rental-row selected" : "rental-row"}
                      onClick={() => setSelectedRentalId(rental.id)}
                    >
                      <span>
                        <strong>{getAssetName(rental, vehicles, properties)}</strong>
                        <small>{renters.find((renter) => renter.id === rental.renterId)?.name}</small>
                      </span>
                      <span>{formatDate(rental.startDate)} - {formatDate(rental.endDate)}</span>
                      <span>{formatCurrency(rental.price)}</span>
                      <StatusPill label={rental.status} />
                    </button>
                  ))}
                </div>
              </section>

              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">New rental</p>
                    <h2>Create booking</h2>
                  </div>
                  <Plus size={20} />
                </div>
                <form className="quick-form no-border" onSubmit={addRental}>
                  <div className="segmented">
                    {(["vehicles", "properties"] as RentalModule[]).map((module) => (
                      <button
                        type="button"
                        key={module}
                        className={rentalForm.module === module ? "active" : ""}
                        onClick={() =>
                          setRentalForm({
                            ...rentalForm,
                            module,
                            assetId: module === "vehicles" ? vehicles[0]?.id : properties[0]?.id,
                          })
                        }
                      >
                        {moduleLabel(module)}
                      </button>
                    ))}
                  </div>
                  <label>
                    Asset
                    <select value={rentalForm.assetId} onChange={(event) => setRentalForm({ ...rentalForm, assetId: event.target.value })}>
                      {(rentalForm.module === "vehicles" ? vehicles : properties).map((asset) => (
                        <option key={asset.id} value={asset.id}>
                          {"plate" in asset ? `${asset.make} ${asset.model} · ${asset.plate}` : asset.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Renter
                    <select value={rentalForm.renterId} onChange={(event) => setRentalForm({ ...rentalForm, renterId: event.target.value })}>
                      {renters.map((renter) => (
                        <option key={renter.id} value={renter.id}>{renter.name}</option>
                      ))}
                    </select>
                  </label>
                  <div className="form-grid two">
                    <label>
                      Start
                      <input type="date" value={rentalForm.startDate} onChange={(event) => setRentalForm({ ...rentalForm, startDate: event.target.value })} />
                    </label>
                    <label>
                      End
                      <input type="date" value={rentalForm.endDate} onChange={(event) => setRentalForm({ ...rentalForm, endDate: event.target.value })} />
                    </label>
                    <label>
                      Deposit
                      <input value={rentalForm.deposit} onChange={(event) => setRentalForm({ ...rentalForm, deposit: event.target.value })} />
                    </label>
                    <label>
                      Channel
                      <input value={rentalForm.channel} onChange={(event) => setRentalForm({ ...rentalForm, channel: event.target.value })} />
                    </label>
                  </div>
                  <button className="primary-button" type="submit">
                    <Plus size={17} />
                    Create rental
                  </button>
                </form>
              </section>

              {selectedRental && (
                <section className="panel rental-detail">
                  <div className="panel-heading">
                    <div>
                      <p className="eyebrow">{selectedRental.id}</p>
                      <h2>{selectedAssetName}</h2>
                    </div>
                    <StatusPill label={selectedRental.status} />
                  </div>
                  <div className="detail-grid">
                    <Info label="Renter" value={selectedRenter?.name ?? "Unknown"} />
                    <Info label="Contact" value={selectedRenter?.email ?? ""} />
                    <Info label="Term" value={`${formatDate(selectedRental.startDate)} - ${formatDate(selectedRental.endDate)}`} />
                    <Info label="Balance" value={formatCurrency(selectedRental.balanceDue)} />
                    <Info label="Deposit" value={formatCurrency(selectedRental.deposit)} />
                    <Info label="Contract" value={selectedRental.contractStatus} />
                  </div>
                  <div className="toolbar">
                    <button
                      className="soft-button"
                      onClick={() => {
                        resetInspectionDraft(selectedRental.module, selectedRental.assetId, selectedRental.id);
                        setActiveView("inspections");
                      }}
                    >
                      <ClipboardCheck size={17} />
                      Inspection
                    </button>
                    <button className="soft-button" onClick={() => setActiveView("contracts")}>
                      <FileSignature size={17} />
                      Contract
                    </button>
                    <button className="soft-button" onClick={() => setActiveView("chat")}>
                      <MessageSquareText size={17} />
                      Chat
                    </button>
                  </div>
                </section>
              )}
            </div>
          </section>
        )}

        {activeView === "inspections" && (
          <section className="inspection-layout">
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Check forms</p>
                  <h2>Pre, post and routine inspections</h2>
                </div>
                <ClipboardCheck size={21} />
              </div>
              <form className="inspection-form" onSubmit={submitInspection}>
                <div className="form-grid three">
                  <label>
                    Module
                    <select
                      value={inspectionDraft.module}
                      onChange={(event) => {
                        const module = event.target.value as RentalModule;
                        const assetId = module === "vehicles" ? vehicles[0]?.id : properties[0]?.id;
                        resetInspectionDraft(module, assetId);
                      }}
                    >
                      <option value="vehicles">Vehicles</option>
                      <option value="properties">Properties</option>
                    </select>
                  </label>
                  <label>
                    Asset
                    <select value={inspectionDraft.assetId} onChange={(event) => resetInspectionDraft(inspectionDraft.module, event.target.value)}>
                      {(inspectionDraft.module === "vehicles" ? vehicles : properties).map((asset) => (
                        <option key={asset.id} value={asset.id}>
                          {"plate" in asset ? `${asset.make} ${asset.model} · ${asset.plate}` : asset.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Rental
                    <select
                      value={inspectionDraft.rentalId}
                      onChange={(event) => setInspectionDraft((current) => ({ ...current, rentalId: event.target.value }))}
                    >
                      <option value="">No rental</option>
                      {rentals
                        .filter((rental) => rental.module === inspectionDraft.module && rental.assetId === inspectionDraft.assetId)
                        .map((rental) => (
                          <option key={rental.id} value={rental.id}>{rental.id}</option>
                        ))}
                    </select>
                  </label>
                  <label>
                    Type
                    <select value={inspectionDraft.type} onChange={(event) => setInspectionDraft((current) => ({ ...current, type: event.target.value as "pre" | "post" | "routine" }))}>
                      <option value="pre">Pre-rental</option>
                      <option value="post">Post-rental</option>
                      <option value="routine">Routine</option>
                    </select>
                  </label>
                  <label>
                    Date
                    <input type="date" value={inspectionDraft.date} onChange={(event) => setInspectionDraft((current) => ({ ...current, date: event.target.value }))} />
                  </label>
                  <label>
                    Inspector
                    <input value={inspectionDraft.inspector} onChange={(event) => setInspectionDraft((current) => ({ ...current, inspector: event.target.value }))} />
                  </label>
                </div>
                {inspectionDraft.module === "vehicles" ? (
                  <div className="form-grid two">
                    <label>
                      Odometer
                      <input value={inspectionDraft.odometer} onChange={(event) => setInspectionDraft((current) => ({ ...current, odometer: event.target.value }))} />
                    </label>
                    <label>
                      Fuel or charge %
                      <input value={inspectionDraft.fuel} onChange={(event) => setInspectionDraft((current) => ({ ...current, fuel: event.target.value }))} />
                    </label>
                  </div>
                ) : (
                  <label>
                    Meter readings
                    <input value={inspectionDraft.meterReading} onChange={(event) => setInspectionDraft((current) => ({ ...current, meterReading: event.target.value }))} />
                  </label>
                )}
                <div className="checklist">
                  {inspectionDraft.checks.map((check) => (
                    <div className="check-row" key={check.id}>
                      <span>{check.label}</span>
                      <select value={check.result} onChange={(event) => updateDraftCheck(check.id, "result", event.target.value as CheckResult)}>
                        <option value="pass">Pass</option>
                        <option value="watch">Watch</option>
                        <option value="fail">Fail</option>
                      </select>
                      <input value={check.notes} onChange={(event) => updateDraftCheck(check.id, "notes", event.target.value)} placeholder="Notes, damage, meter, inventory" />
                    </div>
                  ))}
                </div>
                <label>
                  Photo URLs
                  <textarea value={inspectionDraft.photos} onChange={(event) => setInspectionDraft((current) => ({ ...current, photos: event.target.value }))} placeholder="One image URL per line" />
                </label>
                <label>
                  Renter/operator signature
                  <input value={inspectionDraft.signature} onChange={(event) => setInspectionDraft((current) => ({ ...current, signature: event.target.value }))} placeholder="Typed signature" />
                </label>
                <button className="primary-button" type="submit">
                  <CheckCircle2 size={17} />
                  Save inspection
                </button>
              </form>
            </section>
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Inspection ledger</p>
                  <h2>{inspections.length} records</h2>
                </div>
                <BadgeCheck size={20} />
              </div>
              <div className="timeline">
                {inspections.map((inspection) => (
                  <article key={inspection.id}>
                    <span className={`timeline-dot ${inspection.status === "needs-action" ? "bad" : "good"}`} />
                    <div>
                      <strong>{getAssetNameFromId(inspection.module, inspection.assetId, vehicles, properties)}</strong>
                      <p>{inspection.type} inspection · {formatDate(inspection.date)} · {inspection.inspector}</p>
                      <small>{inspection.followUps.length ? inspection.followUps.join(" | ") : "No follow-up required"}</small>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </section>
        )}

        {activeView === "contracts" && selectedRental && (
          <section className="contract-layout">
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Contract generator</p>
                  <h2>{selectedRental.id} · {selectedAssetName}</h2>
                </div>
                <FileSignature size={22} />
              </div>
              <label>
                Rental
                <select value={selectedRental.id} onChange={(event) => setSelectedRentalId(event.target.value)}>
                  {rentals.map((rental) => (
                    <option key={rental.id} value={rental.id}>{rental.id} · {getAssetName(rental, vehicles, properties)}</option>
                  ))}
                </select>
              </label>
              <label>
                Additional clauses
                <textarea value={contractNotes} onChange={(event) => setContractNotes(event.target.value)} />
              </label>
              <div className="toolbar">
                <button className="primary-button" onClick={downloadContract}>
                  <Download size={17} />
                  Download
                </button>
                <button className="soft-button" onClick={printContract}>
                  <Printer size={17} />
                  Print
                </button>
                <button className="soft-button" onClick={markContractSigned}>
                  <ShieldCheck size={17} />
                  Mark signed
                </button>
              </div>
            </section>
            <section className="contract-paper">
              <pre>{contractText(selectedRental)}</pre>
            </section>
          </section>
        )}

        {activeView === "chat" && selectedRental && (
          <section className="chat-layout">
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Rental chat</p>
                  <h2>{selectedAssetName}</h2>
                </div>
                <MessageSquareText size={21} />
              </div>
              <label>
                Thread
                <select value={selectedRental.id} onChange={(event) => setSelectedRentalId(event.target.value)}>
                  {rentals.map((rental) => (
                    <option key={rental.id} value={rental.id}>{rental.id} · {getAssetName(rental, vehicles, properties)}</option>
                  ))}
                </select>
              </label>
              <div className="quick-replies">
                {[
                  "Your inspection form is ready for review.",
                  "Please upload return photos before checkout.",
                  "Contract has been generated and sent for signature.",
                  "Payment reminder: balance is due before handoff.",
                ].map((reply) => (
                  <button key={reply} onClick={() => sendMessage(reply)}>{reply}</button>
                ))}
              </div>
            </section>
            <section className="chat-panel">
              <div className="messages">
                {selectedRentalMessages.map((message) => (
                  <article key={message.id} className={message.role === "operator" ? "message mine" : "message"}>
                    <strong>{message.sender}</strong>
                    <p>{message.body}</p>
                    <small>{new Date(message.timestamp).toLocaleString()}</small>
                  </article>
                ))}
              </div>
              <form
                className="composer"
                onSubmit={(event) => {
                  event.preventDefault();
                  sendMessage();
                }}
              >
                <input value={chatInput} onChange={(event) => setChatInput(event.target.value)} placeholder="Type a message to the renter" />
                <button className="primary-button" type="submit" title="Send message">
                  <Send size={17} />
                  Send
                </button>
              </form>
            </section>
          </section>
        )}

        {activeView === "subscriptions" && (
          <section className="view-stack">
            <div className="plans-heading">
              <div>
                <p className="eyebrow">Separate subscriptions</p>
                <h2>Activate vehicle and property platforms independently</h2>
              </div>
              <WalletCards size={24} />
            </div>
            <div className="plan-section">
              {(["vehicles", "properties"] as RentalModule[]).map((module) => (
                <section className="panel" key={module}>
                  <div className="panel-heading">
                    <div>
                      <p className="eyebrow">{moduleLabel(module)}</p>
                      <h2>{activeSubscriptions[module] ? "Active subscription" : "Choose plan"}</h2>
                    </div>
                    {activeSubscriptions[module] ? <BadgeCheck size={21} /> : <Lock size={21} />}
                  </div>
                  <div className="plans-grid">
                    {plans[module].map((plan) => {
                      const active = subscriptions.some(
                        (subscription) => subscription.module === module && subscription.tier === plan.tier && subscription.active,
                      );
                      return (
                        <article key={plan.tier} className={active ? "plan active" : "plan"}>
                          <h3>{plan.name}</h3>
                          <strong>{formatCurrency(plan.price)}<span>/mo</span></strong>
                          <p>{plan.detail}</p>
                          <small>{plan.seats} operator seats</small>
                          <button className={active ? "soft-button" : "primary-button"} onClick={() => activatePlan(module, plan.tier, plan.price, plan.seats)}>
                            {active ? <CheckCircle2 size={17} /> : <Plus size={17} />}
                            {active ? "Active" : "Activate"}
                          </button>
                        </article>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function titleFor(view: ViewKey) {
  const labels: Record<ViewKey, string> = {
    command: "Rental command center",
    vehicles: "Vehicle rental platform",
    properties: "Property rental platform",
    rentals: "Reservations and handoffs",
    inspections: "Inspection studio",
    contracts: "Contract automation",
    chat: "Integrated renter chat",
    subscriptions: "Subscription control",
  };
  return labels[view];
}

function Metric({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof LayoutDashboard;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <article className={`metric ${accent}`}>
      <Icon size={21} />
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function StatusPill({ label, tone = "neutral" }: { label: string; tone?: "good" | "watch" | "bad" | "neutral" }) {
  return <span className={`status-pill ${tone}`}>{label}</span>;
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="info-cell">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ModuleGate({ active, module, onOpenPlans }: { active: boolean; module: RentalModule; onOpenPlans: () => void }) {
  if (active) return null;
  return (
    <section className="module-gate">
      <Lock size={18} />
      <span>{moduleLabel(module)} subscription is paused.</span>
      <button className="soft-button" onClick={onOpenPlans}>
        <WalletCards size={16} />
        Open plans
      </button>
    </section>
  );
}

function MiniAssetRail({
  title,
  items,
  onOpen,
}: {
  title: string;
  items: Vehicle[] | Property[];
  onOpen: (id: string) => void;
}) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Portfolio</p>
          <h2>{title}</h2>
        </div>
      </div>
      <div className="mini-rail">
        {items.map((item) => (
          <button key={item.id} onClick={() => onOpen(item.id)}>
            <img src={item.photos[0]} alt="" />
            <span>
              <strong>{"plate" in item ? `${item.make} ${item.model}` : item.name}</strong>
              <small>{"plate" in item ? item.plate : item.address}</small>
            </span>
            <b>{healthClass(item.conditionScore) === "good" ? "Ready" : "Review"}</b>
          </button>
        ))}
      </div>
    </section>
  );
}

function AssetDetail({
  module,
  asset,
  inspections,
  rentals,
  renters,
  mediaUrl,
  setMediaUrl,
  addMedia,
  onInspect,
}: {
  module: RentalModule;
  asset: Vehicle | Property;
  inspections: Inspection[];
  rentals: Rental[];
  renters: Renter[];
  mediaUrl: string;
  setMediaUrl: (value: string) => void;
  addMedia: () => void;
  onInspect: () => void;
}) {
  const isVehicle = module === "vehicles" && "plate" in asset;
  const title = isVehicle ? `${asset.make} ${asset.model}` : (asset as Property).name;
  const subtitle = isVehicle ? `${asset.year} · ${asset.plate} · ${asset.vin}` : `${(asset as Property).type} · ${(asset as Property).address}`;

  return (
    <section className="asset-detail">
      <div className="asset-hero">
        <img src={asset.photos[0]} alt="" />
        <div>
          <p className="eyebrow">{moduleLabel(module)} record</p>
          <h2>{title}</h2>
          <p>{subtitle}</p>
          <div className="hero-badges">
            <StatusPill label={asset.status} tone={asset.status === "maintenance" ? "bad" : "neutral"} />
            <StatusPill label={`${asset.conditionScore}% condition`} tone={healthClass(asset.conditionScore) as "good" | "watch" | "bad"} />
            <StatusPill label={`${dueLabel(asset.inspectionDue)} inspection`} tone={daysUntilAsset(asset) <= 7 ? "watch" : "good"} />
          </div>
        </div>
      </div>

      <div className="detail-grid">
        {isVehicle ? (
          <>
            <Info label="Daily rate" value={formatCurrency(asset.dayRate)} />
            <Info label="Odometer" value={`${asset.odometer.toLocaleString()} km`} />
            <Info label="Fuel/charge" value={`${asset.fuel}%`} />
            <Info label="Insurance" value={`${asset.insuranceProvider} · ${formatDate(asset.insuranceExpires)}`} />
            <Info label="Registration" value={formatDate(asset.registrationExpires)} />
            <Info label="Service due" value={formatDate(asset.serviceDue)} />
          </>
        ) : (
          <>
            <Info label="Monthly rent" value={formatCurrency((asset as Property).monthlyRent)} />
            <Info label="Deposit" value={formatCurrency((asset as Property).deposit)} />
            <Info label="Layout" value={`${(asset as Property).bedrooms} bed · ${(asset as Property).bathrooms} bath`} />
            <Info label="Size" value={`${(asset as Property).squareMeters} m2`} />
            <Info label="Insurance" value={formatDate((asset as Property).insuranceExpires)} />
            <Info label="Permit" value={formatDate((asset as Property).permitExpires)} />
          </>
        )}
      </div>

      <div className="toolbar">
        <button className="primary-button" onClick={onInspect}>
          <ClipboardCheck size={17} />
          Start inspection
        </button>
        <button className="soft-button">
          <Wrench size={17} />
          Service task
        </button>
        <button className="soft-button">
          <ShieldCheck size={17} />
          Compliance
        </button>
      </div>

      <div className="record-layout">
        <section className="panel flush-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Media</p>
              <h2>Photos and evidence</h2>
            </div>
            <Camera size={18} />
          </div>
          <div className="media-grid">
            {asset.photos.map((photo) => (
              <img src={photo} alt="" key={photo} />
            ))}
          </div>
          <div className="inline-add">
            <input value={mediaUrl} onChange={(event) => setMediaUrl(event.target.value)} placeholder="Paste image URL" />
            <button className="soft-button" onClick={addMedia} title="Add media">
              <ImagePlus size={17} />
              Add
            </button>
          </div>
        </section>

        <section className="panel flush-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Compliance</p>
              <h2>Documents</h2>
            </div>
            <ShieldCheck size={18} />
          </div>
          <div className="doc-list">
            {asset.documents.map((document) => (
              <article key={document.id}>
                <span>
                  <strong>{document.title}</strong>
                  <small>{document.expires ? `Expires ${formatDate(document.expires)}` : "No expiry"}</small>
                </span>
                <StatusPill label={document.status} tone={document.status === "valid" ? "good" : document.status === "review" ? "watch" : "bad"} />
              </article>
            ))}
          </div>
        </section>

        <section className="panel flush-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">History</p>
              <h2>Rentals and inspections</h2>
            </div>
            <Clock3 size={18} />
          </div>
          <div className="timeline compact">
            {rentals.map((rental) => (
              <article key={rental.id}>
                <span className="timeline-dot good" />
                <div>
                  <strong>{renters.find((renter) => renter.id === rental.renterId)?.name}</strong>
                  <p>{formatDate(rental.startDate)} - {formatDate(rental.endDate)}</p>
                </div>
              </article>
            ))}
            {inspections.map((inspection) => (
              <article key={inspection.id}>
                <span className={`timeline-dot ${inspection.status === "needs-action" ? "bad" : "good"}`} />
                <div>
                  <strong>{inspection.type} inspection</strong>
                  <p>{formatDate(inspection.date)} · {inspection.inspector}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}

function getAssetName(rental: Rental, vehicles: Vehicle[], properties: Property[]) {
  return getAssetNameFromId(rental.module, rental.assetId, vehicles, properties);
}

function getAssetNameFromId(module: RentalModule, assetId: string, vehicles: Vehicle[], properties: Property[]) {
  if (module === "vehicles") {
    const vehicle = vehicles.find((item) => item.id === assetId);
    return vehicle ? `${vehicle.make} ${vehicle.model} (${vehicle.plate})` : "Unknown vehicle";
  }
  const property = properties.find((item) => item.id === assetId);
  return property ? property.name : "Unknown property";
}

function daysUntilAsset(asset: Vehicle | Property) {
  const target = new Date(`${asset.inspectionDue}T12:00:00`).getTime();
  const current = new Date(`${today}T12:00:00`).getTime();
  return Math.ceil((target - current) / 86400000);
}

export default App;
