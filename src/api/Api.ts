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
    api = new ApiImpl(routingApi, geocodingApi, apiKey)
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
    private readonly routingApi: string
    private readonly sarathiRoutesApi: string
    private readonly sarathiSearchApi: string
    private readonly geocodingApi: string
    private routeCounter = 0
    private lastRouteNumber = -1

    constructor(routingApi: string, geocodingApi: string, apiKey: string) {
        this.routingApi = routingApi
        this.geocodingApi = geocodingApi
        this.apiKey = apiKey
        this.sarathiRoutesApi = 'http://10.212.32.230:50060/routeplanner/routes' 
        this.sarathiSearchApi = 'http://10.212.32.230:50091/routeplanner/location/search'
    }

    async info(): Promise<ApiInfo> {
        const response = await fetch(this.getRoutingURLWithKey('info').toString(), {
            headers: { Accept: 'application/json' },
        }).catch(() => {
            throw new Error('Could not connect to the Service. Try to reload!')
        })

        const result = await response.json()
        if (response.ok) {
            return ApiImpl.convertToApiInfo(result)
        } else {
            if (result.message) throw new Error(result.message)
            throw new Error(
                'There has been an error. Server responded with ' + response.statusText + ' (' + response.status + ')'
            )
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
                        if (!segment.points && segment.source.geo && segment.destination.geo) {
                            // Create a LineString with enough points for proper icon placement
                            // For simplicity, we'll create 5 points along a straight line between source and destination
                            const srcLng = segment.source.geo.lng;
                            const srcLat = segment.source.geo.lat;
                            const destLng = segment.destination.geo.lng;
                            const destLat = segment.destination.geo.lat;
                            
                            // Calculate intermediate points
                            const coordinates = [];
                            const numPoints = 5;
                            
                            for (let i = 0; i < numPoints; i++) {
                                const ratio = i / (numPoints - 1);
                                const lng = srcLng + ratio * (destLng - srcLng);
                                const lat = srcLat + ratio * (destLat - srcLat);
                                coordinates.push([lng, lat, 0]);
                            }
                            
                            segment.points = {
                                type: 'LineString',
                                coordinates: coordinates
                            } as LineString;
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

    private getRoutingURLWithKey(endpoint: string) {
        const url = new URL(this.routingApi + endpoint)
        url.searchParams.append('key', this.apiKey)
        return url
    }

    private getGeocodingURLWithKey(endpoint: string) {
        const url = new URL(this.geocodingApi + endpoint)
        url.searchParams.append('key', this.apiKey)
        return url
    }

    static createRequest(args: RoutingArgs): RoutingRequest {
        let profileConfig = config.profiles ? (config.profiles as any)[args.profile] : {}
        let details = config.request?.details ? config.request.details : []
        // don't query all path details for all profiles (e.g. foot_network and get_off_bike are not enabled for motor vehicles)
        if (profileConfig?.details) details = [...details, ...profileConfig.details] // don't modify original arrays!

        const request: RoutingRequest = {
            points: args.points,
            profile: args.profile,
            elevation: true,
            instructions: true,
            locale: getTranslation().getLang(),
            points_encoded: true,
            points_encoded_multiplier: 1e6,
            ...profileConfig,
            details: details,
        }

        if (config.request?.snapPreventions) request.snap_preventions = config.request?.snapPreventions

        if (args.customModel) {
            request.custom_model = args.customModel
            request['ch.disable'] = true
            request['timeout_ms'] = 10000
        }

        if (
            args.points.length <= 2 &&
            args.maxAlternativeRoutes > 1 &&
            !(request as any)['curbsides'] &&
            !args.profile.startsWith('cp_')
        ) {
            return {
                ...request,
                timeout_ms: 10000,
                'alternative_route.max_paths': args.maxAlternativeRoutes,
                algorithm: 'alternative_route',
            }
        }
        return request
    }

    static convertToApiInfo(response: any): ApiInfo {
        let bbox = [0, 0, 0, 0] as Bbox
        let version = ''
        const profiles: RoutingProfile[] = []

        for (const profileIndex in response.profiles as ApiProfile[]) {
            const profile: RoutingProfile = {
                name: response.profiles[profileIndex].name,
            }

            profiles.push(profile)
        }

        for (const property in response) {
            if (property === 'bbox') bbox = response[property]
            else if (property === 'version') version = response[property]
        }

        return {
            profiles: profiles,
            elevation: response.elevation,
            bbox: bbox,
            version: version,
            encoded_values: response.encoded_values,
        }
    }

    private static decodeResult(result: RawResult, is3D: boolean) {
        return result.paths
            .map((path: RawPath) => {
                return {
                    ...path,
                    points: ApiImpl.decodePoints(path, is3D),
                    snapped_waypoints: ApiImpl.decodeWaypoints(path, is3D),
                } as Path
            })
            .map((path: Path) => {
                return {
                    ...path,
                }
            })
    }

    private static decodePoints(path: RawPath, is3D: boolean) {
        if (path.points_encoded) {
            const multiplier = path.points_encoded_multiplier || 1e5
            return {
                type: 'LineString',
                coordinates: ApiImpl.decodePath(path.points as string, is3D, multiplier),
            }
        } else return path.points as LineString
    }

    private static decodeWaypoints(path: RawPath, is3D: boolean) {
        if (path.points_encoded) {
            const multiplier = path.points_encoded_multiplier || 1e5
            return {
                type: 'LineString',
                coordinates: ApiImpl.decodePath(path.snapped_waypoints as string, is3D, multiplier),
            }
        } else return path.snapped_waypoints as LineString
    }

    private static decodePath(encoded: string, is3D: boolean, multiplier: number): number[][] {
        const len = encoded.length
        let index = 0
        const array: number[][] = []
        let lat = 0
        let lng = 0
        let ele = 0

        while (index < len) {
            let b
            let shift = 0
            let result = 0
            do {
                b = encoded.charCodeAt(index++) - 63
                result |= (b & 0x1f) << shift
                shift += 5
            } while (b >= 0x20)
            const deltaLat = result & 1 ? ~(result >> 1) : result >> 1
            lat += deltaLat

            shift = 0
            result = 0
            do {
                b = encoded.charCodeAt(index++) - 63
                result |= (b & 0x1f) << shift
                shift += 5
            } while (b >= 0x20)
            const deltaLon = result & 1 ? ~(result >> 1) : result >> 1
            lng += deltaLon

            if (is3D) {
                // elevation
                shift = 0
                result = 0
                do {
                    b = encoded.charCodeAt(index++) - 63
                    result |= (b & 0x1f) << shift
                    shift += 5
                } while (b >= 0x20)
                const deltaEle = result & 1 ? ~(result >> 1) : result >> 1
                ele += deltaEle
                array.push([lng / multiplier, lat / multiplier, ele / 100])
            } else array.push([lng / multiplier, lat / multiplier])
        }
        return array
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
