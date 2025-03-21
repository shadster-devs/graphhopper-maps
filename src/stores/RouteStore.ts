import Store from '@/stores/Store'
import { Action } from '@/stores/Dispatcher'
import { ClearPoints, ClearRoute, RemovePoint, RouteRequestSuccess, SetPoint, SetSelectedPath } from '@/actions/Actions'
import { SegmentedPath, SegmentedRoutingResult } from '@/api/sarathi'
import { LineString } from 'geojson'

export interface RouteStoreState {
    routingResult: SegmentedRoutingResult
    selectedPath: SegmentedPath
}

export default class RouteStore extends Store<RouteStoreState> {
    private static getEmptyPath(): SegmentedPath {
        return {
            summary: '',
            travelDuration: 0,
            price: {
                price: 0,
                currency: ''
            },
            segments: [],
            distance: 0,
            pathId: ''
        };
    }

    constructor() {
        super(RouteStore.getInitialState())
    }

    reduce(state: RouteStoreState, action: Action): RouteStoreState {
        if (action instanceof RouteRequestSuccess) {
            return this.reduceRouteReceived(state, action)
        } else if (action instanceof SetSelectedPath) {
            return {
                ...state,
                selectedPath: action.path as SegmentedPath,
            }
        } else if (
            action instanceof SetPoint ||
            action instanceof ClearRoute ||
            action instanceof ClearPoints ||
            action instanceof RemovePoint
        ) {
            return RouteStore.getInitialState()
        }
        return state
    }

    private static getInitialState(): RouteStoreState {
        return {
            routingResult: {
                success: false,
                data: {
                    header: '',
                    from: {
                        place: '',
                        id: '',
                        sid: 0,
                        type: 0,
                        cc: ''
                    },
                    to: {
                        place: '',
                        id: '',
                        sid: 0,
                        type: 0,
                        cc: ''
                    },
                    count: 0,
                    routes: []
                }
            },
            selectedPath: RouteStore.getEmptyPath(),
        }
    }

    private reduceRouteReceived(state: RouteStoreState, action: RouteRequestSuccess): RouteStoreState {
        // Handle the new Sarathi API response format
        if (action.result.success && action.result.data?.routes && action.result.data.routes.length > 0) {
            console.log("Sarathi API Response:", JSON.stringify(action.result));

            // Ensure each segment has a points property
            const routesWithPoints = action.result.data.routes.map(route => {
                const segmentsWithPoints = route.segments.map(segment => {
                    // If points is empty, initialize with source and destination geo coordinates
                    if (!segment.points && segment.source.geo && segment.destination.geo) {
                        segment.points = {
                            type: 'LineString',
                            coordinates: [
                                [segment.source.geo.lng, segment.source.geo.lat, 0],
                                [segment.destination.geo.lng, segment.destination.geo.lat, 0]
                            ]
                        } as LineString;
                    }
                    return segment;
                });
                
                return {
                    ...route,
                    segments: segmentsWithPoints
                };
            });

            const result = {
                ...action.result,
                data: {
                    ...action.result.data,
                    routes: routesWithPoints
                }
            };

            return {
                routingResult: result,
                selectedPath: result.data.routes[0],
            }
        }
        return RouteStore.getInitialState()
    }

    private static containsPaths(routes: any[]) {
        return routes.length > 0
    }
}
