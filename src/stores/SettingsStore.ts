import Store from '@/stores/Store'
import { Action } from '@/stores/Dispatcher'
import { SetCustomModelEnabled, UpdateSettings } from '@/actions/Actions'

// Define path display modes enum
export enum PathDisplayMode {
    Dynamic = 'dynamic',
    Static = 'static'
}

export interface Settings {
    showDistanceInMiles: boolean
    drawAreasEnabled: boolean
    gpxExportRte: boolean
    gpxExportWpt: boolean
    gpxExportTrk: boolean
    showAnimations: boolean
    isScreenshot: boolean
    pathDisplayMode: PathDisplayMode
}

export const defaultSettings: Settings = {
    showDistanceInMiles: false,
    drawAreasEnabled: false,
    gpxExportRte: false,
    gpxExportWpt: false,
    gpxExportTrk: true,
    showAnimations: true,
    isScreenshot: false,
    pathDisplayMode: PathDisplayMode.Dynamic
}

export default class SettingsStore extends Store<Settings> {
    constructor() {
        super(defaultSettings)
    }

    reduce(state: Settings, action: Action): Settings {
        if (action instanceof SetCustomModelEnabled) {
            if (!action.enabled && state.drawAreasEnabled)
                return {
                    ...state,
                    drawAreasEnabled: false,
                }
        } else if (action instanceof UpdateSettings) {
            return {
                ...state,
                ...action.updatedSettings,
            }
        }
        return state
    }
}
