import React, { useEffect, useState } from 'react'
import PathDetails from '@/pathDetails/PathDetails'
import styles from './App.module.css'
import {
    getApiInfoStore,
    getSettingsStore,
    getErrorStore,
    getMapFeatureStore,
    getMapOptionsStore,
    getQueryStore,
    getRouteStore,
} from '@/stores/Stores'
import MapComponent from '@/map/MapComponent'
import { ApiInfo } from '@/api/graphhopper'
import MapOptions from '@/map/MapOptions'
import MobileSidebar from '@/sidebar/MobileSidebar'
import { useMediaQuery } from 'react-responsive'
import RoutingResults from '@/sidebar/RoutingResults'
import PoweredBy from '@/sidebar/PoweredBy'
import { QueryStoreState, RequestState } from '@/stores/QueryStore'
import { RouteStoreState } from '@/stores/RouteStore'
import { MapOptionsStoreState } from '@/stores/MapOptionsStore'
import { ErrorStoreState } from '@/stores/ErrorStore'
import Search from '@/sidebar/search/Search'
import ErrorMessage from '@/sidebar/ErrorMessage'
import useBackgroundLayer from '@/layers/UseBackgroundLayer'
import useQueryPointsLayer from '@/layers/UseQueryPointsLayer'
import usePathsLayer from '@/layers/UsePathsLayer'
import ContextMenu from '@/layers/ContextMenu'
import usePathDetailsLayer from '@/layers/UsePathDetailsLayer'
import PathDetailPopup from '@/layers/PathDetailPopup'
import { Map } from 'ol'
import { getMap } from '@/map/map'
import CustomModelBox from '@/sidebar/CustomModelBox'
import useRoutingGraphLayer from '@/layers/UseRoutingGraphLayer'
import MapFeaturePopup from '@/layers/MapFeaturePopup'
import useUrbanDensityLayer from '@/layers/UseUrbanDensityLayer'
import useMapBorderLayer from '@/layers/UseMapBorderLayer'
import { ShowDistanceInMilesContext } from '@/ShowDistanceInMilesContext'
import RoutingProfiles from '@/sidebar/search/routingProfiles/RoutingProfiles'

export const POPUP_CONTAINER_ID = 'popup-container'
export const SIDEBAR_CONTENT_ID = 'sidebar-content'

export default function App() {
    const [settings, setSettings] = useState(getSettingsStore().state)
    const [query, setQuery] = useState(getQueryStore().state)
    const [info, setInfo] = useState(getApiInfoStore().state)
    const [route, setRoute] = useState(getRouteStore().state)
    const [error, setError] = useState(getErrorStore().state)
    const [mapOptions, setMapOptions] = useState(getMapOptionsStore().state)
    const [mapFeatures, setMapFeatures] = useState(getMapFeatureStore().state)

    const map = getMap()

    useEffect(() => {
        const onSettingsChanged = () => setSettings(getSettingsStore().state)
        const onQueryChanged = () => setQuery(getQueryStore().state)
        const onInfoChanged = () => setInfo(getApiInfoStore().state)
        const onRouteChanged = () => setRoute(getRouteStore().state)
        const onErrorChanged = () => setError(getErrorStore().state)
        const onMapOptionsChanged = () => setMapOptions(getMapOptionsStore().state)
        const onMapFeaturesChanged = () => setMapFeatures(getMapFeatureStore().state)

        getSettingsStore().register(onSettingsChanged)
        getQueryStore().register(onQueryChanged)
        getApiInfoStore().register(onInfoChanged)
        getRouteStore().register(onRouteChanged)
        getErrorStore().register(onErrorChanged)
        getMapOptionsStore().register(onMapOptionsChanged)
        getMapFeatureStore().register(onMapFeaturesChanged)

        onSettingsChanged()
        onQueryChanged()
        onInfoChanged()
        onRouteChanged()
        onErrorChanged()
        onMapOptionsChanged()
        onMapFeaturesChanged()

        return () => {
            getSettingsStore().register(onSettingsChanged)
            getQueryStore().deregister(onQueryChanged)
            getApiInfoStore().deregister(onInfoChanged)
            getRouteStore().deregister(onRouteChanged)
            getErrorStore().deregister(onErrorChanged)
            getMapOptionsStore().deregister(onMapOptionsChanged)
            getMapFeatureStore().deregister(onMapFeaturesChanged)
        }
    }, [])

    // our different map layers
    useBackgroundLayer(map, mapOptions.selectedStyle)
    useMapBorderLayer(map, info.bbox)
    useRoutingGraphLayer(map, mapOptions.routingGraphEnabled)
    useUrbanDensityLayer(map, mapOptions.urbanDensityEnabled)
    usePathsLayer(map, route.routingResult.paths, route.selectedPath)
    useQueryPointsLayer(map, query.queryPoints)
    usePathDetailsLayer(map)

    const isSmallScreen = useMediaQuery({ query: '(max-width: 44rem)' })
    return (
        <ShowDistanceInMilesContext.Provider value={settings.showDistanceInMiles}>
            <div className={styles.appWrapper}>
                <PathDetailPopup map={map}/>
                <ContextMenu map={map} route={route} queryPoints={query.queryPoints} />
                <MapFeaturePopup map={map} point={mapFeatures.point} properties={mapFeatures.properties} />
                {isSmallScreen ? (
                    <SmallScreenLayout
                        query={query}
                        route={route}
                        map={map}
                        mapOptions={mapOptions}
                        error={error}
                        info={info}
                    />
                ) : (
                    <LargeScreenLayout
                        query={query}
                        route={route}
                        map={map}
                        mapOptions={mapOptions}
                        error={error}
                        info={info}
                    />
                )}
            </div>
        </ShowDistanceInMilesContext.Provider>
    )
}

