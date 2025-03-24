import { Action, ActionReceiver } from '@/stores/Dispatcher'
import { Map } from 'ol'
import { fromLonLat } from 'ol/proj'
import {
    InfoReceived,
    PathDetailsRangeSelected,
    RouteRequestSuccess,
    SetBBox,
    SetSelectedPath,
    ZoomMapToPoint,
} from '@/actions/Actions'
import RouteStore from '@/stores/RouteStore'
import { Bbox } from '@/api/graphhopper'
import { SegmentedPath, Segment } from '@/api/sarathi'

export default class MapActionReceiver implements ActionReceiver {
    readonly map: Map
    private readonly routeStore: RouteStore
    private readonly isSmallScreenQuery: () => boolean

    constructor(map: Map, routeStore: RouteStore, isSmallScreenQuery: () => boolean) {
        this.map = map
        this.routeStore = routeStore
        this.isSmallScreenQuery = isSmallScreenQuery
    }

    receive(action: Action) {
        // todo: port old ViewportStore.test.ts or otherwise test this
        const isSmallScreen = this.isSmallScreenQuery()
        if (action instanceof SetBBox) {
            // we estimate the map size to be equal to the window size. we don't know better at this point, because
            // the map has not been rendered for the first time yet
            fitBounds(this.map, action.bbox, isSmallScreen, [window.innerWidth, window.innerHeight])
        } else if (action instanceof ZoomMapToPoint) {
            let zoom = this.map.getView().getZoom()
            if (zoom == undefined || zoom < 8) zoom = 8
            this.map.getView().animate({
                zoom: zoom,
                center: fromLonLat([action.coordinate.lng, action.coordinate.lat]),
                duration: 400,
            })
        } else if (action instanceof RouteRequestSuccess) {
            // this assumes that always the first path is selected as result. One could use the
            // state of the routeStore as well, but then we would have to make sure that the route
            // store digests this action first, which our Dispatcher can't at the moment.
            if (action.result.data.routes.length > 0) {
                // Create bbox from the first route's segments
                const calculatedBBox = calculateBBox(action.result.data.routes[0])
                // minLon, minLat, maxLon, maxLat
                const widerBBox = [...calculatedBBox] as Bbox
                action.request.points.forEach(p => {
                    widerBBox[0] = Math.min(p[0], widerBBox[0])
                    widerBBox[1] = Math.min(p[1], widerBBox[1])
                    widerBBox[2] = Math.max(p[0], widerBBox[2])
                    widerBBox[3] = Math.max(p[1], widerBBox[3])
                })
                if (widerBBox[2] - widerBBox[0] < 0.001) {
                    widerBBox[0] -= 0.0005
                    widerBBox[2] += 0.0005
                }
                if (widerBBox[3] - widerBBox[1] < 0.001) {
                    widerBBox[1] -= 0.0005
                    widerBBox[3] += 0.0005
                }
                if (action.zoom) fitBounds(this.map, widerBBox, isSmallScreen)
            }
        } else if (action instanceof SetSelectedPath) {
            // Safely cast to SegmentedPath and calculate bbox
            const segmentedPath = action.path as SegmentedPath;
            const bbox = calculateBBox(segmentedPath);
            fitBounds(this.map, bbox, isSmallScreen);
        } else if (action instanceof PathDetailsRangeSelected) {
            // we either use the bbox from the path detail selection or go back to the route bbox when the path details
            // were deselected
            if (action.bbox) {
                fitBounds(this.map, action.bbox, isSmallScreen);
            } else if (this.routeStore.state.selectedPath.segments) {
                const bbox = calculateBBox(this.routeStore.state.selectedPath);
                fitBounds(this.map, bbox, isSmallScreen);
            }
            // if neither has a bbox just fall through to unchanged state
        } else if (action instanceof InfoReceived) {
            if (JSON.stringify(action.result.bbox) === '[-180,-90,180,90]') {
                // we play it safe in terms of initial page loading time and do nothing...
            } else {
                fitBounds(this.map, action.result.bbox, isSmallScreen)
            }
        }
    }
}

function fitBounds(map: Map, bbox: Bbox, isSmallScreen: boolean, mapSize?: number[]) {
    const sw = fromLonLat([bbox[0], bbox[1]]);
    const ne = fromLonLat([bbox[2], bbox[3]]);
    
    // Get the map size or fallback to window size
    const size = mapSize ? mapSize : map.getSize() || [window.innerWidth, window.innerHeight];
    const screenWidth = size[0];
    const screenHeight = size[1];
    
    // Calculate the diagonal of the bounding box in degrees
    const bboxDiagonal = Math.hypot(bbox[2] - bbox[0], bbox[3] - bbox[1]);
    
    // Calculate dynamic padding based on screen size and bbox size
    // For very small bounding boxes, use larger padding
    // For large bounding boxes, use smaller padding
    let paddingFactor = 0.1; // Base padding as 10% of screen dimension
    
    // Adjust padding factor based on bbox size (smaller bbox = larger padding)
    if (bboxDiagonal < 0.01) {
        paddingFactor = 0.25; // 25% padding for very small areas
    } else if (bboxDiagonal < 0.1) {
        paddingFactor = 0.20; // 20% padding for small areas
    } else if (bboxDiagonal < 0.5) {
        paddingFactor = 0.15; // 15% padding for medium areas
    }
    
    // Minimum padding to ensure there's always some space
    const minPadding = 20;
    
    if (isSmallScreen) {
        // For small screens, use even padding on all sides
        const padding = Math.max(minPadding, Math.round(screenHeight * paddingFactor));
        
        map.getView().fit([sw[0], sw[1], ne[0], ne[1]], {
            size: size,
            padding: [padding, padding, padding, padding]
        });
    } else {
        // For larger screens with sidebar, we need to account for the fixed sidebar (40% width)
        // Instead of trying to center in the remaining space (which creates an offset),
        // we'll use balanced padding on all sides of the viewable area
        
        // The available map width is 60% of screen width (remaining after 40% sidebar)
        const availableWidth = screenWidth * 0.6;
        
        // Calculate horizontal padding as a percentage of the available width
        const horizontalPadding = Math.max(minPadding, Math.round(availableWidth * paddingFactor));
        
        // Calculate vertical padding as a percentage of the screen height
        const verticalPadding = Math.max(minPadding, Math.round(screenHeight * paddingFactor));
        
        // Apply the fit with balanced padding
        map.getView().fit([sw[0], sw[1], ne[0], ne[1]], {
            size: [availableWidth, screenHeight], // Use available width for size calculation
            padding: [verticalPadding, horizontalPadding, verticalPadding, horizontalPadding]
        });
    }
}

const calculateBBox = (path: SegmentedPath): Bbox => {
    let minLon = 180;
    let minLat = 90;
    let maxLon = -180;
    let maxLat = -90;
    
    path.segments.forEach((segment: Segment) => {
        if (segment.points && segment.points.coordinates) {
            segment.points.coordinates.forEach((coord: number[]) => {
                minLon = Math.min(minLon, coord[0]);
                minLat = Math.min(minLat, coord[1]);
                maxLon = Math.max(maxLon, coord[0]);
                maxLat = Math.max(maxLat, coord[1]);
            });
        }
    });
    
    // Return the bbox in the expected format
    return [minLon, minLat, maxLon, maxLat];
};
