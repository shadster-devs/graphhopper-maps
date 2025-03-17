import { Feature, Map } from 'ol'
import { Path } from '@/api/graphhopper'
import { SegmentedPath, Segment } from '@/api/sarathi'
import { FeatureCollection } from 'geojson'
import { useEffect, useContext } from 'react'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import { GeoJSON } from 'ol/format'
import { Stroke, Style, Fill } from 'ol/style'
import { fromLonLat } from 'ol/proj'
import { Select } from 'ol/interaction'
import { click } from 'ol/events/condition'
import Dispatcher from '@/stores/Dispatcher'
import { SetSelectedPath } from '@/actions/Actions'
import { SelectEvent } from 'ol/interaction/Select'
import { QueryPoint } from '@/stores/QueryStore'
import { distance } from 'ol/coordinate'
import LineString from 'ol/geom/LineString'
import Point from 'ol/geom/Point'
import { getTransportModeColor, getTransportModeDash, getTransportModeWidth } from '@/constants/TransportModes'
import { PathDisplayMode } from '@/stores/SettingsStore'
import { SettingsContext } from '@/contexts/SettingsContext'
import { Icon } from 'ol/style'

const pathsLayerKey = 'pathsLayer'
const selectedPathLayerKey = 'selectedPathLayer'
const accessNetworkLayerKey = 'accessNetworkLayer'

export default function usePathsLayer(map: Map, paths: SegmentedPath[], selectedPath: SegmentedPath, queryPoints: QueryPoint[]) {
    const settings = useContext(SettingsContext);
    
    useEffect(() => {
        removeCurrentPathLayers(map)
        addUnselectedPathsLayer(
            map,
            paths.filter(p => p != selectedPath),
            settings.pathDisplayMode
        )
        addSelectedPathsLayer(map, selectedPath, settings.pathDisplayMode)
        addAccessNetworkLayer(map, selectedPath, queryPoints)
        return () => {
            removeCurrentPathLayers(map)
        }
    }, [map, paths, selectedPath, settings.pathDisplayMode])
}

function removeCurrentPathLayers(map: Map) {
    map.getLayers()
        .getArray()
        .filter(l => l.get(pathsLayerKey) || l.get(selectedPathLayerKey) || l.get(accessNetworkLayerKey))
        .forEach(l => map.removeLayer(l))
}

/**
 * Get style for a specific transport mode
 */
function getStyleForMode(mode: string, isSelected: boolean = false, isAlternative: boolean = false, displayMode: PathDisplayMode = PathDisplayMode.Dynamic): Style[] {
    const styles: Style[] = [];
    
    // Get width from centralized constants
    const width = getTransportModeWidth(mode, isSelected);
    // Outer stroke is slightly wider than the main line
    const outerWidth = width * 1.25;
    
    // Common style (outer stroke)
    styles.push(new Style({
        stroke: new Stroke({
            color: isSelected ? 'rgba(255,255,255,0.9)' : 'rgba(39,93,173,0.8)',
            width: outerWidth,
        }),
    }));
    
    // Get color and line dash from centralized constants
    const color = getTransportModeColor(mode, isSelected);
    const lineDash = getTransportModeDash(mode);
    
    // Create the main line style
    const mainStyle = new Style({
        stroke: new Stroke({
            color: color,
            width: width,
            lineDash: lineDash,
        }),
    });
    
    styles.push(mainStyle);
    
    return styles;
}

// Function to create a path with directional arrows
function addDirectionalPathFeature(source: VectorSource, segment: Segment, isSelected: boolean = false) {
    // Create the main line feature
    const feature = new Feature();
    const coordinates = segment.points.coordinates.map(c => fromLonLat(c));
    feature.setGeometry(new LineString(coordinates));
    
    // Apply base style for the line
    feature.setStyle(getStyleForMode(segment.mode, isSelected));
    
    // Add to vector source
    source.addFeature(feature);
    
    // If we have at least 2 coordinates, add arrow features at regular intervals
    if (coordinates.length >= 2) {
        // Determine how many arrows to place
        const totalPathLength = coordinates.reduce((acc, curr, idx) => {
            if (idx === 0) return 0;
            return acc + distance(coordinates[idx-1], curr);
        }, 0);
        
        // We'll place an arrow roughly every 100 pixels
        const arrowCount = Math.max(1, Math.floor(totalPathLength / 100));
        const stepSize = 1 / arrowCount;
        
        // Create arrow features along the path
        for (let step = stepSize; step < 1; step += stepSize) {
            // Find the position at this percentage along the line
            const position = calculateIntermediatePointOnPath(coordinates, step);
            
            // Calculate direction at this point (use the closest segment)
            const direction = calculateDirectionAtPoint(coordinates, step);
            
            // Create an arrow feature
            const arrowFeature = createArrowFeature(position, direction, segment.mode, isSelected);
            source.addFeature(arrowFeature);
        }
    }
}

