import { Path, RoutingResult } from './graphhopper'
import { SegmentedPath, SegmentedRoutingResult, Segment } from './sarathi'
import { Position, LineString } from 'geojson'
import { TRANSPORT_MODES } from '@/constants/TransportModes'

/**
 * Ensures a Position has three elements [lon, lat, elevation]
 */
function ensurePosition(pos: Position): [number, number, number] {
    if (pos.length === 3) return pos as [number, number, number];
    if (pos.length === 2) return [pos[0], pos[1], 0];
    // Default fallback (should never happen)
    return [0, 0, 0];
}

/**
 * Determines a transport mode based on the distance between points and segment index
 */
function determineTransportMode(
    from: [number, number, number],
    to: [number, number, number],
    segmentIndex: number
): string {
    // Calculate rough distance using Haversine formula
    const R = 6371; // Earth radius in km
    const dLat = (to[1] - from[1]) * Math.PI / 180;
    const dLon = (to[0] - from[0]) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(from[1] * Math.PI / 180) * Math.cos(to[1] * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;

    // Assign logical modes based on distance and index
    if (distance > 100) return 'flight';
    if (distance > 30) return 'train';
    if (distance > 10) return 'bus';
    return 'cab';
}

/**
 * Finds the relevant portion of the original path's points between two waypoints
 */
function findRelevantPathPoints(
    from: [number, number, number],
    to: [number, number, number],
    allPoints: Position[]
): Position[] {
    if (allPoints.length <= 2) {
        // If we only have a few points, just use direct line
        return [from, to];
    }

    // Find the closest points in the original path to our segment endpoints
    let fromIndex = 0;
    let toIndex = allPoints.length - 1;
    let minFromDist = Infinity;
    let minToDist = Infinity;

    for (let i = 0; i < allPoints.length; i++) {
        const point = allPoints[i];
        
        // Simple distance calculation for finding closest points
        const fromDist = Math.sqrt(
            Math.pow(point[0] - from[0], 2) + 
            Math.pow(point[1] - from[1], 2)
        );
        
        const toDist = Math.sqrt(
            Math.pow(point[0] - to[0], 2) + 
            Math.pow(point[1] - to[1], 2)
        );
        
        if (fromDist < minFromDist) {
            minFromDist = fromDist;
            fromIndex = i;
        }
        
        if (toDist < minToDist) {
            minToDist = toDist;
            toIndex = i;
        }
    }

    // Make sure from comes before to
    if (fromIndex > toIndex) {
        [fromIndex, toIndex] = [toIndex, fromIndex];
    }

    // Get the actual path points between the closest matches to our waypoints
    return [from, ...allPoints.slice(fromIndex + 1, toIndex), to];
}

/**
 * Create segment points based on transport mode
 */
function createSegmentPoints(
    from: [number, number, number],
    to: [number, number, number],
    mode: string,
    allPoints: Position[]
): Position[] {
    // For flight, just use direct line
    if (mode === 'flight') {
        return [from, to];
    }
    
    // For all other modes, use the actual road network points from the original path
    return findRelevantPathPoints(from, to, allPoints);
}

/**
 * Converts a single GraphHopper path to a segmented path
 */
export function convertPathToSegmented(path: Path): SegmentedPath {
    const waypoints = path.snapped_waypoints.coordinates;
    const allPoints = path.points.coordinates;
    
    // If we have less than 2 waypoints, we can't make segments
    if (waypoints.length < 2) {
        return {
            distance: path.distance,
            time: path.time,
            points_encoded: path.points_encoded,
            points_encoded_multiplier: path.points_encoded_multiplier,
            bbox: path.bbox,
            segments: []
        };
    }
    
    // Create segments between waypoints
    const segments: Segment[] = [];
    for (let i = 0; i < waypoints.length - 1; i++) {
        const from = ensurePosition(waypoints[i]);
        const to = ensurePosition(waypoints[i + 1]);
        const mode = determineTransportMode(from, to, i);
        
        const segmentPoints = createSegmentPoints(from, to, mode, allPoints);
        
        // Calculate the segment's distance (approximate)
        let segmentDistance = 0;
        for (let j = 0; j < segmentPoints.length - 1; j++) {
            const p1 = segmentPoints[j];
            const p2 = segmentPoints[j + 1];
            
            // Simple Haversine distance calculation
            const R = 6371000; // Earth radius in meters
            const dLat = (p2[1] - p1[1]) * Math.PI / 180;
            const dLon = (p2[0] - p1[0]) * Math.PI / 180;
            const a = 
                Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(p1[1] * Math.PI / 180) * Math.cos(p2[1] * Math.PI / 180) * 
                Math.sin(dLon/2) * Math.sin(dLon/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            segmentDistance += R * c;
        }
        
        segments.push({
            mode,
            from,
            to,
            distance: segmentDistance,
            time: (segmentDistance / path.distance) * path.time, // Approximate proportion of total time
            points: {
                type: 'LineString',
                coordinates: segmentPoints
            }
        });
    }
    
    return {
        distance: path.distance,
        time: path.time,
        points_encoded: path.points_encoded,
        points_encoded_multiplier: path.points_encoded_multiplier,
        bbox: path.bbox,
        segments
    };
}

/**
 * Converts a GraphHopper routing result to a segmented routing result
 */
export function convertToSegmentedPaths(routingResult: RoutingResult): SegmentedRoutingResult {
    return {
        paths: routingResult.paths.map(convertPathToSegmented)
    };
} 