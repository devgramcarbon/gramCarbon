// Approximate town-center coordinates for Milky Mist's MCCs (Milk Chilling Centers).
// These aren't precise facility addresses — just enough to place a marker on the map
// per MCC town, since the source data has no per-facility lat/lng.
export const MM_MCC_LOCATIONS: Record<string, { lat: number; lng: number }> = {
  '504': { lat: 11.596, lng: 78.599 },   // Attur
  '507': { lat: 10.85, lng: 78.03 },      // Kabilarmalai
  '508': { lat: 11.467, lng: 78.167 },    // Kattuputhur
  '512': { lat: 11.4626, lng: 78.1871 },  // Rasipuram
  '520': { lat: 11.15, lng: 78.6167 },    // Thuraiyur
  '526': { lat: 11.7401, lng: 78.9597 },  // Kallakurichi
  '537': { lat: 11.2189, lng: 78.1677 },  // Namakkal
};
