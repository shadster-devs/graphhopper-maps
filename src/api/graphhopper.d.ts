import { LineString } from 'geojson'
import { Coordinate, CustomModel, SarathiLocation } from '@/stores/QueryStore'

// minLon, minLat, maxLon, maxLat
export type Bbox = [number, number, number, number]

export interface RoutingArgs {
    readonly points: [number, number][]
    readonly profile: string
    readonly maxAlternativeRoutes: number
    readonly customModel: CustomModel | null
    readonly sarathiSourceLocation?: SarathiLocation
    readonly sarathiDestLocation?: SarathiLocation
}

export interface RoutingRequest {
    readonly points: ReadonlyArray<[number, number]>
    profile: string
    locale: string
    points_encoded: boolean
    points_encoded_multiplier: number
    instructions: boolean
    elevation: boolean
    'alternative_route.max_paths'?: number
    'alternative_route.max_weight_factor'?: number
    'ch.disable'?: boolean
    timeout_ms?: number
    algorithm?: 'alternative_route' | 'round_trip'
    snap_preventions?: string[]
    details?: string[]
    custom_model?: CustomModel
}

export interface ErrorResponse {
    message: string
    hints: any[]
}

export interface RoutingResultInfo {
    readonly copyright: string[]
    readonly road_data_timestamp: string
    readonly took: number
}

export interface RoutingResult {
    readonly paths: Path[]
}

export interface RawResult {
    readonly paths: RawPath[]
}

export interface ApiInfo {
    readonly version: string
    readonly bbox: Bbox
    readonly elevation: boolean
    readonly profiles: RoutingProfile[]
    readonly encoded_values: object[]
}

export interface RoutingProfile {
    readonly name: string
}

export interface Path extends BasePath {
    readonly points: LineString
    readonly snapped_waypoints: LineString
}

export interface RawPath extends BasePath {
    readonly points: string | LineString
    readonly snapped_waypoints: string | LineString
}

export interface BasePath {
    readonly distance: number
    readonly time: number
    readonly points_encoded: boolean
    readonly points_encoded_multiplier: number
    readonly bbox?: Bbox
    readonly points_order: number[]
    readonly description: string
}


export interface TagHash {
    [key: string]: string
}

export interface ReverseGeocodingHit {
    readonly tags: TagHash
    readonly type: string
    readonly id: number
    readonly point: Coordinate
}

export interface GeocodingResult {
    readonly hits: GeocodingHit[]
    readonly took: number
}

export interface GeocodingHit {
    readonly point: Coordinate
    readonly extent: Bbox
    readonly osm_id: string
    readonly osm_type: string
    readonly osm_key: string
    readonly osm_value: string
    readonly name: string
    readonly country: string
    readonly city: string
    readonly state: string
    readonly street: string
    readonly housenumber: string
    readonly postcode: string
    readonly sarathiLocation?: SarathiLocation
}