// Helper to calculate a point at a specific percentage along a path
function calculateIntermediatePointOnPath(coordinates: number[][], percentage: number): number[] {
    if (coordinates.length < 2) return coordinates[0];
    
    // Calculate total path length
    let totalLength = 0;
    const segmentLengths: number[] = [];
    
    for (let i = 1; i < coordinates.length; i++) {
        const segmentLength = distance(coordinates[i-1], coordinates[i]);
        segmentLengths.push(segmentLength);
        totalLength += segmentLength;
    }
    
    // Calculate target distance along the path
    const targetDistance = percentage * totalLength;
    
    // Find segment containing the target point
    let currentDistance = 0;
    for (let i = 0; i < segmentLengths.length; i++) {
        if (currentDistance + segmentLengths[i] >= targetDistance) {
            // Calculate how far along this segment
            const segmentPercentage = (targetDistance - currentDistance) / segmentLengths[i];
            
            // Interpolate between points
            const start = coordinates[i];
            const end = coordinates[i+1];
            return [
                start[0] + (end[0] - start[0]) * segmentPercentage,
                start[1] + (end[1] - start[1]) * segmentPercentage
            ];
        }
        currentDistance += segmentLengths[i];
    }
    
    // Fallback to last point
    return coordinates[coordinates.length - 1];
}

// Calculate the direction at a specific percentage along a path
function calculateDirectionAtPoint(coordinates: number[][], percentage: number): number {
    if (coordinates.length < 2) return 0;
    
    // Similar to the above function but returns angle instead
    let totalLength = 0;
    const segmentLengths: number[] = [];
    
    for (let i = 1; i < coordinates.length; i++) {
        const segmentLength = distance(coordinates[i-1], coordinates[i]);
        segmentLengths.push(segmentLength);
        totalLength += segmentLength;
    }
    
    const targetDistance = percentage * totalLength;
    
    let currentDistance = 0;
    for (let i = 0; i < segmentLengths.length; i++) {
        if (currentDistance + segmentLengths[i] >= targetDistance) {
            // Use this segment's direction
            const start = coordinates[i];
            const end = coordinates[i+1];
            
            // Calculate angle in radians
            const dx = end[0] - start[0];
            const dy = end[1] - start[1];
            return Math.atan2(dy, dx);
        }
        currentDistance += segmentLengths[i];
    }
    
    // Fallback: use direction of last segment
    const lastIndex = coordinates.length - 1;
    const start = coordinates[lastIndex - 1];
    const end = coordinates[lastIndex];
    const dx = end[0] - start[0];
    const dy = end[1] - start[1];
    return Math.atan2(dy, dx);
}

