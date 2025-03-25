import { useEffect, useState, useContext, useCallback } from 'react'
import styles from './App.module.css'
import {
    getApiInfoStore,
    getErrorStore,
    getMapFeatureStore,
    getMapOptionsStore,
    getPathDetailsStore,
    getPOIsStore,
    getQueryStore,
    getRouteStore,
    getSettingsStore,
} from '@/stores/Stores'
import MapComponent from '@/map/MapComponent'
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
import usePathAnimations from '@/layers/UsePathAnimations'
import ContextMenu from '@/layers/ContextMenu'
import { Map } from 'ol'
import { getMap } from '@/map/map'
import CustomModelBox from '@/sidebar/CustomModelBox'
import useRoutingGraphLayer from '@/layers/UseRoutingGraphLayer'
import useMapBorderLayer from '@/layers/UseMapBorderLayer'
import RoutingProfiles from '@/sidebar/search/routingProfiles/RoutingProfiles'
import MapPopups from '@/map/MapPopups'
import Menu from '@/sidebar/menu.svg'
import Cross from '@/sidebar/times-solid.svg'
import PlainButton from '@/PlainButton'
import useAreasLayer from '@/layers/UseAreasLayer'
import useExternalMVTLayer from '@/layers/UseExternalMVTLayer'
import LocationButton from '@/map/LocationButton'
import { SettingsContext } from '@/contexts/SettingsContext'
import usePOIsLayer from '@/layers/UsePOIsLayer'
import { TRANSPORT_MODE_COLORS, TRANSPORT_MODE_DASH_PATTERNS, TRANSPORT_MODE_LABELS, TRANSPORT_MODES, TRANSPORT_MODE_WIDTHS, SELECTED_WIDTH_MULTIPLIER } from '@/constants/TransportModes'
import { fromLonLat } from 'ol/proj'
import useStaticTransportIcons from '@/layers/UseStaticTransportIcons'
import { PathDisplayMode } from '@/stores/SettingsStore'
import { ApiImpl } from '@/api/Api'
import { tr } from './translation/Translation'
import RoutingDetailsPanel from '@/map/RoutingDetailsPanel'

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
    const [pois, setPOIs] = useState(getPOIsStore().state)
    
    // State to track if the floating modal should be visible
    const [showRouteModal, setShowRouteModal] = useState(false)

    const map = getMap()

    // Remove the manual map center adjustment - we don't need it with fixed sidebar layout
    useEffect(() => {
        // Just make sure the map size is updated when component mounts or window is resized
        const updateMapSize = () => {
            if (map && !settings.isScreenshot) {
                map.updateSize();
            }
        };
        
        // Update size when component mounts
        updateMapSize();
        
        // Add resize listener
        window.addEventListener('resize', updateMapSize);
        
        // Clean up
        return () => {
            window.removeEventListener('resize', updateMapSize);
        };
    }, [map, settings.isScreenshot]);
    
    // Show the floating modal when a route is selected
    useEffect(() => {
        // Check if we have a valid route with segments
        if (route.selectedPath && route.selectedPath.segments && route.selectedPath.segments.length > 0) {
            console.log("Route selected, should show modal", route.selectedPath);
            setShowRouteModal(true);
        } else {
            setShowRouteModal(false);
        }
    }, [route.selectedPath]);

    useEffect(() => {
        const onSettingsChanged = () => setSettings(getSettingsStore().state)
        const onQueryChanged = () => setQuery(getQueryStore().state)
        const onInfoChanged = () => setInfo(getApiInfoStore().state)
        const onRouteChanged = () => {
            const routeState = getRouteStore().state;
            setRoute(routeState);
        }
        const onErrorChanged = () => setError(getErrorStore().state)
        const onMapOptionsChanged = () => setMapOptions(getMapOptionsStore().state)
        const onMapFeaturesChanged = () => setMapFeatures(getMapFeatureStore().state)
        const onPOIsChanged = () => setPOIs(getPOIsStore().state)

        getSettingsStore().register(onSettingsChanged)
        getQueryStore().register(onQueryChanged)
        getApiInfoStore().register(onInfoChanged)
        getRouteStore().register(onRouteChanged)
        getErrorStore().register(onErrorChanged)
        getMapOptionsStore().register(onMapOptionsChanged)
        getMapFeatureStore().register(onMapFeaturesChanged)
        getPOIsStore().register(onPOIsChanged)

        onQueryChanged()
        onInfoChanged()
        onRouteChanged()
        onErrorChanged()
        onMapOptionsChanged()
        onMapFeaturesChanged()
        onPOIsChanged()

        return () => {
            getSettingsStore().register(onSettingsChanged)
            getQueryStore().deregister(onQueryChanged)
            getApiInfoStore().deregister(onInfoChanged)
            getRouteStore().deregister(onRouteChanged)
            getErrorStore().deregister(onErrorChanged)
            getMapOptionsStore().deregister(onMapOptionsChanged)
            getMapFeatureStore().deregister(onMapFeaturesChanged)
            getPOIsStore().deregister(onPOIsChanged)
        }
    }, [])

    // our different map layers
    useBackgroundLayer(map, mapOptions.selectedStyle)
    useExternalMVTLayer(map, mapOptions.externalMVTEnabled)
    // useMapBorderLayer(map, info.bbox)
    useAreasLayer(map, settings.drawAreasEnabled, query.customModelStr, query.customModelEnabled)
    useRoutingGraphLayer(map, mapOptions.routingGraphEnabled)
    usePathsLayer(map, route.routingResult.data.routes, route.selectedPath, query.queryPoints)
    useQueryPointsLayer(map, query.queryPoints)
    usePOIsLayer(map, pois)
    
    // Conditionally use either animated or static icons based on the display mode
    if (settings.pathDisplayMode === PathDisplayMode.Dynamic) {
        // Add animated icons that move along the path segments (only in dynamic mode)
        usePathAnimations(map, route.selectedPath, settings)
    } else if (settings.pathDisplayMode === PathDisplayMode.Static) {
        // Use static icons positioned at the midpoint of each segment (in status mode)
        useStaticTransportIcons(map, route.selectedPath)
    }
    
    const url = new URL(window.location.href)

    if (settings.isScreenshot) {
        map.getView().setConstrainResolution(true);
    
        // Get all point parameters from URL
        const pointParams = url.searchParams.getAll('point');
        const points = pointParams.map(param => {
            const [lat, lng] = param.split('_')[0].split(',').map(parseFloat);
            return !isNaN(lat) && !isNaN(lng) ? [lat, lng] : null;
        }).filter((point): point is [number, number] => point !== null);
    
        if (points.length > 0) {
            // Calculate centroid
            const centroid = points.reduce(([sumLat, sumLng], [lat, lng]) => [sumLat + lat, sumLng + lng], [0, 0])
                .map(sum => sum / points.length);
            
            // Get bounding box
            const lats = points.map(p => p[0]), lngs = points.map(p => p[1]);
            const bbox = [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)];
    
            // Get window dimensions
            const windowWidth = window.innerWidth;
            const windowHeight = window.innerHeight;
            
            // Calculate padding based on window size (larger padding for larger screens)
            const basePadding = Math.min(windowWidth, windowHeight) * 0.05; // 5% of smallest dimension
            const padding = Math.max(20, Math.min(100, basePadding));
            
            // Fit view to bounding box
            const sw = fromLonLat([bbox[0], bbox[1]]);
            const ne = fromLonLat([bbox[2], bbox[3]]);
            map.getView().fit([sw[0], sw[1], ne[0], ne[1]], { 
                padding: [padding, padding, padding, padding],
                size: [windowWidth, windowHeight]
            });
            
            // Adjust zoom based on diagonal length and screen size
            const diagonal = Math.hypot(bbox[2] - bbox[0], bbox[3] - bbox[1]);
            const screenDiagonal = Math.hypot(windowWidth, windowHeight);
            
            // Only override zoom if the automatic fit isn't appropriate
            if (diagonal < 0.05 || (screenDiagonal > 1000 && diagonal < 0.2)) {
                // Calculate zoom dynamically using a logarithmic scale
                // This provides smoother transitions between zoom levels
                // log base is chosen to give appropriate zoom levels across different scales
                const baseZoom = 11; // Maximum zoom level for very small areas
                const minZoom = 8;   // Minimum zoom level for larger areas
                
                // Calculate zoom level using logarithmic scale
                // smaller diagonal = higher zoom
                let calculatedZoom;
                if (diagonal <= 0.001) {
                    calculatedZoom = baseZoom;
                } else {
                    // Using natural log with scaling factors to get appropriate zoom levels
                    calculatedZoom = baseZoom - (Math.log(diagonal * 1000) / Math.log(4));
                }
                
                // Ensure zoom stays within reasonable bounds
                const zoom = Math.max(minZoom, Math.min(baseZoom, Math.round(calculatedZoom)));
                
                // Apply zoom
                map.getView().setZoom(zoom);
            }
        }
    
        // Remove zoom controls in screenshot mode
        map.getControls().set('zoom', false);
        map.getControls().set('zoomOptions', undefined);
    }
    
    return (
        <SettingsContext.Provider value={settings}>
            <div className={styles.appWrapper}>
                {!settings.isScreenshot && (
                    <>
                        <MapPopups
                            map={map}
                            mapFeatures={mapFeatures}
                            poiState={pois}
                            query={query}
                        />
                        <ContextMenu map={map} route={route} queryPoints={query.queryPoints} />
                    </>
                )}
                <LargeScreenLayout
                    query={query}
                    route={route}
                    map={map}
                    mapOptions={mapOptions}
                    error={error}
                    encodedValues={info.encoded_values}
                    drawAreas={settings.drawAreasEnabled}
                    showRouteModal={showRouteModal}
                />
            </div>
        </SettingsContext.Provider>
    )
}

