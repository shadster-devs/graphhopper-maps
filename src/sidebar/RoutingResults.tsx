import { Path, RoutingResultInfo } from '@/api/graphhopper'
import { SegmentedPath } from '@/api/sarathi'
import { Coordinate, CurrentRequest, getBBoxFromCoord, RequestState, SubRequest } from '@/stores/QueryStore'
import styles from './RoutingResult.module.css'
import React, { ReactNode, useContext, useEffect, useState } from 'react'
import Dispatcher from '@/stores/Dispatcher'
import { PathDetailsElevationSelected, SetBBox, SetSelectedPath } from '@/actions/Actions'
import { metersToShortText, metersToTextForFile, milliSecondsToText, timeToText } from '@/Converters'
import GPXDownload from '@/sidebar/file_download.svg'
import { LineString, Position } from 'geojson'
import { calcDist } from '@/distUtils'
import { useMediaQuery } from 'react-responsive'
import { Bbox } from '@/api/graphhopper'
import { SettingsContext } from '@/contexts/SettingsContext'
import { getTransportIcon } from '@/constants/TransportIcons'

export interface RoutingResultsProps {
    paths: SegmentedPath[]
    selectedPath: SegmentedPath
    currentRequest: CurrentRequest
    profile: string
}

export default function RoutingResults(props: RoutingResultsProps) {
    // for landscape orientation there is no need that there is space for the map under the 3 alternatives and so the max-height is smaller for short screen
    const isShortScreen = useMediaQuery({
        query: '(max-height: 45rem) and (orientation: landscape), (max-height: 70rem) and (orientation: portrait)',
    })
    return <ul style={{ padding: 0, margin: 0 }}>{isShortScreen ? createSingletonListContent(props) : createListContent(props)}</ul>
}

function RoutingResult({
    path,
    isSelected,
    profile,
}: {
    path: SegmentedPath
    isSelected: boolean
    profile: string
}) {
    const [isExpanded, setExpanded] = useState(false)
    const resultSummaryClass = isSelected
        ? styles.resultSummary + ' ' + styles.selectedResultSummary
        : styles.resultSummary

    useEffect(() => setExpanded(isSelected && isExpanded), [isSelected])
    const settings = useContext(SettingsContext)
    const showDistanceInMiles = settings.showDistanceInMiles

    // Get all unique transport modes used in this path
    const transportModes = path.segments ? path.segments.map(segment => segment.mode) : [];
    
    // Extract location names from the path segments
    const getLocationNames = (): string[] => {
        if (!path.segments || path.segments.length === 0) return ["Origin", "Destination"];
        
        const names: string[] = [];
        
        // Add origin (from property of first segment)
        if (path.segments[0]?.from) {
            names.push(formatLocationName(path.segments[0].from));
        } else {
            names.push("Origin");
        }
        
        // Add all destinations except the last one (these are intermediate stops)
        if (path.segments.length > 1) {
            for (let i = 0; i < path.segments.length - 1; i++) {
                if (path.segments[i]?.to) {
                    names.push(formatLocationName(path.segments[i].to));
                }
            }
        }
        
        // Add final destination (to property of last segment)
        const lastSegment = path.segments[path.segments.length - 1];
        if (lastSegment?.to) {
            names.push(formatLocationName(lastSegment.to));
        } else {
            names.push("Destination");
        }
        
        return names;
    };
    
    // Format location name to be more readable
    const formatLocationName = (name: string): string => {
        // Extract only the first part before comma (e.g., "Raipur" from "Raipur, Chhattisgarh")
        let formattedName = name.split(',')[0].trim();
        
        // Remove any extra info in parentheses
        formattedName = formattedName.split('(')[0].trim();
        
        // Capitalize first letter of each word
        formattedName = formattedName.split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
            
        return formattedName;
    };
    
    const locationNames = getLocationNames();
    
    // Format price if available with proper currency symbol
    const getPriceWithSymbol = () => {
        if (!path.price || !path.price.price) return '';
        
        const amount = path.price.price;
        const currency = path.price.currency;
        
        // Map currency codes to symbols
        const currencySymbols: Record<string, string> = {
            'USD': '$',
            'EUR': '€',
            'GBP': '£',
            'JPY': '¥',
            'INR': '₹',
            'CNY': '¥',
            'RUB': '₽',
            // Add more currencies as needed
        };
        
        const symbol = currencySymbols[currency] || '';
        return symbol ? `${symbol}${amount}` : `${amount} ${currency}`;
    };
    
    const priceDisplay = getPriceWithSymbol();

    return (
        <div className={styles.resultRow}>
            <div className={styles.resultSelectableArea} onClick={() => Dispatcher.dispatch(new SetSelectedPath(path))}>
                <div className={resultSummaryClass}>
                    <div className={styles.resultValues}>
                        <span className={styles.resultMainText}>{timeToText(path.travelDuration)}</span>
                        <span className={styles.resultSecondaryText}>
                            {metersToShortText(path.distance * 1000, showDistanceInMiles)}
                        </span>
                        {priceDisplay && (
                            <span className={styles.resultPriceText}>
                                {priceDisplay}
                                </span>
                        )}
                        
                        {/* Display route tags if available - below the price */}
                        {path.tags && path.tags.length > 0 && (
                            <div className={styles.routeTags}>
                                {path.tags.map((tag, index) => (
                                    <span 
                                        key={index} 
                                        className={styles.routeTag}
                                        style={{ backgroundColor: getToneColor(tag.tone) }}
                                    >
                                        {tag.content}
                                </span>
                                ))}
                            </div>
                        )}
                        
                        {/* Improved visual representation of the route */}
                        {path.segments && path.segments.length > 0 && (
                            <div className={styles.routeVisualization}>
                                {/* Horizontal line connecting all points */}
                                <div className={styles.visualPath}></div>
                                
                                {/* Display each city with its actual name */}
                                {locationNames.map((location, index) => (
                                    <div key={index} className={styles.cityContainer}>
                                        <div className={`${styles.cityPoint} ${index === 0 ? styles.origin : index === locationNames.length - 1 ? styles.destination : ''}`}></div>
                                        <div className={styles.cityName} title={location}>
                                            {location}
                    </div>
                </div>
                                ))}
                                
                                {/* Transport mode icons between cities */}
                                {transportModes.map((mode, index) => (
                                    <div 
                                        key={index} 
                                        className={styles.transportIconOverlay}
                                        style={{ 
                                            left: `calc(${index + 0.5} * (100% / ${locationNames.length - 1}))`,
                                            transform: 'translateX(-50%)'
                                        }}
                                    >
                                        {getTransportIcon(mode)}
                                    </div>
                                ))}
            </div>
                        )}
                    </div>
                    
                    {path.summary && (
                        <div className={styles.routeInfoContainer}>
                            <div className={styles.routeSummary}>
                                {path.summary}
                            </div>
                        </div>
                    )}
                </div>
                </div>
        </div>
    )
}

