import React, { useState } from 'react';
import styles from './RoutingDetailsPanel.module.css';
import { SegmentedPath, Segment } from '@/api/sarathi';
import { metersToShortText, timeToText } from '@/Converters';
import { getTransportIcon } from '@/constants/TransportIcons';

interface RoutingDetailsPanelProps {
    selectedPath: SegmentedPath;
    showDistanceInMiles: boolean;
    isVisible: boolean;
    onClose?: () => void;
}

const RoutingDetailsPanel: React.FC<RoutingDetailsPanelProps> = ({ 
    selectedPath, 
    showDistanceInMiles,
    isVisible,
    onClose
}) => {
    // State to track if the panel is collapsed
    const [isCollapsed, setIsCollapsed] = useState(false);
    
    // Function to toggle between collapsed and expanded states
    const toggleCollapse = () => {
        setIsCollapsed(!isCollapsed);
    };
    
    // Calculate total journey information for the collapsed view
    const calculateJourneySummary = () => {
        if (!selectedPath || !selectedPath.segments) return { time: 0, distance: 0 };
        
        // Calculate total time from segments
        const totalTime = selectedPath.segments.reduce((sum, segment) => sum + (segment.time || 0), 0);
            
        // Calculate total distance - use the path's distance if available
        const totalDistance = selectedPath.distance || 0;
            
        return { time: totalTime, distance: totalDistance };
    };
    
    // Get all stops in the journey for collapsed view
    const getJourneyStops = () => {
        if (!selectedPath || !selectedPath.segments || selectedPath.segments.length === 0) {
            return [];
        }
        
        const stops = [selectedPath.segments[0].from];
        
        selectedPath.segments.forEach(segment => {
            stops.push(segment.to);
        });
        
        return stops;
    };
    
    // Debug output to see what we're receiving
    console.log("RoutingDetailsPanel render", { 
        isVisible, 
        isCollapsed,
        hasPath: !!selectedPath,
        hasSegments: selectedPath && !!selectedPath.segments,
        segmentsLength: selectedPath && selectedPath.segments ? selectedPath.segments.length : 0
    });
    
    if (!isVisible || !selectedPath || !selectedPath.segments || selectedPath.segments.length === 0) {
        return null;
    }
    
    const { time, distance } = calculateJourneySummary();
    const allStops = getJourneyStops();

    // Helper function to get the icon color based on mode
    const getIconBackgroundColor = (mode: string | undefined): string => {
        if (!mode) return '#f8f9fa';
        
        const normalizedMode = mode.toUpperCase();
        
        if (normalizedMode.includes('FLIGHT')) {
            return `rgba(60, 130, 246, 0.15)`; // Flight: Light blue background
        } else if (normalizedMode.includes('TRAIN') || normalizedMode.includes('RAIL')) {
            return `rgba(16, 185, 129, 0.15)`; // Train: Light green background
        } else if (normalizedMode.includes('BUS')) {
            return `rgba(245, 158, 11, 0.15)`; // Bus: Light amber background
        } else if (normalizedMode.includes('TAXI') || normalizedMode.includes('CAB')) {
            return `rgba(236, 72, 153, 0.15)`; // Taxi: Light pink background
        }
        
        return '#f8f9fa'; // Default light background
    };

    return (
        <div className={`${styles.routingDetailsPanelContainer} ${isCollapsed ? styles.collapsed : ''}`}>
            {isCollapsed ? (
                // Collapsed view with summary information
                <div className={styles.collapsedContent}>
                    <div className={styles.collapsedInfo}>
                        <div className={styles.collapsedTimeDistance}>
                            <span className={styles.collapsedTime}>{timeToText(time)}</span>
                            <span> • </span>
                            <span className={styles.collapsedDistance}>
                               {distance}km
                            </span>
                        </div>
                        <div className={styles.collapsedRoute}>
                            {allStops.map((stop, index) => (
                                <React.Fragment key={index}>
                                    <span>{stop}</span>
                                    {index < allStops.length - 1 && <span className={styles.routeArrow}>→</span>}
                                </React.Fragment>
                            ))}
                        </div>
                    </div>
                    <button 
                        className={styles.collapseToggleButton} 
                        onClick={toggleCollapse}
                        aria-label="Expand"
                    >
                        <span className={styles.expandIcon}>Show Details</span>
                    </button>
                </div>
            ) : (
                // Expanded view with full details
                <div className={styles.modalContent}>
                    {/* Title bar with collapse control */}
                    <div className={styles.titleBar}>
                        <div className={styles.leftSection}>
                            <h3 className={styles.journeyTitle}>Journey Details</h3>
                        </div>
                        <button 
                            className={styles.collapseToggleButton} 
                            onClick={toggleCollapse}
                            aria-label="Collapse"
                        >
                            <span className={styles.collapseIcon}>Hide Details</span>
                        </button>
                    </div>
                    
                    <div className={styles.journeyTimeline}>
                        {selectedPath.segments.map((segment, index) => (
                            <div key={index} className={styles.journeySegment}>
                                {/* Source location - first point */}
                                <div className={styles.locationPoint}>
                                    <div className={`${styles.pointMarker} ${index === 0 ? styles.originMarker : ''}`}></div>
                                    <div className={styles.locationName}>
                                        {segment.from}
                                    </div>
                                </div>
                                
                                {/* Journey segment details */}
                                <div className={styles.segmentDetails}>
                                    {/* All content in a single row */}
                                    <div className={styles.segmentSingleRow}>
                                        <div className={styles.serviceInfo}>
                                            <span 
                                                className={styles.inlineIcon} 
                                                style={{ backgroundColor: getIconBackgroundColor(segment.mode) }}
                                            >
                                                {getTransportIcon(segment.mode)}
                                            </span>
                                            <span className={styles.serviceCount}>
                                                {segment.mode?.toLowerCase().includes('flight') ? '215+ Flight services' : 
                                                 segment.mode?.toLowerCase().includes('train') ? '180+ Train services' : 
                                                 segment.mode?.toLowerCase().includes('bus') ? '75+ Bus services' : 
                                                 segment.mode?.toLowerCase().includes('taxi') || segment.mode?.toLowerCase().includes('cab') ? 'Taxi services' : 
                                                 'Services available'}
                                            </span>
                                        </div>
                                        
                                        <div className={styles.travelTimeCompact}>
                                            <span className={styles.clockIcon}>⏱️</span>
                                            <span className={styles.travelTime}>{timeToText(segment.time)}</span>
                                            <span className={styles.approxLabel}>Approx Travel Time</span>
                                        </div>
                                        
                                        <div className={styles.pricingCompact}>
                                            <span className={styles.price}>
                                                {segment.priceDetails?.price ? 
                                                    `₹${segment.priceDetails.price}` : 
                                                    '₹--'}
                                                <span className={styles.priceLabel}>Onwards</span>
                                            </span>
                                        </div>
                                        
                                        {segment.ctaDetails && segment.ctaDetails.redirectUrl && (
                                            <a 
                                                href={segment.ctaDetails.redirectUrl} 
                                                target="_blank" 
                                                rel="noopener noreferrer" 
                                                className={styles.bookButton}
                                            >
                                                {segment.mode?.toLowerCase().includes('flight') ? 'BOOK FLIGHT' : 
                                                 segment.mode?.toLowerCase().includes('train') ? 'BOOK TRAIN' :
                                                 segment.mode?.toLowerCase().includes('bus') ? 'BOOK BUS' :
                                                 segment.mode?.toLowerCase().includes('taxi') ? 'BOOK TAXI' :
                                                 segment.ctaDetails.redirectText || `BOOK ${segment.mode?.toUpperCase() || 'NOW'}`}
                                            </a>
                                        )}
                                    </div>
                                </div>
                                
                                {/* Show destination marker only for the last segment */}
                                {index === selectedPath.segments.length - 1 && (
                                    <div className={styles.locationPoint}>
                                        <div className={`${styles.pointMarker} ${styles.destinationMarker}`}></div>
                                        <div className={styles.locationName}>
                                            {segment.to}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default RoutingDetailsPanel; 