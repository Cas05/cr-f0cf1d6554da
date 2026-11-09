/* Example data only. Commission rates here are PLACEHOLDERS, not real Fora rates. */
window.SAMPLE = (function () {
  var sup = function (id, name, type, commission, notes) {
    return { id: id, name: name, type: type, commission: commission, notes: notes || '', placeholder: true };
  };
  var settings = {
    advisorName: 'Victoria Castleberry',
    brand: 'Booked by Castleberry',
    handle: '@bookedbycastleberry',
    advisorLink: 'https://www.foratravel.com/advisor/victoria-castleberry',
    email: '', phone: '',
    foraSplit: 70, foraSplitPlaceholder: true,
    feeKeep: 100, feeKeepPlaceholder: true,
    defaultPlanningFee: 0,
    tagline: 'Cruises, family getaways & fertility travel, planned with care.',
    suppliers: [
      sup('s_cruise_a', 'Royal Caribbean', 'Cruise line', 10),
      sup('s_cruise_b', 'Carnival', 'Cruise line', 10),
      sup('s_cruise_c', 'Celebrity Cruises', 'Cruise line', 10),
      sup('s_cruise_d', 'Virgin Voyages', 'Cruise line', 10),
      sup('s_hotel_a', 'Fora Reserve / partner hotel', 'Hotel', 10),
      sup('s_hotel_b', 'Other hotel (non-partner)', 'Hotel', 8),
      sup('s_allinc', 'All-inclusive resort', 'Resort', 12),
      sup('s_tour', 'Tour operator', 'Tour operator', 12),
      sup('s_excursion', 'Excursion / activity provider', 'Activities', 10),
      sup('s_transfer', 'Private transfer company', 'Transfers', 10),
      sup('s_insurance', 'Travel insurance provider', 'Insurance', 10),
      sup('s_air', 'Airline (direct)', 'Air', 0, 'Air is often non-commissionable; check Fora')
    ]
  };
  function id(p) { return p + Math.random().toString(36).slice(2, 9); }
  var cruise = {
    id: 'example_cruise', example: true,
    title: 'EXAMPLE: Western Caribbean Family Cruise (7-night sailing)',
    clients: 'Jordan & Taylor Sample', email: '', adults: 2, children: 2,
    destination: 'Galveston, Cozumel, Roatán & Costa Maya',
    startDate: '2027-03-13', endDate: '2027-03-21', tripType: 'Cruise',
    planningFee: 0, coverImage: '',
    welcome: 'Spring break at sea! Here is everything for your family cruise in one place. Message me anytime with questions.',
    clientNotes: 'Passports recommended for all travelers. Final cruise payment due 75 days before sailing.',
    showItemPrices: true,
    items: [
      { id: id('i'), category: 'Cruise', description: 'Royal Caribbean, 7-night Western Caribbean, Ocean View Balcony (2 adults + 2 kids)', supplierId: 's_cruise_a', cost: 3980, taxes: 712, date: '2027-03-14', confirmation: 'EX123456', notes: '' },
      { id: id('i'), category: 'Flights', description: 'Round-trip LIT to IAH (4 travelers)', supplierId: 's_air', cost: 780, taxes: 96, date: '2027-03-13', confirmation: '', notes: 'Booked direct, non-commissionable', nonCommissionable: true },
      { id: id('i'), category: 'Hotel', description: 'Pre-cruise night, Galveston waterfront hotel', supplierId: 's_hotel_a', cost: 229, taxes: 41, date: '2027-03-13', confirmation: '' },
      { id: id('i'), category: 'Transfers', description: 'Hotel to cruise terminal and terminal to IAH', supplierId: 's_transfer', cost: 210, taxes: 0, date: '2027-03-14', confirmation: '' },
      { id: id('i'), category: 'Excursion', description: 'Cozumel beach club day pass (family)', supplierId: 's_excursion', cost: 340, taxes: 0, date: '2027-03-17', confirmation: '' },
      { id: id('i'), category: 'Insurance', description: 'Comprehensive travel insurance (4 travelers)', supplierId: 's_insurance', cost: 386, taxes: 0, date: '', confirmation: '' }
    ],
    days: [
      { date: '2027-03-13', title: 'Fly to Houston & overnight in Galveston', location: 'Galveston, TX', body: 'Morning flight Little Rock to Houston (IAH). Transfer to your waterfront hotel. Dinner on the Strand.' },
      { date: '2027-03-14', title: 'Embarkation day', location: 'Galveston, TX', body: 'Private transfer to the cruise terminal. Check-in window 11:30 to 12:00. Muster drill, then sail away at 4:00 PM.' },
      { date: '2027-03-15', title: 'Day at sea', location: 'Gulf of Mexico', body: 'Kids club opens at 9:00 AM. Pool deck, FlowRider and an evening show.' },
      { date: '2027-03-16', title: 'Roatán, Honduras', location: 'Roatán', body: 'Snorkel or relax at the beach. All aboard by 4:30 PM.' },
      { date: '2027-03-17', title: 'Cozumel, Mexico', location: 'Cozumel', body: 'Beach club day pass is booked for the family. Lunch and loungers included.' },
      { date: '2027-03-18', title: 'Costa Maya, Mexico', location: 'Costa Maya', body: 'Optional Mayan ruins tour or a lazy day at the port pool.' },
      { date: '2027-03-19', title: 'Day at sea', location: 'Gulf of Mexico', body: 'Formal night. Pack and set out luggage tags tonight.' },
      { date: '2027-03-20', title: 'Day at sea', location: 'Gulf of Mexico', body: 'Last full day onboard. Enjoy!' },
      { date: '2027-03-21', title: 'Disembark & fly home', location: 'Galveston to Little Rock', body: 'Disembark by 8:30 AM. Private transfer to IAH and your flight home.' }
    ]
  };
  var ivf = {
    id: 'example_ivf', example: true,
    title: 'EXAMPLE: 12-Night Fertility Trip to Prague',
    clients: 'Morgan Sample', email: '', adults: 2, children: 0,
    destination: 'Prague, Czech Republic',
    startDate: '2027-05-02', endDate: '2027-05-14', tripType: 'IVF / fertility',
    planningFee: 350, coverImage: '',
    welcome: 'I know this trip means so much. I have handled the travel so you can focus on yourselves. Clinic times are listed for planning only; always follow your clinic\'s instructions.',
    clientNotes: 'Clinic appointments are booked and paid directly with your clinic and are shown here for planning only. I am not a medical provider and cannot give medical advice.',
    showItemPrices: true,
    items: [
      { id: id('i'), category: 'Flights', description: 'Round-trip LIT to PRG, economy (2 travelers)', supplierId: 's_air', cost: 2380, taxes: 410, date: '2027-05-02', nonCommissionable: true, notes: 'Non-commissionable' },
      { id: id('i'), category: 'Hotel', description: '12 nights, quiet room near clinic, breakfast daily', supplierId: 's_hotel_a', cost: 2760, taxes: 290, date: '2027-05-03' },
      { id: id('i'), category: 'Transfers', description: 'Private airport transfers + 3 clinic rides', supplierId: 's_transfer', cost: 320, taxes: 0, date: '2027-05-03' },
      { id: id('i'), category: 'Clinic appointment', description: 'Clinic consult & monitoring (paid directly to clinic)', supplierId: '', cost: 0, taxes: 0, date: '2027-05-04', nonCommissionable: true, includeInTotal: false, notes: 'Planning note only' },
      { id: id('i'), category: 'Insurance', description: 'Travel insurance (check medical-procedure exclusions)', supplierId: 's_insurance', cost: 310, taxes: 0, date: '' }
    ],
    days: [
      { date: '2027-05-02', title: 'Depart Little Rock', location: 'In flight', body: 'Overnight flight via a European hub.' },
      { date: '2027-05-03', title: 'Arrive in Prague', location: 'Prague', body: 'Private driver meets you at arrivals. Settle in and rest.' },
      { date: '2027-05-04', title: 'Clinic consult', location: 'Prague', body: 'Driver pickup 45 minutes before your clinic time. Afternoon free.' }
    ]
  };
  return { settings: settings, trips: [cruise, ivf] };
})();