// Helper function to get color based on tag tone
function getToneColor(tone: string): string {
    switch(tone?.toLowerCase()) {
        case 'positive':
        case 'good':
            return '#4CAF50'; // Green
        case 'negative':
        case 'bad':
            return '#F44336'; // Red
        case 'warning':
        case 'caution':
            return '#FF9800'; // Orange
        case 'info':
        case 'neutral':
            return '#2196F3'; // Blue
        default:
            return '#9E9E9E'; // Gray for unknown tones
    }
}

function toCoordinate(pos: Position): Coordinate {
    return { lng: pos[0], lat: pos[1] }
}

function toBBox(segment: Coordinate[]): Bbox {
    // TODO replace with ApiImpl.getBBoxPoints
    const bbox = getBBoxFromCoord(segment[0], 0.002)
    if (segment.length == 1) bbox
    segment.forEach(c => {
        bbox[0] = Math.min(bbox[0], c.lng)
        bbox[1] = Math.min(bbox[1], c.lat)
        bbox[2] = Math.max(bbox[2], c.lng)
        bbox[3] = Math.max(bbox[3], c.lat)
    })
    if (bbox[2] - bbox[0] < 0.005) {
        bbox[0] -= 0.005 / 2
        bbox[2] += 0.005 / 2
    }
    if (bbox[3] - bbox[1] < 0.005) {
        bbox[1] -= 0.005 / 2
        bbox[3] += 0.005 / 2
    }
    return bbox as Bbox
}


function calcDistPos(from: Position, to: Position): number {
    return calcDist({ lat: from[1], lng: from[0] }, { lat: to[1], lng: to[0] })
}

function pad(value: number) {
    return value < 10 ? '0' + value : '' + value
}

function RoutingResultPlaceholder() {
    return (
        <div className={styles.resultRow}>
            <div className={styles.placeholderContainer}>
                <div className={styles.placeholderMain} />
                <div className={styles.placeholderMain + ' ' + styles.placeholderSecondary} />
            </div>
        </div>
    )
}

function hasPendingRequests(subRequests: SubRequest[]) {
    return subRequests.some(req => req.state === RequestState.SENT)
}

function getLength(paths: SegmentedPath[], subRequests: SubRequest[]) {
    if (subRequests.length > 0 && hasPendingRequests(subRequests)) {
        // consider maxAlternativeRoutes only for subRequests that are not yet returned, i.e. state === SENT
        // otherwise it can happen that too fast alternatives reject the main request leading to stale placeholders
        return Math.max(
            paths.length,
            ...subRequests
                .filter(request => request.state === RequestState.SENT)
                .map(request => request.args.maxAlternativeRoutes)
        )
    }
    return paths.length
}

function createSingletonListContent(props: RoutingResultsProps) {
    // if (props.paths.length > 0)
        // return <RoutingResult path={props.selectedPath} isSelected={true} profile={props.profile} info={props.info} />
    if (hasPendingRequests(props.currentRequest.subRequests)) return <RoutingResultPlaceholder key={1} />
    return ''
}

function createListContent({ paths, currentRequest, selectedPath, profile }: RoutingResultsProps) {
    const length = getLength(paths, currentRequest.subRequests)
    const result = []

    for (let i = 0; i < length; i++) {
        if (i < paths.length)
            result.push(
                <RoutingResult
                    key={i}
                    path={paths[i]}
                    isSelected={paths[i] === selectedPath}
                    profile={profile}
                />
            )
        else result.push(<RoutingResultPlaceholder key={i} />)
    }

    return result
}
