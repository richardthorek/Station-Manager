/**
 * Station hierarchy representing organizational structure
 * Based on Rural/Country Fire Service structure across Australia
 * Structure varies by state: Area > District > Brigade > Station (NSW RFS)
 * Supports all Australian states and territories
 */
export interface StationHierarchy {
  id: string;
  name: string;
  brigade?: string;
  district?: string;
  area?: string;
  suburb: string;
  state: string;
  postcode: string;
  latitude: number;
  longitude: number;
  operationalStatus?: string;
}

/**
 * Search result with distance information
 */
export interface StationSearchResult extends StationHierarchy {
  distance?: number; // Distance in kilometers from user location
  relevanceScore?: number; // Search relevance score (0-1)
}

/**
 * Raw CSV row from national facilities dataset
 */
export interface RFSFacilityCSVRow {
  X: string;
  Y: string;
  objectid: string;
  featuretype: string;
  descripton: string;
  class: string;
  facility_name: string;
  facility_operationalstatus: string;
  facility_address: string;
  abs_suburb: string;
  facility_state: string;
  abs_postcode: string;
  facility_attribute_source: string;
  facility_lat: string;
  facility_long: string;
  gnaf_formatted_address: string;
  gnaf_suburb: string;
  gnaf_postcode: string;
}
