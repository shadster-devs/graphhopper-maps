import { LineString } from 'geojson'
import { TRANSPORT_MODES } from '@/constants/TransportModes'

// Type for transport modes
export type TransportMode = typeof TRANSPORT_MODES[number]

// Tag object for route tags
export interface Tag {
    tone: string
    content: string
}

// Price details
export interface Price {
    price: number
    currency: string
}

// CTA details for redirection
export interface CTADetails {
    redirectText: string
    redirectUrl: string
}

// Location information
export interface Location {
    id: string
    sid: number
    type: number
    geo?: {
        lat: number
        lng: number
    }
}

// Segment definition for each part of a journey
export interface Segment {
    from: string
    to: string
    summary: string
    time: number
    priceDetails: Price
    mode: string
    ctaDetails: CTADetails
    source: Location
    destination: Location
    source_sts: Location
    destination_sts: Location
    vendor: number
    travelDate: number
    points?: LineString
}

// Path definition (a complete route)
export interface SegmentedPath {
    tags?: Tag[]
    summary: string
    travelDuration: number
    price: Price
    segments: Segment[]
    distance: number
    pathId: string
}

// Full routing result
export interface SegmentedRoutingResult {
    success: boolean
    data: {
        header: string
        from: {
            place: string
            id: string
            sid: number
            type: number
            cc: string
        }
        to: {
            place: string
            id: string
            sid: number
            type: number
            cc: string
        }
        count: number
        routes: SegmentedPath[]
    }
} 