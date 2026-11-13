export interface CityOption {
  id: string;
  name: string;
  state: string;
  coordinates: [longitude: number, latitude: number];
}

/** City centres are used only to bias place suggestions, not to restrict delivery routes. */
export const CITY_OPTIONS: CityOption[] = [
  { id: "pune", name: "Pune", state: "Maharashtra", coordinates: [73.8567, 18.5204] },
  { id: "mumbai", name: "Mumbai", state: "Maharashtra", coordinates: [72.8777, 19.076] },
  { id: "nashik", name: "Nashik", state: "Maharashtra", coordinates: [73.7898, 19.9975] },
  { id: "nagpur", name: "Nagpur", state: "Maharashtra", coordinates: [79.0882, 21.1458] },
  { id: "delhi", name: "Delhi", state: "Delhi NCR", coordinates: [77.209, 28.6139] },
  { id: "bengaluru", name: "Bengaluru", state: "Karnataka", coordinates: [77.5946, 12.9716] },
  { id: "chennai", name: "Chennai", state: "Tamil Nadu", coordinates: [80.2707, 13.0827] },
  { id: "hyderabad", name: "Hyderabad", state: "Telangana", coordinates: [78.4867, 17.385] },
  { id: "ahmedabad", name: "Ahmedabad", state: "Gujarat", coordinates: [72.5714, 23.0225] },
  { id: "jaipur", name: "Jaipur", state: "Rajasthan", coordinates: [75.7873, 26.9124] },
  { id: "kolkata", name: "Kolkata", state: "West Bengal", coordinates: [88.3639, 22.5726] },
  { id: "surat", name: "Surat", state: "Gujarat", coordinates: [72.8311, 21.1702] },
  { id: "indore", name: "Indore", state: "Madhya Pradesh", coordinates: [75.8577, 22.7196] },
  { id: "lucknow", name: "Lucknow", state: "Uttar Pradesh", coordinates: [80.9462, 26.8467] },
  { id: "coimbatore", name: "Coimbatore", state: "Tamil Nadu", coordinates: [76.9558, 11.0168] },
  { id: "kochi", name: "Kochi", state: "Kerala", coordinates: [76.2673, 9.9312] },
  { id: "chandigarh", name: "Chandigarh", state: "Chandigarh", coordinates: [76.7794, 30.7333] },
  { id: "ludhiana", name: "Ludhiana", state: "Punjab", coordinates: [75.8573, 30.901] },
  { id: "bhopal", name: "Bhopal", state: "Madhya Pradesh", coordinates: [77.4126, 23.2599] },
  { id: "vadodara", name: "Vadodara", state: "Gujarat", coordinates: [73.1812, 22.3072] },
  { id: "patna", name: "Patna", state: "Bihar", coordinates: [85.1376, 25.5941] },
  { id: "bhubaneswar", name: "Bhubaneswar", state: "Odisha", coordinates: [85.8245, 20.2961] },
  { id: "vizag", name: "Visakhapatnam", state: "Andhra Pradesh", coordinates: [83.2185, 17.6868] },
  { id: "mysuru", name: "Mysuru", state: "Karnataka", coordinates: [76.6394, 12.2958] },
];

export const DEFAULT_CITY = CITY_OPTIONS[0];
const SELECTED_CITY_KEY = "logigo.selected-city.v1";

export function getSelectedCity(): CityOption {
  if (typeof window === "undefined") return DEFAULT_CITY;
  try {
    const savedId = window.localStorage.getItem(SELECTED_CITY_KEY);
    return CITY_OPTIONS.find((city) => city.id === savedId) ?? DEFAULT_CITY;
  } catch {
    return DEFAULT_CITY;
  }
}

export function saveSelectedCity(city: CityOption) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SELECTED_CITY_KEY, city.id);
  } catch {
    // City selection remains available for the current page if storage is disabled.
  }
}