// Create an arrow feature at a specific point and direction
function createArrowFeature(position: number[], direction: number, mode: string, isSelected: boolean): Feature {
    const arrowFeature = new Feature({
        geometry: new Point(position)
    });
    
    // Create the arrow style
    const arrowStyle = new Style({
        image: new Icon({
            src: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20">
                    <polygon points="0,0 20,10 0,20" fill="${getTransportModeColor(mode, isSelected)}"/>
                </svg>
            `),
            rotateWithView: true,
            rotation: direction,
            scale: 0.8
        })
    });
    
    arrowFeature.setStyle(arrowStyle);
    return arrowFeature;
}

function addUnselectedPathsLayer(map: Map, paths: SegmentedPath[], displayMode: PathDisplayMode) {
    const layer = new VectorLayer({
        source: new VectorSource(),
        opacity: 0.7,
        zIndex: 1,
    });
    
    // Add each path's segments as separate features
    paths.forEach((path, pathIndex) => {
        path.segments.forEach((segment, segmentIndex) => {
            const feature = new Feature({
                pathIndex: pathIndex,
                segmentIndex: segmentIndex,
            });
            
            const coordinates = segment.points.coordinates.map(c => fromLonLat(c));
            feature.setGeometry(new LineString(coordinates));
            
            // Apply mode-specific style
            feature.setStyle(getStyleForMode(segment.mode, false, true));
            
            layer.getSource()?.addFeature(feature);
            
            // Remove arrow functionality for static mode - no longer needed
        });
    });
    
    layer.set(pathsLayerKey, true);
    map.addLayer(layer);

    // select an alternative path if clicked
    removeSelectPathInteractions(map);
    const select = new Select({
        condition: click,
        layers: [layer],
        style: null,
        hitTolerance: 5,
    });
    select.on('select', (e: SelectEvent) => {
        const pathIndex = e.selected[0].getProperties().pathIndex;
        Dispatcher.dispatch(new SetSelectedPath(paths[pathIndex] as any));
    });
    select.set('gh:select_path_interaction', true);
    map.addInteraction(select);
}

function createBezierLineString(start: number[], end: number[]): LineString {
    const distanceValue = Math.sqrt(Math.pow(end[0] - start[0], 2) + Math.pow(end[1] - start[1], 2))
    const midX = (start[0] + end[0]) / 2
    const midY = (start[1] + end[1]) / 2

    // use high bezier points if the lines are far away
    const bezierHeight = Math.min(0.5, 100 / distanceValue)
    const bezierX = midX
    const bezierY = midY - bezierHeight * distanceValue

    const points = []
    for (let i = 0; i <= 100; i += 5) {
        const t = i / 100
        const s = 1 - t

        // Quadratic Bezier curve
        const x = s * s * start[0] + 2 * s * t * bezierX + t * t * end[0]
        const y = s * s * start[1] + 2 * s * t * bezierY + t * t * end[1]
        points.push([x, y])
    }

    // make sure to have the end point at the end
    if (points[points.length - 1][0] !== end[0] || points[points.length - 1][1] !== end[1]) points.push(end)

    return new LineString(points)
}

function addAccessNetworkLayer(map: Map, selectedPath: SegmentedPath, queryPoints: QueryPoint[]) {
    const style = new Style({
        stroke: new Stroke({
            color: 'rgba(143,183,241,0.9)',
            width: 5,
            lineDash: [1, 10],
            lineCap: 'round',
            lineJoin: 'round',
        }),
    })
    const layer = new VectorLayer({
        source: new VectorSource(),
    })
    layer.setStyle(style)
    
    // Get all unique waypoints from the path segments
    const waypoints: [number, number, number][] = [];
    
    if (selectedPath.segments && selectedPath.segments.length > 0) {
        // Add the first "from" point of the first segment
        waypoints.push(selectedPath.segments[0].from);
        
        // Add the "to" point of each segment
        selectedPath.segments.forEach(segment => {
            waypoints.push(segment.to);
        });
    }
    
    // Draw access lines to query points
    for (let i = 0; i < Math.min(waypoints.length, queryPoints.length); i++) {
        if (queryPoints[i] && queryPoints[i].isInitialized) {
            const start = fromLonLat([queryPoints[i].coordinate.lng, queryPoints[i].coordinate.lat])
            const end = fromLonLat(waypoints[i])
            layer.getSource()?.addFeature(new Feature(createBezierLineString(start, end)))
        }
    }
    
    layer.set(accessNetworkLayerKey, true)
    layer.setZIndex(1)
    map.addLayer(layer)
}

function addSelectedPathsLayer(map: Map, selectedPath: SegmentedPath, displayMode: PathDisplayMode) {
    const layer = new VectorLayer({
        source: new VectorSource(),
        opacity: 0.8,
        zIndex: 2,
    });
    
    // Add each segment as a separate feature with its own style
    if (selectedPath.segments) {
        selectedPath.segments.forEach(segment => {
            const feature = new Feature();
            const coordinates = segment.points.coordinates.map(c => fromLonLat(c));
            feature.setGeometry(new LineString(coordinates));
            
            // Apply mode-specific style for selected path
            feature.setStyle(getStyleForMode(segment.mode, true));
            
            layer.getSource()?.addFeature(feature);
            
            // Removed arrows in static mode as requested
        });
    }
    
    layer.set(selectedPathLayerKey, true);
    map.addLayer(layer);
}

function removeSelectPathInteractions(map: Map) {
    map.getInteractions()
        .getArray()
        .filter(i => i.get('gh:select_path_interaction'))
        .forEach(i => map.removeInteraction(i))
}
