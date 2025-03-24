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
import { createSvg } from '@/layers/createMarkerSVG'

const pathsLayerKey = 'pathsLayer'
const selectedPathLayerKey = 'selectedPathLayer'
const accessNetworkLayerKey = 'accessNetworkLayer'

export default function usePathsLayer(map: Map, paths: SegmentedPath[], selectedPath: SegmentedPath, queryPoints: QueryPoint[]) {
    const settings = useContext(SettingsContext);
    
    useEffect(() => {
        removeCurrentPathLayers(map)
        
        // Don't show unselected paths at all - only show the selected path
        // if (selectedPath && selectedPath.segments && selectedPath.segments.length > 0) {
        //     addUnselectedPathsLayer(
        //         map,
        //         paths.filter(p => p != selectedPath),
        //         settings.pathDisplayMode
        //     )
        // }
        
        // Always show selected path if available
        if (selectedPath && selectedPath.segments && selectedPath.segments.length > 0) {
            addSelectedPathsLayer(map, selectedPath, settings.pathDisplayMode)
            addAccessNetworkLayer(map, selectedPath, queryPoints)
        }
        
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
function getStyleForMode(mode: string, isSelected: boolean = false): Style {
    const color = getTransportModeColor(mode, isSelected);
    const width = getTransportModeWidth(mode, isSelected);
    const dashPattern = getTransportModeDash(mode);
    
    return new Style({
        stroke: new Stroke({
            color: color,
            width: width,
            lineDash: dashPattern,
            lineCap: 'round',
            lineJoin: 'round'
        })
    });
}

// Function to create a path with directional arrows
function addDirectionalPathFeature(source: VectorSource, segment: Segment, isSelected: boolean = false) {
    // Only proceed if segment.points exists
    if (!segment.points || segment.points.length < 2) {
        return;
    }
    
    // Create the main line feature
    const feature = new Feature();
    const coordinates = segment.points.map(c => fromLonLat(c));
    feature.setGeometry(new LineString(coordinates));
    
    // Apply base style for the line
    feature.setStyle(getStyleForMode(segment.mode, isSelected));
    
    // Add to vector source
    source.addFeature(feature);
    
    // Remove arrow features as they appear as black elements on the map
    // If we want to add directional indicators later, we can implement a better approach
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
    // Only create the layer if there are paths to display
    if (!paths || paths.length === 0) {
        return;
    }
    
    const layer = new VectorLayer({
        source: new VectorSource(),
        opacity: 0.7,
        zIndex: 1,
    });
    
    // Add each path's segments as separate features
    paths.forEach((path, pathIndex) => {
        if (!path.segments) return;
        
        path.segments.forEach((segment, segmentIndex) => {
            // Skip segments without valid points
            if (!segment || !segment.points || segment.points.length < 2) {
                return;
            }
            
            const feature = new Feature({
                pathIndex: pathIndex,
                segmentIndex: segmentIndex,
            });
            
            const coordinates = segment.points.map(c => fromLonLat(c));
            feature.setGeometry(new LineString(coordinates));
            
            // Apply mode-specific style (not selected, so isSelected = false)
            feature.setStyle(getStyleForMode(segment.mode, false));
            
            layer.getSource()?.addFeature(feature);
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
        if (e.selected && e.selected.length > 0) {
            const pathIndex = e.selected[0].getProperties().pathIndex;
            Dispatcher.dispatch(new SetSelectedPath(paths[pathIndex] as any));
        }
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
    
    // Get source and destination points from the first and last segments
    const waypoints: number[][] = [];
    
    if (selectedPath.segments && selectedPath.segments.length > 0) {
        // Get first segment source coordinates directly from points
        const firstSegment = selectedPath.segments[0];
        if (firstSegment.points && firstSegment.points.length > 0) {
            waypoints.push(firstSegment.points[0]);
        }
        
        // Get last segment destination coordinates directly from points
        const lastSegment = selectedPath.segments[selectedPath.segments.length - 1];
        if (lastSegment.points && lastSegment.points.length > 0) {
            waypoints.push(lastSegment.points[lastSegment.points.length - 1]);
        }
    }
    
    // Draw access lines to query points
    for (let i = 0; i < Math.min(waypoints.length, queryPoints.length); i++) {
        if (queryPoints[i] && queryPoints[i].isInitialized && waypoints[i]) {
            const start = fromLonLat([queryPoints[i].coordinate.lng, queryPoints[i].coordinate.lat]);
            const end = fromLonLat(waypoints[i]);
            layer.getSource()?.addFeature(new Feature(createBezierLineString(start, end)));
        }
    }
    
    layer.set(accessNetworkLayerKey, true);
    layer.setZIndex(1);
    map.addLayer(layer);
}

function addSelectedPathsLayer(map: Map, selectedPath: SegmentedPath, displayMode: PathDisplayMode) {
    // Only create the layer if there is a valid path to display
    if (!selectedPath || !selectedPath.segments || selectedPath.segments.length === 0) {
        return;
    }
    
    const layer = new VectorLayer({
        source: new VectorSource(),
        opacity: 1.0, // Full opacity for selected path
        zIndex: 2,    // Higher z-index to show on top
    });
    
    // Add each segment as a separate feature with its own style
    selectedPath.segments.forEach((segment, segmentIndex) => {
        // Skip segments without valid points
        if (!segment || !segment.points || segment.points.length < 2) {
            return;
        }
        
        const feature = new Feature();
        const coordinates = segment.points.map(c => fromLonLat(c));
        feature.setGeometry(new LineString(coordinates));
        
        // Apply mode-specific style for selected path
        feature.setStyle(getStyleForMode(segment.mode, true));
        
        layer.getSource()?.addFeature(feature);
        
        // Add stop markers at the end of the segment (except for the last segment)
        if (segmentIndex < selectedPath.segments.length - 1) {
            const endPoint = coordinates[coordinates.length - 1];
            
            // Create a marker at the end point of the segment
            const stopMarker = new Feature({
                geometry: new Point(endPoint)
            });
            
            // Get the solid icon color from the transport modes instead of the selected rgba color
            // This avoids issues with rgba colors in the marker SVG
            const normalizedMode = segment.mode?.toUpperCase() || 'default';
            let markerColor = 'rgb(118, 219, 255)'; // dark blue
            
            // Create a stop marker style
            stopMarker.setStyle(new Style({
                image: new Icon({
                    src: 'data:image/svg+xml;utf8,' + createSvg({
                        color: markerColor,
                        size: 24
                    }),
                    anchor: [0.5, 1], // Anchor point at the bottom center of the marker
                    scale: 1.1
                })
            }));
            
            // Add the marker to the layer
            layer.getSource()?.addFeature(stopMarker);
        }
    });
    
    layer.set(selectedPathLayerKey, true);
    map.addLayer(layer);
}

function removeSelectPathInteractions(map: Map) {
    map.getInteractions()
        .getArray()
        .filter(i => i.get('gh:select_path_interaction'))
        .forEach(i => map.removeInteraction(i))
}