interface LayoutProps {
    query: QueryStoreState
    route: RouteStoreState
    map: Map
    mapOptions: MapOptionsStoreState
    error: ErrorStoreState
    encodedValues: object[]
    drawAreas: boolean
    showRouteModal: boolean
}

function TransportModeLegend({ route }: { route: RouteStoreState }) {
    // Always return null to hide the legend as requested
    return null;
    
    // Original code below is kept for reference but never executes
    /*
    // Get access to the settings context to check if screenshot mode is enabled
    const settings = useContext(SettingsContext)
    
    // Don't show the legend if in screenshot mode
    if (settings.isScreenshot) {
        return null;
    }
    
    // Only show the legend if we have an active route with segments
    const hasSegments = route.selectedPath.segments && route.selectedPath.segments.length > 0;
    
    if (!hasSegments) {
        return null;
    }
    
    const legendStyle = {
        position: 'absolute' as const,
        bottom: '20px',
        right: '20px',
        backgroundColor: 'white',
        padding: '10px',
        borderRadius: '5px',
        boxShadow: '0 0 10px rgba(0,0,0,0.2)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '8px',
        fontSize: '12px',
        maxWidth: '175px',
    };

    const legendItemStyle = {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
    };

    // Custom CSS for each mode since CSS patterns are complex to generalize
    const getLineStyle = (mode: string) => {
        // Get the appropriate height for this mode from our constants
        const height = TRANSPORT_MODE_WIDTHS[mode as keyof typeof TRANSPORT_MODE_WIDTHS] || TRANSPORT_MODE_WIDTHS.default;
        
        switch(mode) {
            case 'FLIGHTS':
                return {
                    width: '40px',
                    height: `${height}px`,
                    background: `repeating-linear-gradient(to right, ${TRANSPORT_MODE_COLORS.FLIGHTS.selected} 0px, ${TRANSPORT_MODE_COLORS.FLIGHTS.selected} 5px, transparent 5px, transparent 10px)`,
                    borderRadius: '2px'
                };
            case 'RAILS':
                return {
                    width: '40px',
                    height: `${height}px`,
                    background: `repeating-linear-gradient(to right, ${TRANSPORT_MODE_COLORS.RAILS.selected} 0px, ${TRANSPORT_MODE_COLORS.RAILS.selected} 10px, transparent 10px, transparent 15px)`,
                    borderRadius: '2px'
                };
            case 'BUS':
                return {
                    width: '40px',
                    height: `${height}px`,
                    backgroundColor: TRANSPORT_MODE_COLORS.BUS.selected,
                    borderRadius: '2px'
                };
            case 'CAB':
                return {
                    width: '40px',
                    height: `${height}px`,
                    backgroundColor: TRANSPORT_MODE_COLORS.CAB.selected,
                    borderRadius: '2px'
                };
            default:
                return {
                    width: '40px',
                    height: `${height}px`,
                    backgroundColor: 'gray',
                    borderRadius: '2px'
                };
        }
    };

    // Get unique transport modes from the selected path
    const getUniqueModes = () => {
        if (!route.selectedPath.segments) return [];
        
        // Get the modes and normalize them to our standard keys
        const modes = route.selectedPath.segments.map(segment => {
            const mode = segment.mode?.toUpperCase() || '';
            if (mode === 'FLIGHTS' || mode === 'FLIGHTS') return 'FLIGHTS';
            if (mode === 'RAILS' || mode === 'RAIL' || mode === 'TRAIN') return 'RAILS';
            if (mode === 'BUS') return 'BUS';
            if (mode === 'CAB' || mode === 'TAXI') return 'CAB';
            return mode;
        });
        
        // Get unique modes to avoid duplicates
        return [...new Set(modes)];
    };
    
    const uniqueModes = getUniqueModes();
    
    return (
        <div style={legendStyle}>
            <div style={{ fontWeight: 'bold', marginBottom: '5px', fontSize: '13px' }}>Transport Modes</div>
            {uniqueModes.map((mode) => (
                <div key={mode} style={legendItemStyle}>
                    <div style={getLineStyle(mode)}></div>
                    <span>{TRANSPORT_MODE_LABELS[mode as keyof typeof TRANSPORT_MODE_LABELS] || mode}</span>
                </div>
            ))}
        </div>
    );
    */
}

