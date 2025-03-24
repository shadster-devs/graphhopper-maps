import { useEffect, useRef } from 'react';
import { Map } from 'ol';
import { SegmentedPath } from '@/api/sarathi';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import { fromLonLat } from 'ol/proj';
import { Icon, Style } from 'ol/style';
import { getTransportIcon } from '@/constants/TransportIcons';
import { renderToString } from 'react-dom/server';
import { Settings } from '@/stores/SettingsStore';

// Layer key for animations
const animationLayerKey = 'animationLayer';

const UNIFORM_SPEED_FACTOR = 2;

const BASE_SEGMENT_DURATION = 5000;

/**
 * Creates a style for a transport mode icon
 * @param iconSvg The SVG string for the icon
 * @param visible Whether the icon should be visible
 * @param rotation Rotation angle in radians (for flight icon)
 * @returns A style object for the icon
 */
function createIconStyle(iconSvg: string, visible: boolean, rotation: number = 0): Style {
  // First clean the SVG to remove any stroke attributes that might be causing rendering issues
  const cleanSvg = iconSvg
    .replace(/stroke="[^"]*"/g, '')
    .replace(/stroke-width="[^"]*"/g, '');
    
  return new Style({
    image: new Icon({
      src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(cleanSvg)}`,
      scale: 1.5,
      opacity: visible ? 1 : 0, // Set opacity based on visibility
      rotation: rotation, // Apply rotation for flight icon
    }),
  });
}

/**
 * Custom hook to add animated icons that move along path segments
 */
export default function usePathAnimations(map: Map, selectedPath: SegmentedPath, settings: Settings) {
  // Use refs to store animation state
  const animationRef = useRef<number | null>(null);
  const featuresRef = useRef<Feature[]>([]);
  const startTimeRef = useRef<number>(0);
  const layerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const isResettingRef = useRef<boolean>(false); // Track if we're in the reset phase

  // Function to update feature visibility
  const updateFeatureVisibility = (feature: Feature, visible: boolean, rotation: number = 0) => {
    const iconSvg = feature.get('iconSvg');
    if (iconSvg) {
      feature.setStyle(createIconStyle(iconSvg, visible, rotation));
    }
  };

  /**
   * Calculate the angle between two points in radians
   * Returns angle where 0 = east, PI/2 = north, PI = west, 3PI/2 = south
   */
  const calculateAngle = (startPoint: number[], endPoint: number[]): number => {
    // Calculate angle in radians
    const dx = endPoint[0] - startPoint[0];
    const dy = endPoint[1] - startPoint[1];
    
    // For OpenLayers rotation, the angle must be given in radians counterclockwise
    // But we need to adjust because the icon is pointing east by default
    // The negative sign is because our map coordinates have y increasing downwards
    return Math.atan2(-dy, dx);
  };

  useEffect(() => {
    // Clean up any existing animations
    cleanupAnimations();

    // Only create animations if:
    // 1. We have segments
    // 2. Animations are enabled
    // 3. We're in dynamic display mode
    if (!settings.showAnimations || 
        !selectedPath.segments || 
        selectedPath.segments.length === 0) {
      return;
    }

    // Create a new vector layer for the animations
    const animationSource = new VectorSource();
    const animationLayer = new VectorLayer({
      source: animationSource,
      zIndex: 10, // Make sure animations are on top
    });
    
    animationLayer.set(animationLayerKey, true);
    map.addLayer(animationLayer);
    layerRef.current = animationLayer;

    // Create features for each segment
    const features: Feature[] = [];
    
    selectedPath.segments.forEach((segment, index) => {
      // Normalize the mode from Sarathi API format
      const normalizedMode = segment.mode?.toLowerCase() || '';
      let mappedMode = normalizedMode;
      
      // Map Sarathi API enum values to our local values
      if (normalizedMode === 'flights') mappedMode = 'flight';
      if (normalizedMode === 'rails') mappedMode = 'train';
      
      // Render the icon to string using the mapped mode
      const iconSvg = renderToString(getTransportIcon(mappedMode));
      
      // Get source and destination coordinates from the new format
      const sourceCoords = segment.source.geo ? 
        [segment.source.geo.lng, segment.source.geo.lat] : 
        [0, 0]; // Default coordinates if source.geo is not available
      
      // Create a feature with a point geometry
      const feature = new Feature({
        geometry: new Point(fromLonLat(sourceCoords)),
        segmentIndex: index,
        mode: mappedMode, // Use the mapped mode for consistency
        path: segment.points && segment.points.coordinates ? 
          segment.points.coordinates.map(coord => fromLonLat(coord)) : 
          [fromLonLat(sourceCoords)], // Fallback to a single point if coordinates not available
        pathLength: segment.points && segment.points.coordinates ? 
          segment.points.coordinates.length : 1,
        progress: 0, // Track animation progress (0-1)
        isActive: false, // Track if this segment is currently animating
        iconSvg: iconSvg, // Store the SVG string for later style updates
      });

      // Initially all icons are hidden except the first one
      const isFirstSegment = index === 0;
      
      // If it's the first segment and it's a flight, calculate initial rotation
      if (isFirstSegment && mappedMode === 'flight' && 
          segment.points && segment.points.coordinates && 
          segment.points.coordinates.length > 1) {
        const path = feature.get('path');
        const initialRotation = calculateAngle(path[0], path[1]);
        feature.setStyle(createIconStyle(iconSvg, isFirstSegment, initialRotation));
      } else {
        feature.setStyle(createIconStyle(iconSvg, isFirstSegment));
      }
      
      features.push(feature);
      animationSource.addFeature(feature);
    });

    // Activate the first segment to start the sequence
    if (features.length > 0) {
      features[0].set('isActive', true);
      features[0].set('activationTime', Date.now());
      
      // Set proper initial rotation for first segment if it's a flight
      if (features[0].get('mode') === 'flight') {
        const path = features[0].get('path');
        if (path && path.length > 1) {
          const initialRotation = calculateAngle(path[0], path[1]);
          updateFeatureVisibility(features[0], true, initialRotation);
        } else {
          updateFeatureVisibility(features[0], true);
        }
      } else {
        updateFeatureVisibility(features[0], true);
      }
    }

    featuresRef.current = features;
    startTimeRef.current = Date.now();
    isResettingRef.current = false;

    // Start the animation
    startAnimation();

    // Cleanup function
    return () => {
      cleanupAnimations();
    };
  }, [map, selectedPath, settings.showAnimations]);

  // Function to start the animation loop
  const startAnimation = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    const animate = () => {
      const features = featuresRef.current;
      let nextSegmentActivated = false;

      // Skip animation updates during reset phase
      if (isResettingRef.current) {
        animationRef.current = requestAnimationFrame(animate);
        return;
      }

      // Find the currently active segment
      const activeSegmentIndex = features.findIndex(feature => feature.get('isActive') === true);
      
      // If no active segment (should never happen, but just in case), activate the first one
      if (activeSegmentIndex === -1 && features.length > 0 && !isResettingRef.current) {
        features[0].set('isActive', true);
        features[0].set('activationTime', Date.now());
        
        // Set proper initial rotation if it's a flight
        if (features[0].get('mode') === 'flight') {
          const path = features[0].get('path');
          if (path && path.length > 1) {
            const initialRotation = calculateAngle(path[0], path[1]);
            updateFeatureVisibility(features[0], true, initialRotation);
          } else {
            updateFeatureVisibility(features[0], true);
          }
        } else {
          updateFeatureVisibility(features[0], true);
        }
      }
      
      // Update each feature's position
      features.forEach((feature, index) => {
        const isActive = feature.get('isActive');
        
        // Skip inactive segments
        if (!isActive) {
          return;
        }
        
        const mode = feature.get('mode');
        const path = feature.get('path');
        
        if (path.length < 2) {
          return; // Skip animation if there's no path to follow
        }
        
        // Fixed duration for each segment (3 seconds)
        const SEGMENT_DURATION = 3000; // 3 seconds in milliseconds
        
        // Get time since segment activation
        const segmentStartTime = feature.get('activationTime') || startTimeRef.current;
        const segmentElapsedTime = Date.now() - segmentStartTime;
        
        // Calculate progress based on time (0-1)
        // This ensures each segment takes exactly 3 seconds regardless of distance
        const progress = Math.min(segmentElapsedTime / SEGMENT_DURATION, 1);
        
        // Calculate total path distance
        let totalDistance = 0;
        for (let i = 1; i < path.length; i++) {
          const dx = path[i][0] - path[i-1][0];
          const dy = path[i][1] - path[i-1][1];
          totalDistance += Math.sqrt(dx*dx + dy*dy);
        }
        
        // Calculate position along the path based on progress (linear interpolation)
        let currentDistance = 0;
        let targetDistance = progress * totalDistance;
        let currentPosition = path[0];
        let segmentStart = 0;
        let segmentEnd = 0;
        let segmentProgress = 0;
        
        // Find the current segment along the path
        for (let i = 1; i < path.length; i++) {
          const dx = path[i][0] - path[i-1][0];
          const dy = path[i][1] - path[i-1][1];
          const segmentLength = Math.sqrt(dx*dx + dy*dy);
          
          if (currentDistance + segmentLength >= targetDistance || i === path.length - 1) {
            // We're in this segment
            segmentStart = i - 1;
            segmentEnd = i;
            segmentProgress = (targetDistance - currentDistance) / segmentLength;
            segmentProgress = Math.max(0, Math.min(1, segmentProgress)); // Clamp between 0-1
            
            // Linear interpolation between points
            const x = path[segmentStart][0] + segmentProgress * dx;
            const y = path[segmentStart][1] + segmentProgress * dy;
            currentPosition = [x, y];
            break;
          }
          
          currentDistance += segmentLength;
        }
        
        // Update position
        const geometry = feature.getGeometry() as Point;
        if (geometry) {
          geometry.setCoordinates(currentPosition);
          
          // Calculate rotation angle for the icon (direction of travel)
          if (mode === 'flight') {
            // For flights, always point in direction of overall travel
            const startPoint = path[segmentStart];
            const endPoint = path[segmentEnd]; 
            const angle = calculateAngle(startPoint, endPoint);
            updateFeatureVisibility(feature, true, angle);
          }
        }
        
        // If this segment is complete, deactivate it and activate the next one
        if (progress >= 1 && !nextSegmentActivated && !isResettingRef.current) {
          // Deactivate current segment
          feature.set('isActive', false);
          updateFeatureVisibility(feature, false);
          
          // If there is a next segment, activate it
          if (index < features.length - 1) {
            features[index + 1].set('isActive', true);
            features[index + 1].set('activationTime', Date.now());
            
            // Set initial rotation for flight segments
            const nextMode = features[index + 1].get('mode');
            const nextPath = features[index + 1].get('path');
            
            if (nextMode === 'flight' && nextPath.length >= 2) {
              const initialRotation = calculateAngle(nextPath[0], nextPath[1]);
              updateFeatureVisibility(features[index + 1], true, initialRotation);
            } else {
              updateFeatureVisibility(features[index + 1], true);
            }
            
            nextSegmentActivated = true;
          } else {
            // We've reached the end of all segments, reset to start over
            // Mark that we're entering reset phase
            isResettingRef.current = true;
            
            // Wait a moment before restarting the sequence
            setTimeout(() => {
              // Make sure all segments are inactive first and hidden
              features.forEach(f => {
                f.set('isActive', false);
                updateFeatureVisibility(f, false);
              });
              
              // Reset all segments to their starting positions
              features.forEach((f, i) => {
                const startCoord = f.get('path')[0];
                const geom = f.getGeometry() as Point;
                if (geom) {
                  geom.setCoordinates(startCoord);
                }
              });
              
              // Only then, after a small delay, activate the first segment
              setTimeout(() => {
                if (features.length > 0) {
                  const firstMode = features[0].get('mode');
                  const firstPath = features[0].get('path');
                  
                  features[0].set('isActive', true);
                  features[0].set('activationTime', Date.now());
                  
                  if (firstMode === 'flight' && firstPath.length >= 2) {
                    const initialRotation = calculateAngle(firstPath[0], firstPath[1]);
                    updateFeatureVisibility(features[0], true, initialRotation);
                  } else {
                    updateFeatureVisibility(features[0], true);
                  }
                }
                // End the reset phase
                isResettingRef.current = false;
              }, 100);
              
            }, 500); // 0.5 second pause before restarting
          }
        }
      });

      // Continue the animation
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
  };

  // Function to clean up animations
  const cleanupAnimations = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    // Remove the animation layer
    if (layerRef.current) {
      map.removeLayer(layerRef.current);
      layerRef.current = null;
    }

    // Clear existing features
    featuresRef.current = [];
    isResettingRef.current = false;
  };

  return null;
} 