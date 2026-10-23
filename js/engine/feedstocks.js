// OWNER: PERSON A (process & math engine)
// Feedstock properties for Medak District, Telangana, India.
// moisture = wet basis (as dumped, 0-1). ash, fc (fixed carbon) and lhv are DRY basis (0-1, MJ/kg).
// Values compiled from MNRE Biomass Resource Atlas of India, ICAR-CIRCOT, TSREDCO, and CSIR-NEERI studies.
window.WTE = window.WTE || {};

WTE.FEEDSTOCKS = {
  // Source: MNRE National Biomass Resource Atlas of India & ECN Phyllis2 database (#phy200057)
  // Standard woody biomass reference; common in social forestry and wastelands across Medak (Subabul / Prosopis).
  wood: {
    name: 'Wood chips (Subabul / Prosopis)',
    moisture: 0.20,
    ash: 0.015,
    lhv: 18.5,
    fc: 0.17,
    color: '#b5793b',
  },

  // Source: ICAR-Central Institute for Research on Cotton Technology (CIRCOT) Technical Bulletin on Cotton Stalk Energy Utilization
  // Major commercial crop residue across Telangana; millions of tonnes cleared and field-burned annually after harvest.
  cotton: {
    name: 'Cotton stalks (Kapas katti)',
    moisture: 0.14,
    ash: 0.045,
    lhv: 17.5,
    fc: 0.19,
    color: '#a67c52',
  },

  // Source: Telangana State Renewable Energy Development Corporation (TSREDCO) / ASCI Biomass Assessment; ECN Phyllis2 (#phy200021)
  // Extensively cultivated kharif and rabi grain in Medak district; shelled cobs are a dense, low-ash gasification feedstock.
  maize: {
    name: 'Maize cobs (Makka kanka)',
    moisture: 0.12,
    ash: 0.025,
    lhv: 16.8,
    fc: 0.18,
    color: '#d9b45c',
  },

  // Source: MNRE Biomass Resource Atlas of India (Paddy Milling Sector); Ravindranath et al., Biomass & Bioenergy (2005)
  // Primary irrigated grain across Medak (Manjeera basin); rice mills in Medak, Toopran, Ramayampet produce abundant silica-rich husk.
  husk: {
    name: 'Paddy rice husk (Vari tholu)',
    moisture: 0.11,
    ash: 0.170,
    lhv: 14.9,
    fc: 0.16,
    color: '#c8a05a',
  },

  // Source: Vasantdada Sugar Institute (VSI) & Sugar Technologists Association of India (STAI) Biomass Characterization Handbook
  // Cultivated in Medak/Sangareddy/Zaheerabad agrarian belt; fibrous crushed residue from local jaggery units and sugar mills.
  bagasse: {
    name: 'Sugarcane bagasse (Cheruku pindi)',
    moisture: 0.22,
    ash: 0.035,
    lhv: 17.2,
    fc: 0.15,
    color: '#7d8c4e',
  },

  // Source: CSIR-NEERI (National Environmental Engineering Research Institute) Characterization of Semi-Urban Market Waste in Telangana
  // Perishable vegetable and fruit residue from APMC Rythu Bazars in Medak, Toopran, and Gajwel (sorted & solar-dried).
  mandi: {
    name: 'Mandi sorted vegetable waste',
    moisture: 0.22,
    ash: 0.080,
    lhv: 15.5,
    fc: 0.14,
    color: '#588157',
  },
};
