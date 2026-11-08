/* Données de départ, reprises des fichiers du client :
   - coordonnées : Ancien_devis_D2026-041 (toutes fictives)
   - tarifs : Tarifs_RenovExpress_2026.xlsx (toutes les lignes) */
var COMPANY = {
  name: "SARL Rénov'Express",
  activity: "",
  address: "14 rue des Tanneurs",
  city: "69007 Lyon",
  phone: "06 00 00 00 00",
  email: "renovexpress.lyon@exemple.fr",
  siret: "000 000 000 00000 (fictif)",
  tvaIntra: "FR00 000000000",
  rcs: "RCS Lyon – Capital 5 000 €",
  insurer: "XXX Assurances (fictif)",
  insurerPolicy: "0000000",
  insurerZone: "France métropolitaine",
  mediator: "Médiation Exemple (fictif), 1 rue de l\'Exemple, 75001 Paris, www.mediation-exemple.fr.",
  payment: "Paiement par virement ou chèque.",
  lastNumber: 41,          // dernier devis émis : D2026-041
  validityDays: 30,
  depositRate: 30
};

/* price: null = « sur devis » (prix à saisir dans le devis) */
var DEFAULT_TARIFS = [
  { code: "PRO1",  label: "Protection sols et mobilier", unit: "forfait", price: 120, note: "150 si + de 4 pièces" },
  { code: "PREP1", label: "Lessivage murs/plafonds", unit: "m²", price: 3.5, note: "" },
  { code: "PREP2", label: "Rebouchage + ponçage", unit: "m²", price: 6, note: "8 € si gros dégâts" },
  { code: "PREP3", label: "Pose toile de verre", unit: "m²", price: 14, note: "" },
  { code: "PLAF1", label: "Peinture plafond 2 couches mat", unit: "m²", price: 19, note: "impression comprise" },
  { code: "MUR1",  label: "Peinture murs 2 couches velours", unit: "m²", price: 22, note: "impression comprise" },
  { code: "MUR2",  label: "Peinture murs 2 couches satin (cuisine/sdb)", unit: "m²", price: 24, note: "" },
  { code: "BOIS1", label: "Laque porte (2 faces)", unit: "unité", price: 85, note: "" },
  { code: "BOIS2", label: "Plinthes", unit: "ml", price: 6.5, note: "" },
  { code: "RAD1",  label: "Peinture radiateur", unit: "unité", price: 60, note: "vieux radiateurs fonte : 90" },
  { code: "FAC1",  label: "Ravalement façade", unit: "m²", price: null, note: "sur devis – à voir sur place" },
  { code: "NET1",  label: "Nettoyage fin de chantier + déchets", unit: "forfait", price: 90, note: "" },
  { code: "DEP1",  label: "Déplacement hors Lyon", unit: "forfait", price: 40, note: "gratuit dans Lyon / Villeurbanne" }
];