function LargeScreenLayout({ query, route, map, error, mapOptions, encodedValues, drawAreas, showRouteModal }: LayoutProps) {
    const [showSidebar, setShowSidebar] = useState(true)
    // State to track if the floating modal should be closed manually
    const [hideRouteModal, setHideRouteModal] = useState(false)
    
    // Get access to the settings context to check if screenshot mode is enabled
    const settings = useContext(SettingsContext)
    
    // Reset modal visibility when route changes
    useEffect(() => {
        console.log("Route changed in layout, resetting hideRouteModal");
        setHideRouteModal(false);
    }, [route.selectedPath]);
    
    // Handler to close the modal
    const handleCloseModal = useCallback(() => {
        console.log("Modal close requested");
        setHideRouteModal(true);
    }, []);
    
    // Log when props change
    useEffect(() => {
        console.log("Layout props updated", { 
            showRouteModal, 
            showSidebar, 
            hideRouteModal,
            hasRoute: route.selectedPath && route.selectedPath.segments && route.selectedPath.segments.length > 0
        });
    }, [showRouteModal, showSidebar, hideRouteModal, route.selectedPath]);
    
    // In screenshot mode, don't show any UI components
    if (settings.isScreenshot) {
        return (
            <>
                <div className={styles.map} style={{ padding: 0 }}>
                    <div className={styles.mapContainer} style={{ borderRadius: 0, border: 'none' }}>
                        <MapComponent map={map} />
                    </div>
                </div>
            </>
        )
    }
    
    // Always show the modal when we have a route, regardless of sidebar state
    // Only hide it if user explicitly closed it
    const isModalVisible = showRouteModal && !hideRouteModal;
    
    return (
        <>
            {showSidebar ? (
                <div className={styles.sidebar}>
                    <div className={styles.sidebarContent} id={SIDEBAR_CONTENT_ID}>
                        
                        {/* Fixed container for search inputs */}
                        <div className={styles.fixedSearchContainer}>
                            <Search points={query.queryPoints} map={map} />
                            <div>{!error.isDismissed && <ErrorMessage error={error} />}</div>
                        </div>
                        
                        {/* Scrollable container for routing results */}
                        <div className={styles.scrollableResults}>
                            <RoutingResults
                                paths={route.routingResult.data.routes}
                                selectedPath={route.selectedPath}
                                currentRequest={query.currentRequest}
                            />
                        </div>
                    </div>
                </div>
            ) : (
                <div className={styles.sidebarWhenClosed}>
                    <PlainButton className={styles.sidebarOpenButton} onClick={() => setShowSidebar(true)}>
                        <Menu />
                    </PlainButton>
                </div>
            )}
            <div className={styles.popupContainer} id={POPUP_CONTAINER_ID} />
            <div className={styles.map}>
               
                {/* Map container with rounded corners */}
                <div className={styles.mapContainer}>
                    <MapComponent map={map} />
                    <MapOptions {...mapOptions} />
                </div>

                 {/* Routing details panel positioned above the map */}
                 <div className={styles.routingDetailsPanelWrapper}>
                    <RoutingDetailsPanel
                        selectedPath={route.selectedPath}
                        showDistanceInMiles={settings.showDistanceInMiles}
                        isVisible={isModalVisible}
                        onClose={handleCloseModal}
                    />
                </div>
                
            </div>
        </>
    )
}