interface LayoutProps {
    query: QueryStoreState
    route: RouteStoreState
    map: Map
    mapOptions: MapOptionsStoreState
    error: ErrorStoreState
    info: ApiInfo
}

function LargeScreenLayout({ query, route, map, error, mapOptions, info }: LayoutProps) {
    return (
        <>
            <div className={styles.sidebar}>
                <div className={styles.sidebarContent} id={SIDEBAR_CONTENT_ID}>
                    <RoutingProfiles
                        routingProfiles={info.profiles}
                        selectedProfile={query.routingProfile}
                        customModelAllowed={true}
                        customModelEnabled={query.customModelEnabled}
                    />
                    <CustomModelBox
                        enabled={query.customModelEnabled}
                        encodedValues={info.encoded_values}
                        initialCustomModelStr={query.initialCustomModelStr}
                        queryOngoing={query.currentRequest.subRequests[0]?.state === RequestState.SENT}
                    />
                    <Search points={query.queryPoints} />
                    <div>{!error.isDismissed && <ErrorMessage error={error} />}</div>
                    <RoutingResults
                        paths={route.routingResult.paths}
                        selectedPath={route.selectedPath}
                        currentRequest={query.currentRequest}
                        profile={query.routingProfile.name}
                    />
                    <div>
                        <PoweredBy />
                    </div>
                </div>
            </div>
            <div className={styles.popupContainer} id={POPUP_CONTAINER_ID} />
            <div className={styles.map}>
                <MapComponent map={map} />
            </div>
            <div className={styles.mapOptions}>
                <MapOptions {...mapOptions} />
            </div>

            <div className={styles.pathDetails}>
                <PathDetails selectedPath={route.selectedPath} />
            </div>
        </>
    )
}

function SmallScreenLayout({ query, route, map, error, mapOptions, info }: LayoutProps) {
    return (
        <>
            <div className={styles.smallScreenSidebar}>
                <MobileSidebar info={info} query={query} route={route} error={error} />
            </div>
            <div className={styles.smallScreenMap}>
                <MapComponent map={map} />
            </div>
            <div className={styles.smallScreenMapOptions}>
                <div className={styles.smallScreenMapOptionsContent}>
                    <MapOptions {...mapOptions} />
                </div>
            </div>

            <div className={styles.smallScreenRoutingResult}>
                <RoutingResults
                    paths={route.routingResult.paths}
                    selectedPath={route.selectedPath}
                    currentRequest={query.currentRequest}
                    profile={query.routingProfile.name}
                />
            </div>

            <div className={styles.smallScreenPoweredBy}>
                <PoweredBy />
            </div>
        </>
    )
}
