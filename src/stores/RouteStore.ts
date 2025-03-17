import Store from '@/stores/Store'
import { Action } from '@/stores/Dispatcher'
import { ClearPoints, ClearRoute, RemovePoint, RouteRequestSuccess, SetPoint, SetSelectedPath } from '@/actions/Actions'
import { Path, RoutingResult } from '@/api/graphhopper'
import { SegmentedPath, SegmentedRoutingResult } from '@/api/sarathi'
import { convertPathToSegmented, convertToSegmentedPaths } from '@/api/DataConverter'

export interface RouteStoreState {
    routingResult: SegmentedRoutingResult
    selectedPath: SegmentedPath
}

export default class RouteStore extends Store<RouteStoreState> {
    private static getEmptyPath(): SegmentedPath {
        return {
            bbox: undefined,
            distance: 0,
            time: 0,
            points_encoded: false,
            points_encoded_multiplier: 1e5,
            segments: []
        };
    }

    constructor() {
        super(RouteStore.getInitialState())
    }

    reduce(state: RouteStoreState, action: Action): RouteStoreState {
        if (action instanceof RouteRequestSuccess) {
            return this.reduceRouteReceived(state, action)
        } else if (action instanceof SetSelectedPath) {
            // Convert the selected path to segmented format if it's not already
            const segmentedPath = 'segments' in action.path 
                ? action.path as SegmentedPath
                : convertPathToSegmented(action.path as Path);
                
            return {
                ...state,
                selectedPath: segmentedPath,
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
                paths: [],
            },
            selectedPath: RouteStore.getEmptyPath(),
        }
    }

    private reduceRouteReceived(state: RouteStoreState, action: RouteRequestSuccess) {
        if (action.result.paths && action.result.paths.length > 0) {
            console.log("Unsegmented Routing Result JSON:", JSON.stringify(action.result));
            // Convert all paths to segmented format
            const segmentedResult = convertToSegmentedPaths(action.result);
            console.log("Segmented Routing Result JSON:", JSON.stringify(segmentedResult));
            return {
                routingResult: segmentedResult,
                selectedPath: segmentedResult.paths[0],
            }
        }
        return RouteStore.getInitialState()
    }

    private static containsPaths(paths: any[]) {
        return paths.length > 0
    }
}
