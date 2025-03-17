import { LineString } from 'geojson'
import { TRANSPORT_MODES } from '@/constants/TransportModes'

// Type for transport modes
export type TransportMode = typeof TRANSPORT_MODES[number]

export interface Segment {
    mode: TransportMode
    from: [number, number, number] // [longitude, latitude, elevation]
    to: [number, number, number] // [longitude, latitude, elevation]
    points: LineString
    distance?: number
    time?: number
}

export interface SegmentedPath {
    distance: number
    time: number
    weight?: number
    transfers?: number
    points_encoded?: boolean
    points_encoded_multiplier?: number
    bbox?: [number, number, number, number] // [minLon, minLat, maxLon, maxLat]
    segments: Segment[]
}

export interface SegmentedRoutingResult {
    paths: SegmentedPath[]
} 