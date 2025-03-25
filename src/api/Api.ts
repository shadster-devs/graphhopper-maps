import Dispatcher from '@/stores/Dispatcher'
import { RouteRequestFailed, RouteRequestSuccess } from '@/actions/Actions'
import {
    ApiInfo,
    Bbox,
    ErrorResponse,
    GeocodingResult,
    Path,
    RawPath,
    RawResult,
    ReverseGeocodingHit,
    RoutingArgs,
    RoutingProfile,
    RoutingRequest,
    RoutingResult,
} from '@/api/graphhopper'
import { LineString } from 'geojson'
import { getTranslation, tr } from '@/translation/Translation'
import * as config from 'config'
import { Coordinate } from '@/stores/QueryStore'
import { POIQuery } from '@/pois/AddressParseResult'
import { SegmentedRoutingResult } from './sarathi'

interface ApiProfile {
    name: string
}

let api: Api | null = null

export default interface Api {
    info(): Promise<ApiInfo>

    route(args: RoutingArgs): Promise<SegmentedRoutingResult>

    routeWithDispatch(args: RoutingArgs, zoom: boolean): void

    geocode(query: string, provider: string, additionalOptions?: Record<string, string>): Promise<GeocodingResult>

    reverseGeocode(query: POIQuery, bbox: Bbox): Promise<ReverseGeocodingHit[]>

    supportsGeocoding(): boolean
    
    locationSearch(query: string): Promise<any>
}

export function setApi(routingApi: string, geocodingApi: string, apiKey: string) {
    api = new ApiImpl(apiKey)
}

export function getApi() {
    if (!api) throw Error('Api must be initialized before it can be used. Use "setApi" when starting the app')
    return api
}

/**
 * Implementation of the Api interface.
 */
export class ApiImpl implements Api {
    private readonly apiKey: string
    private readonly sarathiRoutesApi: string
    private readonly sarathiSearchApi: string
    private readonly geocodingApi: string
    private routeCounter = 0
    private lastRouteNumber = -1

    constructor(apiKey: string) {
        this.apiKey = apiKey
        this.geocodingApi = ''
        this.sarathiRoutesApi = 'http://10.212.32.230:50060/routeplanner/routes' 
        this.sarathiSearchApi = 'http://10.212.32.230:50091/routeplanner/location/search'
    }

    async info(): Promise<ApiInfo> {
        try {
            // Create a simplified API info response since we're not using GraphHopper anymore
            // You might want to adapt this with actual capabilities from your Sarathi API if needed
            return {
                profiles: [
                    { name: 'car' },
                    { name: 'bike' },
                    { name: 'foot' }
                ],
                elevation: true,
                bbox: [72.5, 8.0, 97.5, 36.0] as Bbox, // Approximate bbox for India
                version: 'Sarathi 1.0',
                encoded_values: []
            };
        } catch (error) {
            throw new Error('Could not retrieve API information: ' + error);
        }
    }

    async geocode(
        query: string,
        provider: string,
        additionalOptions?: Record<string, string>
    ): Promise<GeocodingResult> {
        try {
            // Skip empty queries
            if (!query || query.trim() === '') {
                return { hits: [], took: 0 };
            }
            
            // Call Sarathi location search API
            const sarathiResult = await this.locationSearch(query);
            
            if (!sarathiResult.success || !sarathiResult.data || sarathiResult.data.length === 0) {
                console.log('No results from Sarathi search API');
                return { hits: [], took: 0 };
            }
            
            // Convert Sarathi search results to GraphHopper GeocodingResult format
            const hits = sarathiResult.data.map((location: any) => {
                // Ensure we have valid coordinates
                const lat = location.geo?.lat || 0;
                const lng = location.geo?.lng || 0;
                
                return {
                    point: {
                        lat: lat,
                        lng: lng
                    },
                    extent: [lng - 0.05, lat - 0.05, lng + 0.05, lat + 0.05], // Create a reasonable bbox
                    osm_id: location.id,
                    osm_type: 'N',
                    osm_value: 'city',
                    name: location.name,
                    country: location.cc,
                    city: location.name,
                    state: '',
                    street: '',
                    housenumber: '',
                    postcode: '',
                    osm_key: 'place',
                    point_id: location.sid.toString(),
                    // Store the original Sarathi location data for later use
                    sarathiLocation: {
                        id: location.id,
                        sid: location.sid,
                        type: location.type,
                        name: location.name,
                        cc: location.cc,
                        geo: location.geo // Store geo coordinates in sarathiLocation as well
                    }
                };
            });
            
            return {
                hits: hits,
                took: 0
            };
        } catch (error) {
            console.error('Error in geocode using Sarathi API:', error);
            // Return empty result on error
            return { hits: [], took: 0 };
        }
    }

