import React from 'react'
import { coordinateToText } from '@/Converters'
import styles from './ContextMenuContent.module.css'
import QueryStore, { Coordinate, QueryPoint, QueryPointType } from '@/stores/QueryStore'
import Dispatcher from '@/stores/Dispatcher'
import { AddPoint, SetPoint, ZoomMapToPoint } from '@/actions/Actions'
import { RouteStoreState } from '@/stores/RouteStore'
import { findNextWayPoint } from '@/map/findNextWayPoint'
import { tr } from '@/translation/Translation'
import { MarkerComponent } from '@/map/Marker'
import { Position } from 'geojson'
import { SegmentedPath, Segment } from '@/api/sarathi'

export function ContextMenuContent({
    coordinate,
    queryPoints,
    route,
    onSelect,
}: {
    coordinate: Coordinate
    queryPoints: QueryPoint[]
    route: RouteStoreState
    onSelect: () => void
}) {
    const dispatchAddPoint = function (coordinate: Coordinate) {
        onSelect()
        Dispatcher.dispatch(new AddPoint(queryPoints.length, coordinate, true, false))
    }

    const dispatchSetPoint = function (point: QueryPoint, coordinate: Coordinate) {
        onSelect()
        Dispatcher.dispatch(
            new SetPoint(
                {
                    ...point,
                    coordinate: coordinate,
                    queryText: coordinateToText(coordinate),
                    isInitialized: true,
                },
                false
            )
        )
    }

    const setViaPoint = function (points: QueryPoint[], route: RouteStoreState) {
        const viaPoints = points.filter(point => point.type === QueryPointType.Via)
        const point = viaPoints.find(point => !point.isInitialized)
        onSelect()

        if (point) {
            dispatchSetPoint(point, coordinate)
        } else {
            // Collect all coordinates from all segments of all paths
            const routes = route.routingResult.data.routes.map(path => {
                // Flatten all segment coordinates into a single array
                const allCoordinates: Position[] = [];
                path.segments.forEach(segment => {
                    if (segment.points && segment.points.length > 0) {
                        allCoordinates.push(...segment.points);
                    }
                });
                
                return {
                    coordinates: allCoordinates.map((pos: Position) => {
                        return { lat: pos[1], lng: pos[0] }
                    }),
                    wayPoints: allCoordinates.map((pos: Position) => {
                        return { lat: pos[1], lng: pos[0] }
                    }),
                }
            })
            
            // note that we can use the index returned by findNextWayPoint no matter which route alternative was found
            // to be closest to the clicked location, because for every route the n-th snapped_waypoint corresponds to
            // the n-th query point
            const index = findNextWayPoint(routes, coordinate).nextWayPoint
            Dispatcher.dispatch(new AddPoint(index, coordinate, true, false))
        }
    }

    const disableViaPoint = function (points: QueryPoint[]) {
        const viaPoints = points.filter(point => point.type === QueryPointType.Via)
        if (viaPoints.length !== 0) {
            return viaPoints.every(point => !point.isInitialized)
        } else {
            return false
        }
    }

    // This is a workaround to make sure that clicks on the context menu entries are not handled by the underlying map.
    // Without this a click on the menu entries would e.g. close the menu without triggering the selected action.
    // https://github.com/openlayers/openlayers/issues/6948#issuecomment-374915823
    const convertToClick = (e: React.MouseEvent) => {
        const evt = new MouseEvent('click', { bubbles: true })
        evt.stopPropagation = () => {}
        e.target.dispatchEvent(evt)
    }
    const showAddLocation = queryPoints.length >= 2 && queryPoints[1].isInitialized

    return (
        <div className={styles.wrapper} onMouseUp={convertToClick}>
            <button
                style={{ borderTop: '1px solid lightgray', paddingTop: '10px' }}
                className={styles.entry}
                onClick={() => {
                    if (queryPoints.length > 0) Dispatcher.dispatch(new SetPoint(queryPoints[0], true))
                }}
            >
                <span>{tr('zoom_to_route')}</span>
            </button>
            <button
                className={styles.entry}
                onClick={() => {
                    onSelect()
                    Dispatcher.dispatch(new ZoomMapToPoint(coordinate))
                }}
            >
                {tr('center_map')}
            </button>
        </div>
    )
}

// Add a function to calculate distance from point to segment
function distancePointToSegment(point: Coordinate, segment: Segment): number {
    // If segment doesn't have points, return a large distance
    if (!segment || !segment.points || segment.points.length < 2) {
        return Number.MAX_VALUE;
    }
    
    // Calculate the minimum distance from point to any segment of the path
    let minDistance = Number.MAX_VALUE;
    
    for (let i = 0; i < segment.points.length - 1; i++) {
        const start = segment.points[i];
        const end = segment.points[i + 1];
        
        // Calculate distance from point to line segment
        const distance = distanceToLineSegment(
            point.lng, point.lat,
            start[0], start[1],
            end[0], end[1]
        );
        
        minDistance = Math.min(minDistance, distance);
    }
    
    return minDistance;
}

// Helper function to calculate distance from point to line segment
function distanceToLineSegment(
    px: number, py: number,
    x1: number, y1: number,
    x2: number, y2: number
): number {
    const A = px - x1;
    const B = py - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const len_sq = C * C + D * D;
    let param = -1;
    
    if (len_sq !== 0) {
        param = dot / len_sq;
    }

    let xx, yy;

    if (param < 0) {
        xx = x1;
        yy = y1;
    } else if (param > 1) {
        xx = x2;
        yy = y2;
    } else {
        xx = x1 + param * C;
        yy = y1 + param * D;
    }

    const dx = px - xx;
    const dy = py - yy;
    
    // Use Euclidean distance
    return Math.sqrt(dx * dx + dy * dy);
}