    async reverseGeocode(query: POIQuery, bbox: Bbox): Promise<ReverseGeocodingHit[]> {
        if (!this.supportsGeocoding()) return []
        // why is main overpass api so much faster?
        // const url = 'https://overpass.kumi.systems/api/interpreter'
        const url = 'https://overpass-api.de/api/interpreter'

        // bbox of overpass is minLat, minLon, maxLat, maxLon
        let minLat = bbox[1],
            minLon = bbox[0],
            maxLat = bbox[3],
            maxLon = bbox[2]

        // Reduce the bbox to improve overpass response time for larger cities or areas.
        // This might lead to empty responses for POI queries with a small result set.
        if (maxLat - minLat > 0.3) {
            const centerLat = (maxLat + minLat) / 2
            maxLat = centerLat + 0.15
            minLat = centerLat - 0.15
        }
        if (maxLon - minLon > 0.3) {
            const centerLon = (maxLon + minLon) / 2
            maxLon = centerLon + 0.15
            minLon = centerLon - 0.15
        }

        let queryString = ''
        for (const q of query.queries) {
            // nwr means it searches for nodes, ways and relations
            queryString += 'nwr'
            for (const p of q.phrases) {
                if (p.sign == '=' && p.v == '*') queryString += `["${p.k}"]`
                else if (p.ignoreCase) queryString += `["${p.k}"${p.sign}"${p.v}", i]`
                else queryString += `["${p.k}"${p.sign}"${p.v}"]`
            }
            queryString += `;\n`
        }

        try {
            const data = `[out:json][timeout:15][bbox:${minLat}, ${minLon}, ${maxLat}, ${maxLon}];\n(${queryString});\nout center 100;`
            console.log(data)
            const result = await fetch(url, {
                method: 'POST',
                body: 'data=' + encodeURIComponent(data),
            })
            const json = await result.json()
            if (json.elements) {
                const res = (json.elements as any[])
                    .map(e => {
                        if (e.center) {
                            return { ...e, point: { lat: e.center.lat, lng: e.center.lon } } as ReverseGeocodingHit
                        } else {
                            return { ...e, point: { lat: e.lat, lng: e.lon } } as ReverseGeocodingHit
                        }
                    })
                    .filter(p => !!p.tags && p.point)
                return res
            } else return []
        } catch (error) {
            console.warn('error occured ' + error)
            return []
        }
    }

    supportsGeocoding(): boolean {
        return this.geocodingApi !== ''
    }

    async route(args: RoutingArgs): Promise<SegmentedRoutingResult> {
        try {
            // Check if args has sarathiLocation data attached
            if (!args.sarathiSourceLocation || !args.sarathiDestLocation) {
                throw new Error('Source or destination location data is missing. Please select locations from the search results.');
            }
            
            // Use the provided sarathiLocation data for source and destination
            const sourceId = args.sarathiSourceLocation.id;
            const sourceSid = args.sarathiSourceLocation.sid;
            const destId = args.sarathiDestLocation.id;
            const destSid = args.sarathiDestLocation.sid;
            
            // Call the Sarathi routes API with the appropriate source/destination
            const response = await fetch(this.sarathiRoutesApi, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'variant': 'dweb'
                },
                body: JSON.stringify({
                    source: {
                        id: sourceId,
                        sid: sourceSid,
                        type: 1
                    },
                    destination: {
                        id: destId,
                        sid: destSid,
                        type: 1
                    }
                })
            });
            
            if (!response.ok) {
                throw new Error(`Sarathi API error: ${response.status} ${response.statusText}`);
            }
            
            const result = await response.json() as SegmentedRoutingResult;
            
            // Process the result to ensure the points field is set for each segment
            if (result.success && result.data && result.data.routes) {
                result.data.routes.forEach(route => {
                    route.segments.forEach(segment => {
                        // If no points are provided, create a line between source and destination
                        if (!segment.points && segment.source_sts && segment.destination_sts) {
                            // Create a simple array of lon,lat points for proper icon placement
                            const sourceId = segment.source_sts.id;
                            const destId = segment.destination_sts.id;
                            
                            // For now, we'll create 5 points in a straight line between stations
                            // Actual coordinates need to be fetched from a different source
                            // This is just placeholder code until we have the real coordinates
                            // Create some placeholder points in a line
                            const coordinates = [];
                            const numPoints = 5;
                            
                            // Default to 0,0 coordinates if we don't have proper data
                            // In production, these coordinates should be provided by the API
                            coordinates.push([0, 0]);
                            for (let i = 1; i < numPoints-1; i++) {
                                const ratio = i / (numPoints - 1);
                                coordinates.push([ratio, ratio]);
                            }
                            coordinates.push([1, 1]);
                            
                            segment.points = coordinates;
                        }
                    });
                });
            }
            
            return result;
        } catch (error) {
            console.error("Error calling Sarathi API:", error);
            throw error;
        }
    }

    routeWithDispatch(args: RoutingArgs, zoomOnSuccess: boolean) {
        const routeNumber = this.routeCounter++;
        this.route(args)
            .then(result => {
                if (routeNumber > this.lastRouteNumber) {
                    this.lastRouteNumber = routeNumber;
                    Dispatcher.dispatch(new RouteRequestSuccess(args, zoomOnSuccess, result));
                } else {
                    const tmp = JSON.stringify(args) + ' ' + routeNumber + ' <= ' + this.lastRouteNumber;
                    console.log('Ignore response of earlier started route ' + tmp);
                }
            })
            .catch(error => {
                if (routeNumber > this.lastRouteNumber) {
                    console.warn('error when performing route request ' + routeNumber + ': ', error);
                    this.lastRouteNumber = routeNumber;
                    Dispatcher.dispatch(new RouteRequestFailed(args, error.message));
                } else {
                    const tmp = JSON.stringify(args) + ' ' + routeNumber + ' <= ' + this.lastRouteNumber;
                    console.log('Ignore error ' + error.message + ' of earlier started route ' + tmp);
                }
            });
    }

    private getGeocodingURLWithKey(endpoint: string) {
        const url = new URL(this.geocodingApi + endpoint)
        url.searchParams.append('key', this.apiKey)
        return url
    }

    public static isFootLike(profile: string) {
        return profile.includes('hike') || profile.includes('foot')
    }

    public static isBikeLike(profile: string) {
        return profile.includes('mtb') || profile.includes('bike')
    }

    public static isMotorVehicle(profile: string) {
        return (
            profile.includes('car') ||
            profile.includes('truck') ||
            profile.includes('scooter') ||
            profile.includes('bus') ||
            profile.includes('motorcycle')
        )
    }

    public static isTruck(profile: string) {
        return profile.includes('truck')
    }

    public static getBBoxPoints(points: Coordinate[]): Bbox | null {
        const bbox: Bbox = points.reduce(
            (res: Bbox, c) => [
                Math.min(res[0], c.lng),
                Math.min(res[1], c.lat),
                Math.max(res[2], c.lng),
                Math.max(res[3], c.lat),
            ],
            [180, 90, -180, -90] as Bbox
        )
        if (points.length == 1) {
            bbox[0] = bbox[0] - 0.001
            bbox[1] = bbox[1] - 0.001
            bbox[2] = bbox[2] + 0.001
            bbox[3] = bbox[3] + 0.001
        }

        // return null if the bbox is not valid, e.g. if no url points were given at all
        return bbox[0] < bbox[2] && bbox[1] < bbox[3] ? bbox : null
    }

    /**
     * Search for locations using the Sarathi API
     */
    async locationSearch(query: string): Promise<any> {
        try {
            const url = new URL(this.sarathiSearchApi);
            url.searchParams.append('q', query);
            
            const response = await fetch(url.toString(), {
                method: 'GET',
                headers: {
                    'accept': '*/*',
                    'content-type': 'application/json',
                    'variant': 'dweb'
                }
            });
            
            if (!response.ok) {
                throw new Error(`Sarathi search API error: ${response.status} ${response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error("Error calling Sarathi search API:", error);
            throw error;
        }
    }
}
